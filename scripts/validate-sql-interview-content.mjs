import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
const readText = async (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const [
  common,
  canonical,
  databaseSql,
  observabilityProduction,
  restoredCoverage,
  testingFoundations,
  embedded,
  modernSdet,
  coreFoundations,
  expanded,
  sourceRefresh,
  sqlTasks,
  practicalSource,
  codeExampleSource,
  dataCodeExampleSource,
  expandedCodeExampleSource,
  catalogSource,
] = await Promise.all([
  readJson("../content/interview/common-qa.json"),
  readJson("../content/interview/canonical-baseline.json"),
  readJson("../content/interview/database-sql-qa.json"),
  readJson("../content/interview/observability-production-qa.json"),
  readJson("../content/interview/restored-coverage-qa.json"),
  readJson("../content/interview/testing-foundations-qa.json"),
  readJson("../content/interview/embedded-qa.json"),
  readJson("../content/interview/modern-sdet-qa.json"),
  readJson("../content/interview/core-foundations-qa.json"),
  readJson("../content/interview/expanded-qa.json"),
  readJson("../content/interview/source-refresh-qa.json"),
  readJson("../content/data-learning/sql-practical-tasks.json"),
  readText("../content/interview/sql-practical-interview.ts"),
  readText("../content/interview/sql-code-examples.ts"),
  readText("../content/interview/sql-data-code-examples.ts"),
  readText("../content/interview/sql-expanded-code-examples.ts"),
  readText("../content/interview/catalog.ts"),
]);

const baseQuestions = [
  ...common.questions,
  ...canonical.questions,
  ...databaseSql.questions,
  ...observabilityProduction.questions,
  ...restoredCoverage.questions,
  ...testingFoundations.questions,
  ...embedded.questions,
  ...modernSdet.questions,
  ...coreFoundations.questions,
  ...expanded.questions,
  ...sourceRefresh.questions,
];
const existingSqlQuestions = baseQuestions.filter((question) => question.category === "Databases, SQL and BI");
const enhancementIds = [codeExampleSource, dataCodeExampleSource, expandedCodeExampleSource]
  .flatMap((source) => [...source.matchAll(/\n    id: "([a-z0-9-]+)",\n    codeExamples:/g)].map((match) => match[1]));
const practicalIds = [...practicalSource.matchAll(/\n    id: "(sql-[a-z0-9-]+)",/g)].map((match) => match[1]);
const practicalTaskIds = [...practicalSource.matchAll(/\n    taskId: "([a-z0-9-]+)",/g)].map((match) => match[1]);

assert.equal(databaseSql.questions.length, 25, "The audited SQL foundation set should stay at 25 questions.");
assert.ok(existingSqlQuestions.length >= 33, "The Databases, SQL and BI topic unexpectedly lost pre-existing coverage.");
assert.equal(enhancementIds.length, existingSqlQuestions.length, "Every existing SQL/BI question should have a structured code example.");
assert.equal(new Set(enhancementIds).size, enhancementIds.length, "SQL code-example enhancement IDs must be unique.");
assert.deepEqual(
  new Set(enhancementIds),
  new Set(existingSqlQuestions.map((question) => question.id)),
  "SQL code examples must cover every existing Databases, SQL and BI question exactly once.",
);

assert.equal(practicalIds.length, 14, "The practical SQL interview layer should contain 14 focused script-writing questions.");
assert.equal(new Set(practicalIds).size, practicalIds.length, "Practical SQL interview question IDs must be unique.");
assert.equal(practicalTaskIds.length, 14, "Every practical interview question must reuse one maintained SQL task card.");
assert.equal(new Set(practicalTaskIds).size, practicalTaskIds.length, "Practical SQL task-card references must be unique.");

const taskIds = new Set(sqlTasks.cards.map((card) => card.id));
const existingQuestionIds = new Set(baseQuestions.map((question) => question.id));
for (const taskId of practicalTaskIds) {
  assert.ok(taskIds.has(taskId), `Unknown SQL practical task card: ${taskId}`);
}
for (const id of practicalIds) {
  assert.ok(!existingQuestionIds.has(id), `Practical SQL ID collides with an existing interview question: ${id}`);
}

assert.match(practicalSource, /strongAnswerSignalsUk/);
assert.match(practicalSource, /codeExplanationUk/);
assert.match(practicalSource, /expectedResultUk/);
assert.match(practicalSource, /sourceIds: \["postgres-docs"\]/);
assert.match(practicalSource, /prevalence: "Common" as const/);
assert.match(practicalSource, /codeExamples: \[\{/);
assert.match(practicalSource, /code: answer\.detail/);
assert.match(codeExampleSource, /language: "sql"/);
assert.match(codeExampleSource, /expectedResultUk/);
assert.match(dataCodeExampleSource, /language: "sql"/);
assert.match(dataCodeExampleSource, /expectedResultUk/);
assert.match(expandedCodeExampleSource, /language: "sql"/);
assert.match(expandedCodeExampleSource, /expectedResultUk/);

assert.match(catalogSource, /import sqlPracticalInterview from "\.\/sql-practical-interview"/);
assert.match(catalogSource, /import sqlCodeExamples from "\.\/sql-code-examples"/);
assert.match(catalogSource, /import sqlDataCodeExamples from "\.\/sql-data-code-examples"/);
assert.match(catalogSource, /import sqlExpandedCodeExamples from "\.\/sql-expanded-code-examples"/);
assert.match(catalogSource, /\[\.\.\.sqlCodeExamples, \.\.\.sqlDataCodeExamples, \.\.\.sqlExpandedCodeExamples\]/);
assert.match(catalogSource, /\.\.\.sqlPracticalInterview\.questions/);
assert.match(catalogSource, /\.map\(applySourceEvidence\)\.map\(applySqlCodeExamples\)/);
assert.match(catalogSource, /version: 15/);

console.log(`SQL interview content validated: ${existingSqlQuestions.length} existing + ${practicalIds.length} practical questions, with structured code examples on every existing SQL/BI question.`);
