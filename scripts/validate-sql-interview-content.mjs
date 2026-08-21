import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) => JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
const readText = async (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const [databaseSql, sqlTasks, practicalSource, codeExampleSource, catalogSource] = await Promise.all([
  readJson("../content/interview/database-sql-qa.json"),
  readJson("../content/data-learning/sql-practical-tasks.json"),
  readText("../content/interview/sql-practical-interview.ts"),
  readText("../content/interview/sql-code-examples.ts"),
  readText("../content/interview/catalog.ts"),
]);

const enhancementIds = [...codeExampleSource.matchAll(/\n    id: "([a-z0-9-]+)",\n    codeExamples:/g)].map((match) => match[1]);
const practicalIds = [...practicalSource.matchAll(/\n    id: "(sql-[a-z0-9-]+)",/g)].map((match) => match[1]);
const practicalTaskIds = [...practicalSource.matchAll(/\n    taskId: "([a-z0-9-]+)",/g)].map((match) => match[1]);

assert.equal(databaseSql.questions.length, 25, "The audited SQL foundation set should stay at 25 questions.");
assert.equal(enhancementIds.length, 25, "Every audited SQL question should have a structured code example.");
assert.equal(new Set(enhancementIds).size, enhancementIds.length, "SQL code-example enhancement IDs must be unique.");
assert.deepEqual(
  new Set(enhancementIds),
  new Set(databaseSql.questions.map((question) => question.id)),
  "SQL code examples must cover every audited database/SQL question exactly once.",
);

assert.equal(practicalIds.length, 14, "The practical SQL interview layer should contain 14 focused script-writing questions.");
assert.equal(new Set(practicalIds).size, practicalIds.length, "Practical SQL interview question IDs must be unique.");
assert.equal(practicalTaskIds.length, 14, "Every practical interview question must reuse one maintained SQL task card.");
assert.equal(new Set(practicalTaskIds).size, practicalTaskIds.length, "Practical SQL task-card references must be unique.");

const taskIds = new Set(sqlTasks.cards.map((card) => card.id));
for (const taskId of practicalTaskIds) {
  assert.ok(taskIds.has(taskId), `Unknown SQL practical task card: ${taskId}`);
}
for (const id of practicalIds) {
  assert.ok(!databaseSql.questions.some((question) => question.id === id), `Practical SQL ID collides with audited question: ${id}`);
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

assert.match(catalogSource, /import sqlPracticalInterview from "\.\/sql-practical-interview"/);
assert.match(catalogSource, /import sqlCodeExamples from "\.\/sql-code-examples"/);
assert.match(catalogSource, /\.\.\.sqlPracticalInterview\.questions/);
assert.match(catalogSource, /\.map\(applySourceEvidence\)\.map\(applySqlCodeExamples\)/);
assert.match(catalogSource, /version: 15/);

console.log(`SQL interview content validated: ${databaseSql.questions.length} audited + ${practicalIds.length} practical questions, ${enhancementIds.length} audited questions with code examples.`);
