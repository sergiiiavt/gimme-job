import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const topicFiles = [
  "core-language-qa",
  "data-types-structures-qa",
  "strings-text-qa",
  "functions-functional-qa",
  "oop-qa",
  "iterators-generators-decorators-qa",
  "errors-context-managers-qa",
  "concurrency-qa",
  "memory-performance-qa",
  "packaging-environments-qa",
  "typing-static-analysis-qa",
  "stdlib-tooling-qa",
  "web-automation-qa",
];

const [topicSets, sources, taxonomy] = await Promise.all([
  Promise.all(topicFiles.map((name) => readJson(`../content/python-interview/${name}.json`))),
  readJson("../content/python-interview/sources.json"),
  readJson("../content/python-interview/taxonomy.json"),
]);

const questions = topicSets.flatMap((set) => set.questions);
const levels = new Set(["Junior", "Middle", "Senior", "Lead"]);
const prevalenceLevels = new Set(["Very common", "Common", "Occasional", "Specialist"]);
const kinds = new Set(["Theory", "Practical", "Troubleshooting", "Performance", "Design", "Security", "Tooling"]);
const sourceIds = new Set(sources.map((source) => source.id));
const categories = new Set(taxonomy.flatMap((item) => item.category ? [item.category] : []));
const questionIds = new Set();
const questionTexts = new Set();

assert.equal(sourceIds.size, sources.length, "Source IDs must be unique.");
assert.ok(questions.length >= 133, "The public Python interview collection must not regress below the current 133-question baseline.");
assert.ok(sources.length >= 42, "The Python interview source catalog must contain at least 42 researched sources.");
assert.equal(categories.size, 13, "The Python interview taxonomy must contain exactly 13 question topics.");

for (const source of sources) {
  assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid source id: ${source.id}`);
  assert.ok(source.title?.trim(), `Missing source title for ${source.id}`);
  assert.match(source.url, /^https:\/\//, `Source URL must use HTTPS: ${source.id}`);
  assert.ok(source.role?.trim(), `Missing source role for ${source.id}`);
}

for (const question of questions) {
  assert.match(question.id, /^py-[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid or non-namespaced question id: ${question.id}`);
  assert.ok(!questionIds.has(question.id), `Duplicate question id: ${question.id}`);
  questionIds.add(question.id);
  const normalizedQuestion = question.question.trim().toLowerCase();
  assert.ok(!questionTexts.has(normalizedQuestion), `Duplicate question text: ${question.question}`);
  questionTexts.add(normalizedQuestion);
  assert.ok(levels.has(question.level), `Invalid level for ${question.id}`);
  assert.ok(prevalenceLevels.has(question.prevalence), `Invalid prevalence for ${question.id}`);
  assert.ok(kinds.has(question.kind), `Invalid or missing kind for ${question.id}`);
  assert.ok(categories.has(question.category), `Unknown category ${question.category} in ${question.id}`);
  assert.ok(question.question?.trim(), `Missing question for ${question.id}`);
  assert.ok(question.shortAnswer?.trim(), `Missing answer for ${question.id}`);
  assert.ok(question.shortAnswer.trim().length >= 100, `Answer is too short for ${question.id}`);
  assert.ok(question.strongAnswerSignals?.length >= 2, `Add at least two answer signals for ${question.id}`);
  assert.ok(question.questionUk?.trim(), `Missing Ukrainian question for ${question.id}`);
  assert.ok(question.shortAnswerUk?.trim(), `Missing Ukrainian answer for ${question.id}`);
  assert.ok(question.shortAnswerUk.trim().length >= 100, `Ukrainian answer is too short for ${question.id}`);
  assert.ok(question.strongAnswerSignalsUk?.length === question.strongAnswerSignals.length, `Ukrainian answer signals must match the English signal count for ${question.id}`);
  assert.ok(question.example?.trim(), `Missing practical example for ${question.id}`);
  assert.ok(question.example.trim().length >= 60, `Practical example is too short for ${question.id}`);
  assert.ok(question.exampleUk?.trim(), `Missing Ukrainian practical example for ${question.id}`);
  assert.ok(question.exampleUk.trim().length >= 60, `Ukrainian practical example is too short for ${question.id}`);
  for (const tag of question.tags ?? []) {
    assert.match(tag, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid tag ${tag} in ${question.id}`);
  }
  assert.ok(question.sourceIds?.length, `Add at least one source for ${question.id}`);
  for (const sourceId of question.sourceIds) {
    assert.ok(sourceIds.has(sourceId), `Unknown source ${sourceId} in ${question.id}`);
  }
}

const referencedSourceIds = new Set(questions.flatMap((question) => question.sourceIds));
for (const sourceId of sourceIds) {
  assert.ok(referencedSourceIds.has(sourceId), `Source ${sourceId} is not referenced by any question.`);
}

for (const prevalence of prevalenceLevels) {
  assert.ok(questions.some((question) => question.prevalence === prevalence), `No Python interview questions use prevalence ${prevalence}`);
}

for (const category of categories) {
  const count = questions.filter((question) => question.category === category).length;
  assert.ok(count >= 8, `Python interview topic ${category} must contain at least 8 questions, found ${count}.`);
}

console.log(`Python interview content validated: ${questions.length} questions, ${categories.size} topics, ${sources.length} sources.`);
