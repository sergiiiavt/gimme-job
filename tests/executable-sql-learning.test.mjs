import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isRunnableSqlInterviewExample, isRunnableSqlSource } from "../app/interview-sql-execution.ts";

const markdownRenderer = readFileSync(new URL("../app/qa-markdown.tsx", import.meta.url), "utf8");
const executionPolicy = readFileSync(new URL("../app/interview-sql-execution.ts", import.meta.url), "utf8");
const runnerComponent = readFileSync(new URL("../app/executable-sql-block.tsx", import.meta.url), "utf8");
const runnerShell = readFileSync(new URL("../app/executable-code-runner.tsx", import.meta.url), "utf8");
const runnerStyles = readFileSync(new URL("../app/executable-python-block.module.css", import.meta.url), "utf8");
const runnerWorker = readFileSync(new URL("../public/sql-runner.worker.mjs", import.meta.url), "utf8");
const interviewOverlay = readFileSync(new URL("../app/sql-interview-runnable-overlay.tsx", import.meta.url), "utf8");
const codeOverlay = readFileSync(new URL("../app/interview-question-code-overlay.tsx", import.meta.url), "utf8");
const interviewPage = readFileSync(new URL("../app/interview/interview-domain-page-client.tsx", import.meta.url), "utf8");
const deepLink = readFileSync(new URL("../app/interview-question-deep-link.tsx", import.meta.url), "utf8");
const referencePage = readFileSync(new URL("../app/reference/[section]/page.tsx", import.meta.url), "utf8");

