import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const markdownRenderer = readFileSync(new URL("../app/qa-markdown.tsx", import.meta.url), "utf8");
const executionPolicy = readFileSync(new URL("../app/interview-sql-execution.ts", import.meta.url), "utf8");
const runnerComponent = readFileSync(new URL("../app/executable-sql-block.tsx", import.meta.url), "utf8");
const runnerWorker = readFileSync(new URL("../public/sql-runner.worker.mjs", import.meta.url), "utf8");
const interviewOverlay = readFileSync(new URL("../app/sql-interview-runnable-overlay.tsx", import.meta.url), "utf8");
const interviewPage = readFileSync(new URL("../app/interview/interview-domain-page-client.tsx", import.meta.url), "utf8");
const deepLink = readFileSync(new URL("../app/interview-question-deep-link.tsx", import.meta.url), "utf8");
const referenceOverlay = readFileSync(new URL("../app/sql-reference-runnable-overlay.tsx", import.meta.url), "utf8");
const referencePage = readFileSync(new URL("../app/reference/[section]/page.tsx", import.meta.url), "utf8");

test("SQL learning blocks use the executable runner", () => {
  assert.match(markdownRenderer, /ExecutableSqlBlock/);
  assert.match(markdownRenderer, /isRunnableSqlSource\(language, source\)/);
  assert.match(executionPolicy, /language\.toLowerCase\(\) !== "sql"/);
  assert.match(executionPolicy, /unsupportedRunnableSqlPatterns/);
  assert.match(executionPolicy, /12_000/);
  assert.match(runnerComponent, />SQL</);
  assert.match(runnerComponent, />Result</);
  assert.match(runnerComponent, />Run</);
  assert.match(runnerComponent, />Reset</);
  assert.match(runnerComponent, /Copied" : "Copy"/);
  assert.match(runnerComponent, />Clear</);
});

test("SQL interview examples and direct links use the executable runner", () => {
  assert.match(interviewPage, /SqlInterviewRunnableOverlay/);
  assert.match(interviewOverlay, /isRunnableSqlSource\(example\.language, example\.code\)/);
  assert.match(interviewOverlay, /ExecutableSqlBlock/);
  assert.match(interviewOverlay, /Copy SQL example/);
  assert.match(deepLink, /const runnableSql = isRunnableSqlSource/);
  assert.match(deepLink, /<ExecutableSqlBlock code=\{example\.code\}/);
});

test("published SQL practice tasks expose the runner", () => {
  assert.match(referencePage, /section === "data" \? <SqlReferenceRunnableOverlay\/>/);
  assert.match(referenceOverlay, /sql-practical-tasks\.json/);
  assert.match(referenceOverlay, /isRunnableSqlSource\("sql", row\.detail\)/);
  assert.match(referenceOverlay, /<ExecutableSqlBlock code=\{row\.detail\}/);
});

test("SQL runner is isolated from production data and bounded", () => {
  assert.match(runnerComponent, /new Worker\("\/sql-runner\.worker\.mjs", \{ type: "module" \}\)/);
  assert.match(runnerComponent, /LOAD_TIMEOUT_MS = 60_000/);
  assert.match(runnerComponent, /EXECUTION_TIMEOUT_MS = 5_000/);
  assert.match(runnerComponent, /MAX_RUNS_PER_WORKER = 30/);
  assert.match(runnerComponent, /maxLength=\{MAX_CODE_LENGTH\}/);
  assert.match(runnerWorker, /pyodide\/v314\.0\.4\/full/);
  assert.match(runnerWorker, /import sqlite3/);
  assert.match(runnerWorker, /sqlite3\.connect\(":memory:"\)/);
  assert.match(runnerWorker, /CREATE TABLE users/);
  assert.match(runnerWorker, /CREATE TABLE orders/);
  assert.match(runnerWorker, /CREATE TABLE employees/);
  assert.match(runnerWorker, /_MAX_ROWS = 200/);
  assert.match(runnerWorker, /ATTACH, DETACH, VACUUM and load_extension are disabled/);
  assert.match(runnerWorker, /Network access is disabled in the SQL runner/);
  assert.match(runnerWorker, /credentials: "omit"/);
  assert.doesNotMatch(runnerWorker, /D1Database|\.prepare\(|env\.DB/);
});
