import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("publishes practical SQL tasks and code-aware interview rendering", async () => {
  const [catalog, practical, examples, dataExamples, expandedExamples, page, overlay, deepLink, styles, packageJson] = await Promise.all([
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-practical-interview.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-code-examples.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-data-code-examples.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-expanded-code-examples.ts"), "utf8"),
    readFile(projectFile("app/interview/page.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-code-overlay.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-deep-link.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-deep-link.module.css"), "utf8"),
    readFile(projectFile("package.json"), "utf8").then(JSON.parse),
  ]);

  assert.equal([...practical.matchAll(/\n    taskId: "task-/g)].length, 14);
  const codeExampleCount = [examples, dataExamples, expandedExamples]
    .reduce((count, source) => count + [...source.matchAll(/\n    id: "[a-z0-9-]+",\n    codeExamples:/g)].length, 0);
  assert.equal(codeExampleCount, 35);
  assert.equal([...expandedExamples.matchAll(/\n    id: "[a-z0-9-]+",\n    codeExamples:/g)].length, 2);
  assert.match(expandedExamples, /id: "database-test-scope"/);
  assert.match(expandedExamples, /id: "sql-joins-and-aggregation"/);
  assert.match(catalog, /import sqlDataCodeExamples from "\.\/sql-data-code-examples"/);
  assert.match(catalog, /import sqlExpandedCodeExamples from "\.\/sql-expanded-code-examples"/);
  assert.match(catalog, /\[\.\.\.sqlCodeExamples, \.\.\.sqlDataCodeExamples, \.\.\.sqlExpandedCodeExamples\]/);
  assert.match(catalog, /\.\.\.sqlPracticalInterview\.questions/);
  assert.match(catalog, /\.map\(applySourceEvidence\)\.map\(applySqlCodeExamples\)/);

  assert.match(page, /InterviewQuestionCodeOverlay/);
  assert.match(overlay, /className = "iq-code-examples-overlay"/);
  assert.match(overlay, /whiteSpace: "pre"/);
  assert.match(overlay, /overflowX: "auto"/);
  assert.match(overlay, /navigator\.clipboard\.writeText\(code\)/);
  assert.match(overlay, /SQL examples/);
  assert.match(overlay, /SQL приклади/);

  assert.match(deepLink, /question\.codeExamples\?\.length/);
  assert.match(deepLink, /<pre className=\{styles\.codeBlock\}><code>\{example\.code\}<\/code><\/pre>/);
  assert.match(deepLink, /copyCode\(example\.code, index\)/);
  assert.match(styles, /\.codeBlock \{/);
  assert.match(styles, /white-space: pre;/);
  assert.match(styles, /overflow-x: auto;/);

  assert.match(packageJson.scripts["check:content"], /validate-sql-interview-content\.mjs/);
});
