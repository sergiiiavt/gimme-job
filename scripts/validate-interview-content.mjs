import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [common, canonical, databaseSql, expanded, sources, taxonomy] = await Promise.all([
  readJson("../content/interview/common-qa.json"),
  readJson("../content/interview/canonical-baseline.json"),
  readJson("../content/interview/database-sql-qa.json"),
  readJson("../content/interview/expanded-qa.json"),
  readJson("../content/interview/sources.json"),
  readJson("../content/interview/taxonomy.json"),
]);

const questions = [...common.questions, ...canonical.questions, ...databaseSql.questions, ...expanded.questions];
const levels = new Set(["Junior", "Middle", "Senior", "Lead"]);
const prevalenceLevels = new Set(["Very common", "Common", "Occasional", "Specialist"]);
const sourceIds = new Set(sources.map((source) => source.id));
const categories = new Set(taxonomy.flatMap((item) => item.category ? [item.category] : []));
const questionIds = new Set();
const questionTexts = new Set();

assert.equal(sourceIds.size, sources.length, "Source IDs must be unique.");

assert.equal(questions.length, 520, "The public collection must contain exactly 520 canonical questions.");
assert.equal(sources.length, 46, "The source catalog must contain exactly 46 researched sources.");
assert.equal(categories.size, 18, "The taxonomy must contain exactly 18 question topics.");
assert.equal(canonical.questions.length, 30, "The explicit canonical baseline must contain 30 audited questions.");
assert.equal(databaseSql.questions.length, 25, "The explicit database and SQL set must contain 25 audited questions.");
assert.deepEqual(
  new Set(canonical.questions.map((question) => question.category)),
  categories,
  "The explicit canonical baseline must cover every topic.",
);
assert.deepEqual(
  new Set(["AI, ML and LLM", "Databases, SQL and BI", "Observability and production", "Regulated domains"].filter((category) => categories.has(category))),
  new Set(["AI, ML and LLM", "Databases, SQL and BI", "Observability and production", "Regulated domains"]),
  "The four expanded specialist topics are required.",
);

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
  const normalizedQuestion = question.question.trim().toLowerCase();
  assert.ok(!questionTexts.has(normalizedQuestion), `Duplicate question text: ${question.question}`);
  questionTexts.add(normalizedQuestion);
  assert.ok(levels.has(question.level), `Invalid level for ${question.id}`);
  assert.ok(prevalenceLevels.has(question.prevalence), `Invalid prevalence for ${question.id}`);
  assert.ok(categories.has(question.category), `Unknown category ${question.category} in ${question.id}`);
  assert.ok(question.question?.trim(), `Missing question for ${question.id}`);
  assert.doesNotMatch(question.question, /\btest testing\b/i, `Awkward generated wording in ${question.id}`);
  assert.ok(question.shortAnswer?.trim(), `Missing answer for ${question.id}`);
  assert.ok(question.shortAnswer.trim().length >= 100, `Answer is too short for ${question.id}`);
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

for (const question of canonical.questions) {
  assert.ok(!question.id.startsWith("expanded-"), `Canonical baseline question must have a stable explicit id: ${question.id}`);
}

for (const question of databaseSql.questions) {
  assert.ok(!question.id.startsWith("expanded-"), `Database and SQL question must have a stable explicit id: ${question.id}`);
  assert.equal(question.category, "Databases, SQL and BI", `Database and SQL question has the wrong topic: ${question.id}`);
}

for (const prevalence of prevalenceLevels) {
  assert.ok(questions.some((question) => question.prevalence === prevalence), `No questions use prevalence ${prevalence}`);
}

for (const category of categories) {
  const count = questions.filter((question) => question.category === category).length;
  assert.ok(count === 28 || count === 29, `Topic ${category} must contain 28 or 29 questions, found ${count}.`);
}

console.log(`Interview content validated: ${questions.length} questions, ${categories.size} topics, ${sources.length} sources.`);
