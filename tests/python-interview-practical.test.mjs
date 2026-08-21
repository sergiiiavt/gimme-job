import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("publishes practical Python tasks with structured dark code examples", async () => {
  const [catalog, practical, enhancements, page, overlay, deepLink, styles, validator, packageJson] = await Promise.all([
    readFile(projectFile("content/python-interview/catalog.ts"), "utf8"),
    readJson("content/python-interview/practical-qa.json"),
    readJson("content/python-interview/code-examples.json"),
    readFile(projectFile("app/interview/python/page.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-code-overlay.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-deep-link.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-deep-link.module.css"), "utf8"),
    readFile(projectFile("scripts/validate-python-interview-content.mjs"), "utf8"),
    readFile(projectFile("package.json"), "utf8").then(JSON.parse),
  ]);

  assert.equal(practical.questions.length, 18);
  assert.equal(enhancements.length, 19);
  assert.equal(new Set(practical.questions.map((question) => question.id)).size, 18);
  assert.equal(new Set(enhancements.map((enhancement) => enhancement.id)).size, 19);

  for (const question of practical.questions) {
    assert.equal(question.kind, "Practical");
    assert.ok(question.id.startsWith("py-practical-"));
    assert.ok(question.codeExamples?.length >= 1);
    assert.ok(question.codeExamples.every((example) => example.language === "python"));
    assert.ok(question.codeExamples.every((example) => example.explanation && example.explanationUk));
  }

  assert.match(catalog, /import practical from "\.\/practical-qa\.json"/);
  assert.match(catalog, /import codeExamples from "\.\/code-examples\.json"/);
  assert.match(catalog, /\.\.\.practical\.questions/);
  assert.match(catalog, /pythonCodeExamplesById\.get\(question\.id\)/);
  assert.match(catalog, /version: 3/);

  assert.match(page, /InterviewQuestionCodeOverlay/);
  assert.match(page, /questions=\{pythonInterviewCatalog\.questions\}/);
  assert.match(page, /InterviewQuestionLinkOverlay/);

  assert.match(overlay, /const pythonKeywords = new Set/);
  assert.match(overlay, /const pythonBuiltins = new Set/);
  assert.match(overlay, /appendHighlightedPython/);
  assert.match(overlay, /normalizedLanguage === "python"/);
  assert.match(overlay, /background: "#1e1e1e"/);
  assert.match(overlay, /"#6a9955"/);
  assert.match(overlay, /"#ce9178"/);
  assert.match(overlay, /"#b5cea8"/);
  assert.match(overlay, /"#4ec9b0"/);
  assert.match(overlay, /whiteSpace: "pre"/);
  assert.match(overlay, /overflowX: "auto"/);
  assert.match(overlay, /legacyCopy\.style\.display = "none"/);
  assert.match(overlay, /practicalExample\.appendChild\(createCodeSection/);
  assert.match(overlay, /navigator\.clipboard\.writeText\(code\)/);

  assert.match(deepLink, /function highlightPython/);
  assert.match(deepLink, /function highlightCode/);
  assert.match(deepLink, /highlightCode\(example\.code, example\.language\)/);
  assert.match(deepLink, /Практичний приклад/);
  assert.match(styles, /background: #1e1e1e;/);
  assert.match(styles, /white-space: pre;/);
  assert.match(styles, /overflow-x: auto;/);

  assert.match(validator, /practical\.questions\.length, 18/);
  assert.match(validator, /codeEnhancements\.length, 19/);
  assert.match(validator, /example\.language, "python"/);
  assert.match(packageJson.scripts["check:content"], /validate-python-interview-content\.mjs/);
});
