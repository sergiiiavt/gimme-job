import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

const reviewedCommit = "005202a18108c5b287fe98467f9dabfa93d17508";

test("desktop automation walkthrough stays pinned, bilingual and block-by-block", async () => {
  const source = await readFile(projectFile("content/automation-learning/desktop-automation-walkthrough.ts"), "utf8");
  const lessonIds = [...source.matchAll(/id:\s*"(ta-lesson-desktop-automation-[^"]+)"/g)].map((match) => match[1]);
  const lessonOrders = [...source.matchAll(/\n\s*order:\s*(\d+),/g)].map((match) => Number(match[1]));

  assert.match(source, /id: "desktop-automation-lab"/);
  assert.ok(source.includes(`const REVIEWED_COMMIT = "${reviewedCommit}"`));
  assert.ok(source.includes("reviewedUrl(spec.path)"));
  assert.equal(lessonIds.length, 23);
  assert.equal(new Set(lessonIds).size, lessonIds.length);
  assert.deepEqual(lessonOrders, Array.from({ length: 23 }, (_, index) => 49 + index));

  for (const language of ["text", "python", "xml", "csharp", "powershell", "yaml"]) {
    assert.ok(source.includes(`codeLanguage: "${language}"`), `Missing ${language} project block`);
  }

  for (const section of [
    "Actual project block",
    "What happens",
    "Why this block exists",
    "State before → after",
    "What breaks if you remove or change it",
    "Реальний блок проєкту",
    "Що відбувається",
    "Стан до → після",
  ]) {
    assert.ok(source.includes(section), `Missing walkthrough section: ${section}`);
  }

  for (const requiredSnippet of [
    "@pytest.fixture",
    "Desktop(backend=\\\"uia\\\")",
    "new UIA3Automation()",
    "[SetUp]",
    "[TearDown]",
    "dotnet test flaui/Notepad.Tests/Notepad.Tests.csproj",
    "python -m pytest python/tests -vv",
    "runs-on: windows-latest",
    "if: always()",
    "actions/upload-artifact@v7",
    "HETZNER_SSH_KEY",
    "github.event_name != 'pull_request'",
  ]) {
    assert.ok(source.includes(requiredSnippet), `Missing desktop-example content: ${requiredSnippet}`);
  }
});

test("test automation UI exposes Desktop Automation Example as focused second-panel topics", async () => {
  const [catalog, page] = await Promise.all([
    readFile(projectFile("content/automation-learning/catalog.ts"), "utf8"),
    readFile(projectFile("app/automation-learning-page.tsx"), "utf8"),
  ]);

  assert.match(catalog, /from "\.\/desktop-automation-walkthrough"/);
  assert.match(catalog, /\.\.\.desktopAutomationExampleLessons/);
  assert.match(catalog, /const desktopAutomationModules = \[/);

  for (const moduleId of [
    "desktop-automation-overview",
    "desktop-automation-python",
    "desktop-automation-dotnet",
    "desktop-automation-ci",
  ]) {
    assert.ok(catalog.includes(`id: "${moduleId}"`), `Missing desktop example module ${moduleId}`);
    assert.ok(page.includes(`"${moduleId}"`), `Desktop Automation Example track does not expose ${moduleId}`);
  }

  assert.match(page, /label: "Desktop Automation Example"/);
  assert.doesNotMatch(page, /label: "Real Projects"/);
  assert.match(catalog, /navLabel: "Overview"/);
  assert.match(catalog, /navLabel: "Python \+ pytest"/);
  assert.match(catalog, /navLabel: "C# \+ NUnit"/);
  assert.match(catalog, /navLabel: "CI \+ reporting"/);
});

test("Framework Reference uses main-branch links and an example in every section", async () => {
  const source = await readFile(projectFile("content/automation-learning/reference-framework.ts"), "utf8");
  const codeLanguages = [...source.matchAll(/codeLanguage:\s*"([^"]+)"/g)].map((match) => match[1]);

  assert.match(source, /label: "Framework Reference"/);
  assert.match(source, /blob\/main/);
  assert.match(source, /\[open on main\]/);
  assert.doesNotMatch(source, /\[live\]/);
  assert.doesNotMatch(source, /\[reviewed\]/);
  assert.doesNotMatch(source, /verifiedCommit/);
  assert.equal(codeLanguages.length, 8, "Every Framework Reference section must declare a code example");

  for (const sectionTitle of [
    "Repository shape",
    "pytest wiring and lifecycle",
    "Configuration architecture",
    "Web automation layer",
    "API and services layer",
    "Mobile automation layer",
    "Test data, assertions and reporting",
    "CI and execution model",
  ]) {
    assert.ok(source.includes(sectionTitle), `Missing Framework Reference section: ${sectionTitle}`);
  }
});
