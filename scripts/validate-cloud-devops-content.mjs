import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(projectRoot, "content", "cloud-devops");

const readJson = async (name) => JSON.parse(await readFile(path.join(contentRoot, name), "utf8"));
const fail = (message) => { throw new Error(`[cloud-devops] ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

const taxonomy = await readJson("taxonomy.json");
const sources = await readJson("sources.json");

assert(Array.isArray(taxonomy) && taxonomy.length === 4, "taxonomy must contain exactly 4 initial chapters");
assert(Array.isArray(sources) && sources.length >= 10, "source register must contain at least 10 implementation/primary sources");

const unique = (items, field, label) => {
  const values = items.map((item) => item[field]);
  assert(values.every((value) => value !== undefined && value !== null && value !== ""), `${label} contains an empty ${field}`);
  assert(new Set(values).size === values.length, `${label} contains duplicate ${field} values`);
};

unique(taxonomy, "id", "taxonomy");
unique(taxonomy, "order", "taxonomy");
unique(taxonomy, "file", "taxonomy");
unique(sources, "id", "sources");

const sourceIds = new Set(sources.map((source) => source.id));
const expectedOrders = Array.from({ length: taxonomy.length }, (_, index) => index + 1);
assert(JSON.stringify(taxonomy.map((topic) => topic.order).sort((a, b) => a - b)) === JSON.stringify(expectedOrders), "chapter order must be contiguous starting at 1");
assert(taxonomy.filter((topic) => topic.kind === "case-study").length === 2, "initial path must contain exactly two real implementation case studies");

for (const source of sources) {
  assert(typeof source.title === "string" && source.title.length > 8, `source ${source.id} needs a useful title`);
  assert(/^https:\/\//.test(source.url), `source ${source.id} must use an https URL`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt), `source ${source.id} needs checkedAt YYYY-MM-DD`);
  assert(typeof source.role === "string" && source.role.length > 20, `source ${source.id} needs a useful role description`);
}

const requiredCaseStudyHeadings = [
  "## What we are building",
  "## Repository map",
  "## Reproduce it yourself",
  "## Verification",
  "## Why these decisions",
  "## Failure modes",
  "## Summary",
  "## Sources",
];

for (const topic of taxonomy) {
  assert(["foundation", "case-study"].includes(topic.kind), `topic ${topic.id} has unsupported kind ${topic.kind}`);
  assert(Array.isArray(topic.sourceIds) && topic.sourceIds.length >= 4, `topic ${topic.id} must cite at least 4 registered sources`);
  for (const sourceId of topic.sourceIds) assert(sourceIds.has(sourceId), `topic ${topic.id} references unknown source ${sourceId}`);

  const markdown = await readFile(path.join(contentRoot, topic.file), "utf8");
  assert(/^#\s+.+/m.test(markdown), `${topic.file} needs a level-1 title`);
  assert((markdown.match(/^##\s+.+/gm) ?? []).length >= 8, `${topic.file} needs at least 8 level-2 sections`);
  assert(/^## Summary\s*$/m.test(markdown), `${topic.file} needs a Summary section`);
  assert(/^## Sources\s*$/m.test(markdown), `${topic.file} needs a Sources section`);
  assert(markdown.includes("```diagram"), `${topic.file} needs at least one explanatory diagram`);

  if (topic.kind === "case-study") {
    assert(markdown.includes("CASE STUDY · GIMMEJOB"), `${topic.file} needs an explicit case-study marker`);
    for (const heading of requiredCaseStudyHeadings) {
      assert(markdown.includes(heading), `${topic.file} must contain '${heading}'`);
    }
    assert(/github\.com\/sergiiiavt\/gimme-job\/blob\/main\//.test(markdown), `${topic.file} must link to the real production implementation`);
  }
}

console.log(`Cloud & DevOps content valid: ${taxonomy.length} chapters, ${taxonomy.filter((topic) => topic.kind === "case-study").length} case studies, ${sources.length} sources.`);
