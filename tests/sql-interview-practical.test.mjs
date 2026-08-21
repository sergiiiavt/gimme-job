import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("publishes practical SQL tasks and code-aware interview rendering", async () => {
  const [catalog, practical, examples, dataExamples, expandedExamples, page, overlay, deepLink, linkOverlay, styles, packageJson] = await Promise.all([
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-practical-interview.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-code-examples.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-data-code-examples.ts"), "utf8"),
    readFile(projectFile("content/interview/sql-expanded-code-examples.ts"), "utf8"),
    readFile(projectFile("app/interview/page.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-code-overlay.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-deep-link.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-link-overlay.tsx"), "utf8"),
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
  assert.match(overlay, /querySelector<HTMLElement>\(":scope > \.iq-example"\)/);
  assert.match(overlay, /legacyCopy\.style\.display = "none"/);
  assert.match(overlay, /practicalExample\.appendChild\(createCodeSection/);
  assert.match(overlay, /background: "#1e1e1e"/);
  assert.match(overlay, /span\.style\.color = "#569cd6"/);
  assert.match(overlay, /span\.style\.color = "#6a9955"/);
  assert.match(overlay, /span\.style\.color = "#ce9178"/);
  assert.match(overlay, /whiteSpace: "pre"/);
  assert.match(overlay, /overflowX: "auto"/);
  assert.match(overlay, /navigator\.clipboard\.writeText\(code\)/);

  assert.match(deepLink, /Practical example/);
  assert.match(deepLink, /Практичний приклад/);
  assert.match(deepLink, /highlightSql\(example\.code\)/);
  assert.match(deepLink, /copyCode\(example\.code, index\)/);
  assert.match(styles, /\.codeBlock \{/);
  assert.match(styles, /background: #1e1e1e;/);
  assert.match(styles, /color: #d4d4d4;/);
  assert.match(styles, /white-space: pre;/);
  assert.match(styles, /overflow-x: auto;/);

  assert.match(linkOverlay, /link\.target = "_blank"/);
  assert.match(linkOverlay, /link\.rel = "noopener noreferrer"/);
  assert.match(linkOverlay, /Open direct link to this question in a new tab/);

  assert.match(packageJson.scripts["check:content"], /validate-sql-interview-content\.mjs/);
});
