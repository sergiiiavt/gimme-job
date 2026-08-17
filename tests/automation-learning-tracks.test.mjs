import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Test Automation uses six module-scoped learning tracks", async () => {
  const page = await read("app/automation-learning-page.tsx");

  for (const [id, label] of [
    ["foundations", "Foundations"],
    ["python-setup", "Python Setup"],
    ["pytest", "pytest"],
    ["automation", "Web / API / Mobile"],
    ["architecture", "Architecture"],
    ["reference-framework", "Reference Framework"],
  ]) {
    assert.match(page, new RegExp(`id: "${id}"[^\\n]+label: "${label.replaceAll("/", "\\/")}"`));
  }

  assert.match(page, /defaultTrackId="foundations"/);
  assert.match(page, /moduleIds: \["automation-foundations"\]/);
  assert.match(page, /moduleIds: \["project-setup"\]/);
  assert.match(page, /moduleIds: \["pytest-core"\]/);
  assert.match(page, /moduleIds: \["api-testing", "web-ui-testing", "mobile-testing", "contract-and-property"\]/);
  assert.match(page, /moduleIds: \["framework-architecture", "test-data", "flakiness", "ci-and-reporting", "quality-strategy"\]/);
  assert.match(page, /moduleIds: \["reference-framework"\]/);
  assert.match(page, /referenceFrameworkModule/);
});

test("shared learning renderer filters the secondary navigation by selected track", async () => {
  const renderer = await read("app/learning-document-page.tsx");

  assert.match(renderer, /moduleIds\?: string\[\]/);
  assert.match(renderer, /selectedTrack\?\.moduleIds/);
  assert.match(renderer, /selectedModuleIds/);
  assert.match(renderer, /allModules\.filter/);
  assert.match(renderer, /setActiveModule\(firstTrackModule\?\.id/);
});

test("Reference Framework is a real walkthrough with direct implementation links", async () => {
  const content = await read("content/automation-learning/reference-framework.ts");

  for (const path of [
    "pyproject.toml",
    "conftest.py",
    "framework/config.py",
    "framework/web/base_page.py",
    "framework/web/pages.py",
    "framework/http/client.py",
    "framework/api/shop.py",
    "framework/mobile/driver_factory.py",
    "framework/mobile/base_screen.py",
    "framework/data/factories.py",
    "framework/utils/reporting.py",
    ".github/workflows/ci.yml",
  ]) {
    assert.ok(content.includes(`path: "${path}"`), `Reference walkthrough must link ${path}`);
  }

  assert.match(content, /\[live\]/);
  assert.match(content, /\[reviewed\]/);
  assert.match(content, /does not teach the same concepts again/i);
});
