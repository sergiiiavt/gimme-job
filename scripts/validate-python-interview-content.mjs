import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
const readText = async (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

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

const [topicSets, practical, codeEnhancements, topicOverrides, sources, taxonomy, catalog] = await Promise.all([
  Promise.all(topicFiles.map((name) => readJson(`../content/python-interview/${name}.json`))),
  readJson("../content/python-interview/practical-qa.json"),
  readJson("../content/python-interview/code-examples.json"),
  readJson("../content/python-interview/topic-overrides.json"),
  readJson("../content/python-interview/sources.json"),
  readJson("../content/python-interview/taxonomy.json"),
  readText("../content/python-interview/catalog.ts"),
]);

const baseQuestions = topicSets.flatMap((set) => set.questions);
const questions = [...baseQuestions, ...practical.questions];
const levels = new Set(["Junior", "Middle", "Senior", "Lead"]);
const prevalenceLevels = new Set(["Very common", "Common", "Occasional", "Specialist"]);
const kinds = new Set(["Theory", "Practical", "Troubleshooting", "Performance", "Design", "Security", "Tooling"]);
const sourceIds = new Set(sources.map((source) => source.id));
const categories = new Set(taxonomy.flatMap((item) => item.category ? [item.category] : []));
const questionIds = new Set();
const questionTexts = new Set();

function validateCodeExample(example, context) {
  assert.equal(example.language, "python", `${context} must use language=python.`);
  assert.ok(example.title?.trim(), `Missing code-example title for ${context}.`);
  assert.ok(example.titleUk?.trim(), `Missing Ukrainian code-example title for ${context}.`);
  assert.ok(example.code?.trim().length >= 20, `Code example is too short for ${context}.`);
  assert.ok(example.explanation?.trim().length >= 40, `Code explanation is too short for ${context}.`);
  assert.ok(example.explanationUk?.trim().length >= 40, `Ukrainian code explanation is too short for ${context}.`);
  if (example.expectedResult || example.expectedResultUk) {
    assert.ok(example.expectedResult?.trim(), `Expected result must have English text for ${context}.`);
    assert.ok(example.expectedResultUk?.trim(), `Ukrainian expected result must have text for ${context}.`);
  }
}

assert.equal(sourceIds.size, sources.length, "Source IDs must be unique.");
assert.ok(baseQuestions.length >= 133, "The researched Python interview collection must not regress below the 133-question baseline.");
assert.equal(practical.questions.length, 18, "The focused practical Python layer must contain exactly 18 code-writing questions.");
assert.ok(questions.length >= 151, "The public Python interview collection must include the researched baseline plus practical additions.");
assert.equal(codeEnhancements.length, 19, "Keep structured code enhancements on the selected 19 high-frequency existing Python questions.");
assert.ok(sources.length >= 42, "The Python interview source catalog must contain at least 42 researched sources.");
assert.equal(categories.size, 14, "The Python interview taxonomy must contain exactly 14 question topics.");

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

const topicOverrideIds = new Set();
for (const override of topicOverrides) {
  assert.ok(questionIds.has(override.id), `Topic override targets unknown Python question ${override.id}.`);
  assert.ok(!topicOverrideIds.has(override.id), `Duplicate Python topic override id: ${override.id}`);
  assert.ok(categories.has(override.category), `Unknown topic override category ${override.category} for ${override.id}.`);
  topicOverrideIds.add(override.id);
}
assert.ok(topicOverrides.length >= 10, "Python AQA topic must group a meaningful set of existing questions.");

const topicOverrideById = new Map(topicOverrides.map((item) => [item.id, item.category]));
const effectiveQuestions = questions.map((question) => ({
  ...question,
  category: topicOverrideById.get(question.id) ?? question.category,
}));

for (const question of practical.questions) {
  assert.equal(question.kind, "Practical", `New practical-layer question ${question.id} must be Practical.`);
  assert.ok(question.codeExamples?.length, `New practical-layer question ${question.id} must include a structured code example.`);
  for (const [index, example] of question.codeExamples.entries()) {
    validateCodeExample(example, `${question.id} code example ${index + 1}`);
  }
}

const enhancementIds = new Set();
const baseQuestionIds = new Set(baseQuestions.map((question) => question.id));
for (const enhancement of codeEnhancements) {
  assert.ok(baseQuestionIds.has(enhancement.id), `Code enhancement targets unknown existing Python question ${enhancement.id}.`);
  assert.ok(!enhancementIds.has(enhancement.id), `Duplicate Python code enhancement id: ${enhancement.id}`);
  enhancementIds.add(enhancement.id);
  assert.ok(enhancement.codeExamples?.length, `Code enhancement ${enhancement.id} must include at least one example.`);
  for (const [index, example] of enhancement.codeExamples.entries()) {
    validateCodeExample(example, `${enhancement.id} enhancement ${index + 1}`);
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
  const count = effectiveQuestions.filter((question) => question.category === category).length;
  assert.ok(count >= 3, `Python interview topic ${category} must contain at least 3 meaningful questions, found ${count}.`);
}

const aqaQuestions = effectiveQuestions.filter((question) => question.category === "Python AQA specific");
assert.ok(aqaQuestions.length >= 10, `Python AQA specific must contain at least 10 questions, found ${aqaQuestions.length}.`);
assert.ok(aqaQuestions.some((question) => question.tags?.includes("pytest")), "Python AQA specific must include pytest coverage.");
assert.ok(aqaQuestions.some((question) => question.tags?.includes("test-automation")), "Python AQA specific must include browser/framework automation coverage.");

assert.match(catalog, /import practical from "\.\/practical-qa\.json"/);
assert.match(catalog, /import codeExamples from "\.\/code-examples\.json"/);
assert.match(catalog, /import topicOverrides from "\.\/topic-overrides\.json"/);
assert.match(catalog, /\.\.\.practical\.questions/);
assert.match(catalog, /pythonTopicOverrideById\.get\(question\.id\)/);
assert.match(catalog, /pythonCodeExamplesById\.get\(question\.id\)/);
assert.match(catalog, /version: 4/);
assert.match(catalog, /lastReviewedAt: "2026-08-22"/);

console.log(`Python interview content validated: ${questions.length} questions (${baseQuestions.length} researched + ${practical.questions.length} practical), ${codeEnhancements.length} existing questions with structured code examples, ${categories.size} topics, ${topicOverrides.length} topic overrides, ${sources.length} sources.`);
