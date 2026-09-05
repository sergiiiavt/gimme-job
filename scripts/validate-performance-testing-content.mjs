import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

const [core, practical, sources, subtopics, learning, domains] = await Promise.all([
  readJson("../content/interview/performance-testing-core-qa.json"),
  readJson("../content/interview/performance-testing-practical-qa.json"),
  readJson("../content/interview/performance-testing-sources.json"),
  readJson("../content/interview/performance-testing-subtopics.json"),
  readJson("../content/performance-testing/catalog.json"),
  readJson("../content/interview/domains.json"),
]);

const questions = [...core.questions, ...practical.questions];
const sourceById = new Map(sources.map((source) => [source.id, source]));
const interviewBanks = new Set(sources.filter((source) => source.kind === "Interview question bank").map((source) => source.id));
const officialSources = new Set(sources.filter((source) => source.kind.startsWith("Official")).map((source) => source.id));
const questionIds = new Set();

assert.equal(core.questions.length, 10, "The performance core set must contain the 10 researched canonical questions.");
assert.equal(practical.questions.length, 12, "The performance practical set must contain the 12 researched tool/scenario questions.");
assert.equal(questions.length, 22, "The authored performance interview set must contain 22 researched questions.");
assert.ok(interviewBanks.size >= 5, "Performance interview recurrence must be checked across at least five independent interview banks.");
assert.ok(officialSources.size >= 10, "Performance answers must be backed by a broad primary-source set.");

for (const source of sources) {
  assert.match(source.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid performance source id: ${source.id}`);
  assert.match(source.url, /^https:\/\//, `Performance source URL must use HTTPS: ${source.id}`);
  assert.ok(source.title?.trim(), `Missing performance source title: ${source.id}`);
  assert.ok(source.publisher?.trim(), `Missing performance source publisher: ${source.id}`);
  assert.ok(source.role?.trim(), `Missing performance source role: ${source.id}`);
}

for (const question of questions) {
  assert.match(question.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid performance question id: ${question.id}`);
  assert.ok(!questionIds.has(question.id), `Duplicate performance question id: ${question.id}`);
  questionIds.add(question.id);
  assert.equal(question.category, "Performance Testing", `Authored performance source question has unexpected category: ${question.id}`);
  assert.ok(question.question?.trim(), `Missing performance question text: ${question.id}`);
  assert.ok(question.shortAnswer?.trim().length >= 100, `Performance answer is too short: ${question.id}`);
  assert.ok(question.questionUk?.trim(), `Missing Ukrainian performance question: ${question.id}`);
  assert.ok(question.shortAnswerUk?.trim().length >= 100, `Ukrainian performance answer is too short: ${question.id}`);
  assert.ok(question.example?.trim().length >= 60, `Performance example is too short: ${question.id}`);
  assert.ok(question.exampleUk?.trim().length >= 60, `Ukrainian performance example is too short: ${question.id}`);
  assert.ok(question.strongAnswerSignals?.length >= 2, `Performance question needs answer signals: ${question.id}`);
  assert.equal(question.strongAnswerSignalsUk?.length, question.strongAnswerSignals.length, `Performance Ukrainian answer signals must match: ${question.id}`);
  assert.ok(question.sourceIds?.length >= 2, `Performance question needs independent source support: ${question.id}`);
  assert.ok(question.sourceIds.some((sourceId) => interviewBanks.has(sourceId)), `Performance question lacks an interview-bank recurrence source: ${question.id}`);
  for (const sourceId of question.sourceIds) {
    assert.ok(sourceById.has(sourceId), `Unknown performance source ${sourceId} in ${question.id}`);
  }
}

const technicallyValidated = questions.filter((question) => question.sourceIds.some((sourceId) => officialSources.has(sourceId)));
assert.ok(technicallyValidated.length >= 21, `At least 21 of 22 performance questions must cite a primary technical source; found ${technicallyValidated.length}.`);

assert.equal(domains.categoryToDomain["Performance and resilience"], "Performance Testing", "The canonical performance/resilience topic must route into the dedicated performance domain.");
assert.equal(Object.prototype.hasOwnProperty.call(domains.categoryToDomain, "Performance Testing"), false, "Top-level interview domains must not create an extra canonical topic category.");
assert.ok(domains.taxonomy.some((domain) => domain.id === "performance-testing" && domain.category === "Performance Testing"), "Performance Testing must be a top-level interview domain.");
assert.ok(subtopics.taxonomy.length >= 8, "Performance interview navigation needs methodical subtopic coverage.");

assert.equal(learning.chapters.length, 8, "Performance learning path must contain the eight reviewed methodical chapters.");
assert.ok(learning.sources.length >= 10, "Performance learning path must use a broad primary-source set.");
assert.ok(learning.sources.every((source) => source.kind.startsWith("Official")), "Learning-path sources must be primary official documentation or an official syllabus.");
const learningSourceIds = new Set(learning.sources.map((source) => [source.id, source]));
const combinedMarkdown = learning.chapters.map((chapter) => chapter.markdown).join("\n\n");
for (const chapter of learning.chapters) {
  assert.ok(chapter.markdown?.trim().length >= 1500, `Performance learning chapter is too shallow: ${chapter.id}`);
  assert.ok(chapter.sourceIds?.length >= 2, `Performance learning chapter needs multiple primary references: ${chapter.id}`);
  for (const sourceId of chapter.sourceIds) {
    assert.ok(learningSourceIds.has(sourceId), `Unknown learning source ${sourceId} in chapter ${chapter.id}`);
  }
}

for (const concept of [
  "load testing",
  "stress testing",
  "spike testing",
  "endurance",
  "scalability",
  "workload",
  "concurrent users",
  "throughput",
  "p95",
  "p99",
  "parameterization",
  "correlation",
  "JMeter",
  "k6",
  "Locust",
  "distributed",
  "bottleneck",
  "CI/CD",
]) {
  assert.match(combinedMarkdown, new RegExp(concept.replace("/", "\\/"), "i"), `Performance learning path is missing ${concept}.`);
}

assert.doesNotMatch(combinedMarkdown, /practice exercise/i, "Performance learning material should remain methodical material, not generic practice-exercise filler.");

console.log(`Performance testing content validated: ${questions.length} researched interview questions, ${learning.chapters.length} learning chapters, ${sources.length} interview/technical sources.`);
