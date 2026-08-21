import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("publishes practical Python tasks with structured dark code examples", async () => {
  const [catalog, practical, enhancements, page, overlay, formatter, highlighter, deepLink, styles, validator, packageJson] = await Promise.all([
    readFile(projectFile("content/python-interview/catalog.ts"), "utf8"),
    readJson("content/python-interview/practical-qa.json"),
    readJson("content/python-interview/code-examples.json"),
    readFile(projectFile("app/interview/python/page.tsx"), "utf8"),
    readFile(projectFile("app/interview-question-code-overlay.tsx"), "utf8"),
    readFile(projectFile("app/interview-practical-formatting.ts"), "utf8"),
    readFile(projectFile("app/interview-code-highlighting.ts"), "utf8"),
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

  assert.match(overlay, /splitPythonPracticalExample/);
  assert.match(overlay, /createLegacyPythonSection/);
  assert.match(overlay, /question\.id\.startsWith\("py-"\)/);
  assert.match(overlay, /highlightInterviewCode\(source, language\)/);
  assert.match(overlay, /background: "#1e1e1e"/);
  assert.match(overlay, /whiteSpace: "pre"/);
  assert.match(overlay, /overflowX: "auto"/);
  assert.match(overlay, /legacyCopy\.style\.display = "none"/);
  assert.match(overlay, /practicalExample\.appendChild\(replacement\)/);
  assert.match(overlay, /navigator\.clipboard\.writeText\(code\)/);

  assert.match(formatter, /inlineCodePattern/);
  assert.match(formatter, /looksLikePythonCode/);
  assert.match(formatter, /splitPythonPracticalExample/);

  assert.match(highlighter, /const pythonKeywords = new Set/);
  assert.match(highlighter, /const pythonBuiltins = new Set/);
  assert.match(highlighter, /normalizedLanguage === "python"/);
  assert.match(highlighter, /"#6a9955"/);
  assert.match(highlighter, /"#ce9178"/);
  assert.match(highlighter, /"#b5cea8"/);
  assert.match(highlighter, /"#4ec9b0"/);

  assert.match(deepLink, /splitPythonPracticalExample\(displayExample\)/);
  assert.match(deepLink, /hasLegacyPythonCode/);
  assert.match(deepLink, /renderHighlightedCode\(segment\.text, "python"\)/);
  assert.match(deepLink, /renderHighlightedCode\(example\.code, example\.language\)/);
  assert.match(deepLink, /highlightInterviewCode\(source, language\)/);
  assert.match(deepLink, /Практичний приклад/);
  assert.match(styles, /background: #1e1e1e;/);
  assert.match(styles, /white-space: pre;/);
  assert.match(styles, /overflow-x: auto;/);

  assert.match(validator, /practical\.questions\.length, 18/);
  assert.match(validator, /codeEnhancements\.length, 19/);
  assert.match(validator, /example\.language, "python"/);
  assert.match(packageJson.scripts["check:content"], /validate-python-interview-content\.mjs/);
});