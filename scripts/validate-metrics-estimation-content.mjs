import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "content", "metrics-estimation");
const readJson = async (name) => JSON.parse(await readFile(path.join(contentRoot, name), "utf8"));
const fail = (message) => { throw new Error(`[metrics-estimation] ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const taxonomy = await readJson("taxonomy.json");
const sources = await readJson("sources.json");
const requiredConcepts = await readJson("required-concepts.json");
const chapters = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const english = await readJson(`chapter-${number}.en.json`);
  const ukrainian = await readJson(`chapter-${number}.uk.json`);
  assert(english.id === ukrainian.id, `chapter ${number} language documents must share an id`);
  return { id: english.id, markdown: english.markdown, markdownUk: ukrainian.markdownUk };
}));

assert(Array.isArray(taxonomy) && taxonomy.length === 8, "taxonomy must contain exactly 8 top-level topics");
assert(Array.isArray(chapters) && chapters.length === 8, "chapter documents must contain exactly 8 chapters");
assert(Array.isArray(sources) && sources.length >= 14, "source registry is unexpectedly small");
assert(Array.isArray(requiredConcepts) && requiredConcepts.length === 68, "required-concepts count must remain exactly 68");

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
const expectedOrders = Array.from({ length: 8 }, (_, index) => index + 1);
assert(JSON.stringify(taxonomy.map((topic) => topic.order).sort((a, b) => a - b)) === JSON.stringify(expectedOrders), "topic order must be exactly 1..8");
assert(taxonomy.every((topic) => chapterIds.has(topic.id)), "every taxonomy topic must have a chapter document");

for (const source of sources) {
  assert(typeof source.title === "string" && source.title.length > 6, `source ${source.id} needs a useful title`);
  assert(/^https:\/\//.test(source.url), `source ${source.id} must use HTTPS`);
  assert(source.checkedAt === "2026-08-16", `source ${source.id} must record the current review date`);
  assert(source.status === "verified", `source ${source.id} must be verified`);
  assert(typeof source.role === "string" && source.role.length > 12, `source ${source.id} needs a concrete role`);
}

for (const concept of requiredConcepts) {
  assert(topicIds.has(concept.topicId), `concept ${concept.id} references unknown topic ${concept.topicId}`);
  assert(typeof concept.label === "string" && concept.label.length > 4, `concept ${concept.id} needs a readable label`);
}

const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
const citedSources = new Set();
for (const topic of taxonomy) {
  assert(Array.isArray(topic.sourceIds) && topic.sourceIds.length >= 3, `topic ${topic.id} must cite at least 3 sources`);
  for (const sourceId of topic.sourceIds) {
    assert(sourceIds.has(sourceId), `topic ${topic.id} references unknown source ${sourceId}`);
    citedSources.add(sourceId);
  }

  const topicConcepts = requiredConcepts.filter((concept) => concept.topicId === topic.id);
  assert(topicConcepts.length >= 4, `topic ${topic.id} has too little learning content`);

  const chapter = chapterById.get(topic.id);
  assert(chapter && typeof chapter.markdown === "string" && typeof chapter.markdownUk === "string", `topic ${topic.id} is missing bilingual markdown`);
  const english = chapter.markdown;
  const ukrainian = chapter.markdownUk;

  for (const [language, markdown] of [["English", english], ["Ukrainian", ukrainian]]) {
    assert(/^#\s+.+/m.test(markdown), `${topic.id} ${language} needs an H1`);
    assert(markdown.includes("```diagram"), `${topic.id} ${language} needs an explanatory diagram`);
    assert(/^## Sources\s*$/m.test(markdown), `${topic.id} ${language} needs a Sources section`);
    assert(markdown.length >= 3000, `${topic.id} ${language} is too shallow`);
  }
  assert(/^## Summary\s*$/m.test(english), `${topic.id} English needs Summary`);
  assert(/^## Підсумок\s*$/m.test(ukrainian), `${topic.id} Ukrainian needs Підсумок`);

  const enHeadings = english.match(/^##\s+.+/gm) ?? [];
  const ukHeadings = ukrainian.match(/^##\s+.+/gm) ?? [];
  assert(enHeadings.length === topicConcepts.length + 2, `${topic.id} English H2 count must match concepts + Summary/Sources`);
  assert(ukHeadings.length === topicConcepts.length + 2, `${topic.id} Ukrainian H2 count must match concepts + Summary/Sources`);

  for (const markdown of [english, ukrainian]) {
    const marker = markdown.match(/<!--\s*concepts:\s*([^>]+?)\s*-->/i);
    assert(marker, `${topic.id} needs a concepts coverage marker in both languages`);
    const documented = marker[1].split(",").map((value) => value.trim()).filter(Boolean);
    const expected = topicConcepts.map((concept) => concept.id);
    assert(JSON.stringify(documented) === JSON.stringify(expected), `${topic.id} concepts marker must match registry order`);
  }
}

for (const source of sources) {
  assert(citedSources.has(source.id), `source ${source.id} is registered but unused`);
}


const allEnglish = chapters.map((chapter) => chapter.markdown).join("\n");
for (const token of ["numerator:", "denominator:", "scope:", "window:", "target:", "owner:", "decision:"]) {
  assert(allEnglish.includes(token), `formula contracts must include ${token}`);
}
assert((allEnglish.match(/scenario (?:example|definition)/gi) ?? []).length >= 4, "worked numeric/formula examples must be explicitly scenario-labelled");
assert(allEnglish.toLowerCase().includes("deployment rework rate"), "DORA chapter must cover the current fifth metric: deployment rework rate");
assert(allEnglish.toLowerCase().includes("change lead time") && allEnglish.toLowerCase().includes("failed deployment recovery time"), "DORA chapter must use current terminology");
assert(allEnglish.includes("not prescribe") && allEnglish.includes("story points"), "Scrum section must distinguish local sizing practice from Scrum requirements");
assert(allEnglish.includes("no single universal conversion to hours"), "test-points sizing must reject a universal hours conversion");


console.log("Metrics & estimation content valid: 8 topics, 68 required concepts, 14 verified sources.");