test("SQL learning blocks use the executable runner", () => {
  assert.match(markdownRenderer, /ExecutableSqlBlock/);
  assert.match(markdownRenderer, /isRunnableSqlSource\(language, source\)/);
  assert.match(executionPolicy, /language\.toLowerCase\(\) !== "sql"/);
  assert.match(executionPolicy, /unsupportedRunnableSqlPatterns/);
  assert.match(executionPolicy, /12_000/);
  assert.match(runnerComponent, /language="SQL"/);
  assert.match(runnerComponent, /workerUrl="\/sql-runner\.worker\.mjs"/);
  assert.match(runnerShell, />Run</);
  assert.match(runnerShell, />Reset</);
  assert.match(runnerShell, /Copied" : "Copy"/);
  assert.match(runnerShell, />Clear</);
});

test("SQL runnable policy accepts SQLite examples and rejects unsupported sources", () => {
  assert.equal(isRunnableSqlSource("sql", "SELECT id FROM users;"), true);
  assert.equal(isRunnableSqlSource("SQL", "  -- explanation\nSELECT * FROM orders;"), true);
  assert.equal(isRunnableSqlSource("sql", "/* bounded comment */\nWITH active AS (SELECT 1) SELECT * FROM active;"), true);
  assert.equal(isRunnableSqlSource("sql", "\n/* one */\n-- two\nVALUES (1), (2);"), true);
  assert.equal(isRunnableSqlSource("python", "SELECT 1;"), false);
  assert.equal(isRunnableSqlSource("sql", ""), false);
  assert.equal(isRunnableSqlSource("sql", "x".repeat(12_001)), false);
  assert.equal(isRunnableSqlSource("sql", "PRAGMA table_info(users);"), false);
  assert.equal(isRunnableSqlSource("sql", "-- comment only"), false);
  assert.equal(isRunnableSqlSource("sql", "/* unterminated comment"), false);
  assert.equal(isRunnableSqlSource("sql", "VACUUM;"), false);
  assert.equal(isRunnableSqlSource("sql", "SELECT * FROM information_schema.tables;"), false);
  assert.equal(isRunnableSqlSource("sql", "CREATE TABLE users (id INTEGER);"), false);
});

test("interview SQL only runs when the audited runtime explicitly selects SQLite", () => {
  assert.equal(isRunnableSqlInterviewExample("sql", "SELECT * FROM users;", { engine: "sqlite" }), true);
  assert.equal(isRunnableSqlInterviewExample("sql", "SELECT * FROM users;", { engine: "static" }), false);
  assert.equal(isRunnableSqlInterviewExample("sql", "SELECT * FROM users;"), false);
  assert.equal(isRunnableSqlInterviewExample("sql", "SELECT * FROM users WHERE created_at >= DATE '2026-01-01';", { engine: "sqlite" }), false);
});

test("SQL runnable policy avoids nested leading-comment regex parsing", () => {
  assert.doesNotMatch(executionPolicy, /runnableSqlStart/);
  assert.match(executionPolicy, /indexOf\("\*\/"/);
  const adversarial = `/*${"*//*".repeat(5_000)}*/ SELECT 1;`;
  assert.equal(typeof isRunnableSqlSource("sql", adversarial), "boolean");
});

test("SQL interview examples and direct links use audited runtime metadata", () => {
  assert.match(interviewPage, /SqlInterviewRunnableOverlay/);
  assert.match(interviewOverlay, /isRunnableSqlInterviewExample\(example\.language, example\.code, example\.sqlRuntime\)/);
  assert.match(interviewOverlay, /ExecutableSqlBlock/);
  assert.match(interviewOverlay, /Copy SQL example/);
  assert.match(deepLink, /const runnableSql = isRunnableSqlInterviewExample\(example\.language, example\.code, example\.sqlRuntime\)/);
  assert.match(deepLink, /example\.sqlDialect/);
  assert.match(deepLink, /runtimeNote/);
  assert.match(codeOverlay, /question\.sqlScope/);
  assert.match(codeOverlay, /example\.sqlDialect/);
  assert.match(codeOverlay, /example\.sqlRuntime/);
  assert.match(deepLink, /<ExecutableSqlBlock code=\{example\.code\}/);
});

test("SQL quick reference stays static instead of mounting executable SQL", () => {
  assert.doesNotMatch(referencePage, /SqlReferenceRunnableOverlay/);
  assert.doesNotMatch(referencePage, /section === "data"/);
  assert.match(referencePage, /<QuickReferencePage referenceId=\{section\}\/>/);
});

test("SQL runner starts horizontal overflow at the beginning while retaining left scrollbars", () => {
  assert.match(runnerShell, /function resetHorizontalScroll/);
  assert.match(runnerShell, /element\.scrollLeft = -element\.scrollWidth/);
  assert.match(runnerShell, /ref=\{editorScrollRef\}/);
  assert.match(runnerShell, /ref=\{outputScrollRef\}/);
});

test("SQL sample database is responsive and refreshes from the current runner session", () => {
  assert.match(runnerComponent, />\s*Database\s*</);
  assert.match(runnerComponent, /action: "inspect"/);
  assert.match(runnerComponent, /Current session · Reset restores sample data/);
  assert.match(runnerComponent, /onRunComplete=\{handleRunComplete\}/);
  assert.match(runnerComponent, /onReset=\{handleReset\}/);
  assert.match(runnerComponent, /candidate\.database/);
  assert.match(runnerStyles, /grid-template-columns: repeat\(auto-fit, minmax\(108px, 1fr\)\)/);
  assert.match(runnerStyles, /\.databaseTableScroll \{[^}]*overflow-x: auto;/s);
  assert.match(runnerStyles, /\.databaseTable th,[\s\S]*max-width: 240px;/);
  assert.match(runnerWorker, /const INSPECT_WRAPPER/);
  assert.match(runnerWorker, /sqlite_master/);
  assert.match(runnerWorker, /PRAGMA table_info/);
  assert.match(runnerWorker, /"rowCount": _row_count/);
  assert.match(runnerWorker, /action === "inspect"/);
});

test("SQL worker keeps mutations until Reset destroys the worker", () => {
  assert.match(runnerWorker, /let sessionGlobals/);
  assert.match(runnerWorker, /function getSessionGlobals\(pyodide\)/);
  assert.match(runnerWorker, /if \("_conn" not in globals\(\)\)/);
  assert.match(runnerWorker, /_conn\.commit\(\)/);
  assert.match(runnerWorker, /_conn\.rollback\(\)/);
  assert.match(runnerWorker, /result\.database = readJsonResult\(globals\)/);
  assert.match(runnerShell, /const reset = \(\) => \{[\s\S]*destroyWorker\(\);[\s\S]*onReset\?\.\(\);/);
});

test("SQL worker transports explicit JSON results instead of parsing an undefined script return", () => {
  assert.match(runnerWorker, /__result_json__ = json\.dumps/);
  assert.match(runnerWorker, /globals\.get\("__result_json__"\)/);
  assert.match(runnerWorker, /if \(raw == null\) throw new Error\("SQL runtime returned no result\."\)/);
  assert.doesNotMatch(runnerWorker, /const raw = await pyodide\.runPythonAsync\(SQL_WRAPPER/);
});

test("SQL runner is isolated from production data and bounded", () => {
  assert.match(runnerShell, /new Worker\(workerUrl, \{ type: "module" \}\)/);
  assert.match(runnerShell, /LOAD_TIMEOUT_MS = 60_000/);
  assert.match(runnerShell, /EXECUTION_TIMEOUT_MS = 5_000/);
  assert.match(runnerComponent, /MAX_RUNS_PER_WORKER = 30/);
  assert.match(runnerComponent, /MAX_CODE_LENGTH = 12_000/);
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
