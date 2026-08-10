import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [common, expanded, sources, taxonomy] = await Promise.all([
  readJson("../content/interview/common-qa.json"),
  readJson("../content/interview/expanded-qa.json"),
  readJson("../content/interview/sources.json"),
  readJson("../content/interview/taxonomy.json"),
]);

const questions = [...common.questions, ...expanded.questions];
const levels = new Set(["Junior", "Middle", "Senior", "Lead"]);
const sourceIds = new Set(sources.map((source) => source.id));
const categories = new Set(taxonomy.flatMap((item) => item.category ? [item.category] : []));
const questionIds = new Set();

assert.ok(questions.length >= 120, "The public collection must contain at least 120 canonical questions.");
assert.ok(sources.length >= 15, "The source catalog must contain broad technical coverage.");
assert.ok(categories.size >= 12, "The taxonomy must contain at least 12 question categories.");

for (const source of sources) {
  assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid source id: ${source.id}`);
  assert.ok(source.title?.trim(), `Missing source title for ${source.id}`);
  assert.match(source.url, /^https:\/\//, `Source URL must use HTTPS: ${source.id}`);
  assert.ok(source.role?.trim(), `Missing source role for ${source.id}`);
}

for (const question of questions) {
  assert.match(question.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid question id: ${question.id}`);
  assert.ok(!questionIds.has(question.id), `Duplicate question id: ${question.id}`);
  questionIds.add(question.id);
  assert.ok(levels.has(question.level), `Invalid level for ${question.id}`);
  assert.ok(categories.has(question.category), `Unknown category ${question.category} in ${question.id}`);
  assert.ok(question.question?.trim(), `Missing question for ${question.id}`);
  assert.ok(question.shortAnswer?.trim(), `Missing answer for ${question.id}`);
  assert.ok(question.strongAnswerSignals?.length >= 2, `Add at least two answer signals for ${question.id}`);
  assert.ok(question.sourceIds?.length, `Add at least one source for ${question.id}`);
  for (const sourceId of question.sourceIds) {
    assert.ok(sourceIds.has(sourceId), `Unknown source ${sourceId} in ${question.id}`);
  }
  for (const media of question.media ?? []) {
    assert.match(media.src, /^\/content\/interview\//, `Invalid media path in ${question.id}`);
    assert.ok(media.alt?.trim(), `Missing media alt text in ${question.id}`);
    assert.ok(media.caption?.trim(), `Missing media caption in ${question.id}`);
    assert.ok(media.credit?.trim(), `Missing media credit in ${question.id}`);
    await access(new URL(`../public${media.src}`, import.meta.url));
  }
}

console.log(`Interview content validated: ${questions.length} questions, ${categories.size} topics, ${sources.length} sources.`);
