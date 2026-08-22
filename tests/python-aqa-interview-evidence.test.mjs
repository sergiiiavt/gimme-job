import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

const expectedIds = [
  "py-aqa-pytest-markers-selection-xfail",
  "py-aqa-monkeypatch-vs-mock-patch",
  "py-aqa-pytest-xdist-parallel-isolation",
  "py-aqa-flaky-pytest-ci-diagnosis",
  "py-aqa-python-framework-design",
  "py-aqa-test-data-factories-isolation",
  "py-aqa-selenium-stale-dynamic-elements",
  "py-aqa-playwright-auto-waiting-locators",
  "py-aqa-playwright-browser-context-isolation",
];

test("adds only the reviewed current Python AQA interview set", async () => {
  const [aqa, sources] = await Promise.all([
    readJson("content/python-interview/aqa-specific-qa.json"),
    readJson("content/python-interview/aqa-interview-sources.json"),
  ]);

  assert.deepEqual(aqa.questions.map((question) => question.id), expectedIds);
  assert.equal(new Set(aqa.questions.map((question) => question.id)).size, expectedIds.length);
  assert.ok(sources.length >= 9);

  const sourceIds = new Set(sources.map((source) => source.id));
  for (const question of aqa.questions) {
    assert.equal(question.category, "Python AQA specific");
    assert.ok(question.sourceIds.some((sourceId) => sourceIds.has(sourceId)));
    assert.ok(question.questionUk?.trim());
    assert.ok(question.shortAnswerUk?.trim());
  }

  assert.ok(sourceIds.has("asserthired-pytest-2026"));
  assert.ok(sourceIds.has("sdet-qa-interviews-2026"));
  assert.ok(sourceIds.has("eleks-python-aqa-2026"));
  assert.ok(sourceIds.has("dou-selenium-python-framework-2025"));
  assert.ok(sourceIds.has("playwright-python-docs"));
  assert.ok(sourceIds.has("pytest-xdist-docs"));
});

test("keeps the Python AQA topic inside the existing canonical SEO route", async () => {
  const [catalog, pythonLayout, seo] = await Promise.all([
    readFile(projectFile("content/python-interview/catalog.ts"), "utf8"),
    readFile(projectFile("app/interview/python/layout.tsx"), "utf8"),
    readFile(projectFile("app/seo.ts"), "utf8"),
  ]);

  assert.match(catalog, /import aqaSpecific from "\.\/aqa-specific-qa\.json"/);
  assert.match(catalog, /version: 5/);
  assert.match(pythonLayout, /path: "\/interview\/python"/);
  assert.match(pythonLayout, /Python Interview Questions for QA Automation/);
  assert.match(seo, /"\/interview\/python"/);
  assert.doesNotMatch(seo, /interview\/python\/aqa/);
});
