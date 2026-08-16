import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "content", "qa-fundamentals");

const readJson = async (name) => JSON.parse(await readFile(path.join(contentRoot, name), "utf8"));
const fail = (message) => { throw new Error(`[qa-fundamentals] ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const taxonomy = await readJson("taxonomy.json");
const sources = await readJson("sources.json");
const requiredConcepts = await readJson("required-concepts.json");

assert(Array.isArray(taxonomy) && taxonomy.length === 8, "taxonomy must contain exactly 8 top-level topics");
assert(Array.isArray(sources) && sources.length >= 12, "source register must contain at least 12 authoritative sources");
assert(Array.isArray(requiredConcepts) && requiredConcepts.length >= 50, "required-concepts baseline must contain at least 50 concepts");

const unique = (items, field, label) => {
  const values = items.map((item) => item[field]);
  assert(values.every(Boolean), `${label} contains an empty ${field}`);
  assert(new Set(values).size === values.length, `${label} contains duplicate ${field} values`);
};

unique(taxonomy, "id", "taxonomy");
unique(taxonomy, "order", "taxonomy");
unique(taxonomy, "file", "taxonomy");
unique(sources, "id", "sources");
unique(requiredConcepts, "id", "required concepts");

const topicIds = new Set(taxonomy.map((topic) => topic.id));
const sourceIds = new Set(sources.map((source) => source.id));
const expectedOrders = Array.from({ length: 8 }, (_, index) => index + 1);
assert(JSON.stringify(taxonomy.map((topic) => topic.order).sort((a, b) => a - b)) === JSON.stringify(expectedOrders), "topic order must be exactly 1..8");

for (const source of sources) {
  assert(typeof source.title === "string" && source.title.length > 8, `source ${source.id} needs a useful title`);
  assert(/^https:\/\//.test(source.url), `source ${source.id} must use an https URL`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt), `source ${source.id} needs checkedAt YYYY-MM-DD`);
  assert(typeof source.status === "string" && source.status.length > 2, `source ${source.id} needs status metadata`);
}

for (const concept of requiredConcepts) {
  assert(topicIds.has(concept.topicId), `concept ${concept.id} references unknown topic ${concept.topicId}`);
  assert(typeof concept.label === "string" && concept.label.length > 3, `concept ${concept.id} needs a readable label`);
}

for (const topic of taxonomy) {
  assert(Array.isArray(topic.sourceIds) && topic.sourceIds.length >= 3, `topic ${topic.id} must cite at least 3 registered sources`);
  for (const sourceId of topic.sourceIds) assert(sourceIds.has(sourceId), `topic ${topic.id} references unknown source ${sourceId}`);

  const topicConcepts = requiredConcepts.filter((concept) => concept.topicId === topic.id);
  assert(topicConcepts.length >= 5, `topic ${topic.id} needs at least 5 required concepts`);

  const markdown = await readFile(path.join(contentRoot, topic.file), "utf8");
  assert(/^#\s+.+/m.test(markdown), `${topic.file} needs a level-1 title`);
  assert((markdown.match(/^##\s+.+/gm) ?? []).length >= 5, `${topic.file} needs at least 5 level-2 sections`);
  assert(/^## Summary\s*$/m.test(markdown), `${topic.file} needs a Summary section`);
  assert(/^## Sources\s*$/m.test(markdown), `${topic.file} needs a Sources section`);
  assert(markdown.includes("```diagram"), `${topic.file} needs at least one explanatory diagram`);

  const marker = markdown.match(/<!--\s*concepts:\s*([^>]+?)\s*-->/i);
  assert(marker, `${topic.file} needs a concepts coverage marker`);
  const documentedConcepts = new Set(marker[1].split(",").map((value) => value.trim()).filter(Boolean));
  for (const concept of topicConcepts) {
    assert(documentedConcepts.has(concept.id), `${topic.file} does not explicitly cover required concept ${concept.id}`);
  }
}

console.log(`QA fundamentals content valid: ${taxonomy.length} topics, ${requiredConcepts.length} required concepts, ${sources.length} sources.`);
