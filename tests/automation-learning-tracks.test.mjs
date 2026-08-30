import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Test Automation uses eight module-scoped learning tracks", async () => {
  const page = await read("app/automation-learning-page.tsx");

  for (const [id, label] of [
    ["foundations", "Foundations"],
    ["python-setup", "Python Setup"],
    ["pytest", "pytest"],
    ["robot-framework", "Robot Framework"],
    ["automation", "Web / API / Mobile"],
    ["architecture", "Architecture"],
    ["real-projects", "Desktop Automation Example"],
    ["reference-framework", "Framework Reference"],
  ]) {
    assert.ok(page.includes(`id: "${id}"`), `Track ${id} must be present`);
    assert.ok(page.includes(`label: "${label}"`), `Track ${id} must use label ${label}`);
  }

  assert.match(page, /defaultTrackId="foundations"/);
  assert.match(page, /moduleIds: \["automation-foundations"\]/);
  assert.match(page, /moduleIds: \["project-setup"\]/);
  assert.match(page, /moduleIds: \["pytest-core"\]/);
  assert.match(page, /moduleIds: \["robot-framework"\]/);
  assert.match(page, /moduleIds: \["api-testing", "web-ui-testing", "mobile-testing", "contract-and-property"\]/);
  assert.match(page, /moduleIds: \["framework-architecture", "test-data", "flakiness", "ci-and-reporting", "quality-strategy"\]/);
  assert.match(page, /"desktop-automation-overview"/);
  assert.match(page, /"desktop-automation-python"/);
  assert.match(page, /"desktop-automation-dotnet"/);
  assert.match(page, /"desktop-automation-ci"/);
  assert.match(page, /moduleIds: \["reference-framework"\]/);
  assert.match(page, /referenceFrameworkModule/);
});

test("Test Automation track tabs fit inside the secondary navigation", async () => {
  const page = await read("app/automation-learning-page.tsx");

  assert.match(page, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(page, /\.kb-subnav-switch button/);
  assert.match(page, /min-width: 0/);
  assert.match(page, /white-space: normal/);
});

test("shared learning renderer filters the secondary navigation by selected track", async () => {
  const renderer = await read("app/learning-document-page.tsx");

  assert.match(renderer, /moduleIds\?: string\[\]/);
  assert.match(renderer, /selectedTrack\?\.moduleIds/);
  assert.match(renderer, /selectedModuleIds/);
  assert.match(renderer, /allModules\.filter/);
  assert.match(renderer, /router\.push\(contentHref/);
  assert.match(renderer, /topic: firstTrackModule\?\.id \?\? null/);
  assert.match(renderer, /track: trackId/);
});

test("Reference Framework is a real walkthrough with direct main-branch implementation links", async () => {
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

  assert.match(content, /blob\/main/);
  assert.doesNotMatch(content, /\[live\]/i);
  assert.doesNotMatch(content, /\[reviewed\]/i);
});