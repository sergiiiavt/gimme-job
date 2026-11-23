import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "content", "testing-tools");
const readJson = async (name) => JSON.parse(await readFile(path.join(contentRoot, name), "utf8"));
const fail = (message) => { throw new Error(`[testing-tools] ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const taxonomy = await readJson("taxonomy.json");
const sources = await readJson("sources.json");
const requiredConcepts = await readJson("required-concepts.json");
const chapters = await Promise.all(Array.from({ length: taxonomy.length }, async (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const english = await readJson(`chapter-${number}.en.json`);
  const ukrainian = await readJson(`chapter-${number}.uk.json`);
  assert(english.id === ukrainian.id, `chapter ${number} language documents must share an id`);
  return { id: english.id, markdown: english.markdown, markdownUk: ukrainian.markdownUk };
}));

const expectedTopicIds = ["chrome-devtools", "postman", "curl-cli", "proxies", "wireshark", "mqtt-tools", "browser-extensions", "dbeaver", "mobile-tools"];
assert(Array.isArray(taxonomy) && JSON.stringify(taxonomy.map((topic) => topic.id)) === JSON.stringify(expectedTopicIds), `taxonomy must contain exactly these tool guides in order: ${expectedTopicIds.join(", ")}`);
assert(Array.isArray(chapters) && chapters.length === taxonomy.length, "chapter documents must match taxonomy topics");
assert(Array.isArray(sources) && sources.length >= 30, "source registry is unexpectedly small");
assert(Array.isArray(requiredConcepts) && requiredConcepts.length === 58, "required-concepts count must remain exactly 58");
assert(!taxonomy.some((topic) => topic.id === "locust-performance-testing"), "performance testing belongs in the Performance Testing learning path, not Testing Tools");

const unique = (items, field, label) => {
  const values = items.map((item) => item[field]);
  assert(values.every((value) => value !== undefined && value !== null && value !== ""), `${label} contains an empty ${field}`);
  assert(new Set(values).size === values.length, `${label} contains duplicate ${field} values`);
};
unique(taxonomy, "id", "taxonomy");
unique(taxonomy, "order", "taxonomy");
unique(chapters, "id", "chapters");
unique(sources, "id", "sources");
unique(requiredConcepts, "id", "required concepts");

const topicIds = new Set(taxonomy.map((topic) => topic.id));
const chapterIds = new Set(chapters.map((chapter) => chapter.id));
const sourceIds = new Set(sources.map((source) => source.id));
const expectedOrders = Array.from({ length: taxonomy.length }, (_, index) => index + 1);
assert(JSON.stringify(taxonomy.map((topic) => topic.order).sort((a, b) => a - b)) === JSON.stringify(expectedOrders), `topic order must be exactly 1..${taxonomy.length}`);
assert(taxonomy.every((topic) => chapterIds.has(topic.id)), "every taxonomy topic must have a chapter document");

for (const source of sources) {
  assert(typeof source.title === "string" && source.title.length > 6, `source ${source.id} needs a useful title`);
  assert(source.url.startsWith("https://"), `source ${source.id} must use HTTPS`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt), `source ${source.id} must record an ISO review date`);
  assert(source.status === "verified", `source ${source.id} must be verified`);
  assert(typeof source.role === "string" && source.role.length > 12, `source ${source.id} needs a concrete role`);
}

for (const concept of requiredConcepts) {
  assert(topicIds.has(concept.topicId), `concept ${concept.id} references unknown topic ${concept.topicId}`);
  assert(typeof concept.label === "string" && concept.label.length > 4, `concept ${concept.id} needs a readable label`);
}

const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
const enHeadingCount = (markdown) => (markdown.match(/^##\s+.+/gm) ?? []).length;
const citedSources = new Set();
for (const topic of taxonomy) {
  assert(Array.isArray(topic.sourceIds) && topic.sourceIds.length >= 3, `topic ${topic.id} must cite at least 3 sources`);
  for (const sourceId of topic.sourceIds) {
    assert(sourceIds.has(sourceId), `topic ${topic.id} references unknown source ${sourceId}`);
    citedSources.add(sourceId);
  }

  const topicConcepts = requiredConcepts.filter((concept) => concept.topicId === topic.id);
  assert(topicConcepts.length >= 3, `topic ${topic.id} has too little learning content`);

  const chapter = chapterById.get(topic.id);
  assert(chapter && typeof chapter.markdown === "string" && typeof chapter.markdownUk === "string", `topic ${topic.id} is missing bilingual markdown`);
  const english = chapter.markdown;
  const ukrainian = chapter.markdownUk;

  for (const [language, markdown] of [["English", english], ["Ukrainian", ukrainian]]) {
    assert(/^#\s+.+/m.test(markdown), `${topic.id} ${language} needs an H1`);
    assert(markdown.includes("```diagram"), `${topic.id} ${language} needs an explanatory diagram`);
    assert(/^## Sources\s*$/m.test(markdown), `${topic.id} ${language} needs a Sources section`);
    assert(markdown.length >= 6000, `${topic.id} ${language} is too shallow for a hands-on tool guide`);
    assert(/^1\.\s+\S/m.test(markdown) && /^3\.\s+\S/m.test(markdown), `${topic.id} ${language} needs numbered step-by-step instructions`);
    assert(/^\|.+\|\s*$/m.test(markdown), `${topic.id} ${language} needs at least one reference table`);
  }
  const screenshots = (markdown) => [...markdown.matchAll(/^!\[[^\]]+\]\((https:\/\/[^\s)]+)\s+"([^"]+)"\)$/gm)];
  const englishShots = screenshots(english);
  const ukrainianShots = screenshots(ukrainian);
  assert(englishShots.length >= 1, `${topic.id} needs at least one captioned screenshot`);
  assert(JSON.stringify(englishShots.map((shot) => shot[1])) === JSON.stringify(ukrainianShots.map((shot) => shot[1])), `${topic.id} screenshots must be identical and in the same order in both languages`);
  for (const [, url, caption] of [...englishShots, ...ukrainianShots]) {
    assert(caption.length > 20, `${topic.id} screenshot ${url} needs a descriptive caption`);
  }
  assert(/^## Summary\s*$/m.test(english), `${topic.id} English needs Summary`);
  assert(/^## (?:Підсумок|Summary)\s*$/m.test(ukrainian), `${topic.id} Ukrainian needs Підсумок`);
  assert(/^## Cheat sheet\s*$/m.test(english) && /^## Шпаргалка\s*$/m.test(ukrainian), `${topic.id} needs a Cheat sheet / Шпаргалка section`);
  assert(enHeadingCount(english) === enHeadingCount(ukrainian), `${topic.id} English and Ukrainian need the same number of H2 sections`);

  const enHeadings = english.match(/^##\s+.+/gm) ?? [];
  const ukHeadings = ukrainian.match(/^##\s+.+/gm) ?? [];
  assert(enHeadings.length >= topicConcepts.length + 2, `${topic.id} English needs at least one H2 section per required concept plus Summary/Sources`);
  assert(ukHeadings.length >= topicConcepts.length + 2, `${topic.id} Ukrainian needs at least one H2 section per required concept plus Summary/Sources`);

  for (const markdown of [english, ukrainian]) {
    const markerPrefix = "<!-- concepts:";
    const markerStart = markdown.indexOf(markerPrefix);
    assert(markerStart >= 0, `${topic.id} needs a concepts coverage marker in both languages`);
    const markerEnd = markdown.indexOf("-->", markerStart + markerPrefix.length);
    assert(markerEnd > markerStart, `${topic.id} needs a closed concepts coverage marker`);
    const documented = markdown.slice(markerStart + markerPrefix.length, markerEnd).trim().split(",").map((value) => value.trim()).filter(Boolean);
    const expected = topicConcepts.map((concept) => concept.id);
    assert(JSON.stringify(documented) === JSON.stringify(expected), `${topic.id} concepts marker must match registry order`);
  }
}

for (const source of sources) assert(citedSources.has(source.id), `source ${source.id} is registered but unused`);

const practicalEn = await readJson("practical-examples.en.json");
const practicalUk = await readJson("practical-examples.uk.json");
for (const topic of taxonomy) {
  for (const [language, labs] of [["English", practicalEn], ["Ukrainian", practicalUk]]) {
    const lab = labs[topic.id];
    assert(typeof lab === "string" && /^:::details\s+\S/.test(lab) && /\n:::\s*$/.test(lab), `${topic.id} needs a ${language} hands-on lab in a :::details block`);
    assert(/^1\.\s+\S/m.test(lab), `${topic.id} ${language} lab needs numbered steps`);
  }
}
assert(Object.keys(practicalEn).length === taxonomy.length && Object.keys(practicalUk).length === taxonomy.length, "every tool guide needs exactly one lab per language");

console.log(`Testing tools content valid: ${taxonomy.length} tool guides, ${requiredConcepts.length} required concepts, ${sources.length} verified sources.`);
