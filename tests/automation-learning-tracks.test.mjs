import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  { AUTOMATION_DEFAULT_TRACK_ID, automationTrackAliases, automationTrackOptions },
  { robotFrameworkChapterIds },
] = await Promise.all([
  import("../content/automation-learning/tracks.ts"),
  import("../content/automation-learning/robot-framework-path.ts"),
]);

test("Test Automation uses six broad tracks without losing learning modules", async () => {
  assert.deepEqual(automationTrackOptions.map(({ id, label }) => [id, label]), [
    ["foundations", "Fundamentals & Architecture"],
    ["python-setup", "Python & pytest"],
    ["automation", "Web / API / Mobile"],
    ["real-projects", "Desktop Automation Example"],
    ["reference-framework", "Framework Reference"],
    ["robot-framework", "Robot Framework"],
  ], "Robot Framework remains a dedicated last track, after Framework Reference");
  assert.equal(AUTOMATION_DEFAULT_TRACK_ID, "foundations");

  const modules = Object.fromEntries(automationTrackOptions.map((option) => [option.id, option.moduleIds]));
  assert.deepEqual(modules.foundations, ["automation-foundations", "framework-architecture", "test-data", "flakiness", "ci-and-reporting", "quality-strategy"]);
  assert.deepEqual(modules["python-setup"], ["project-setup", "pytest-core"]);
  assert.deepEqual(modules.automation, ["api-testing", "web-ui-testing", "mobile-testing", "contract-and-property"]);
  assert.deepEqual(modules["real-projects"], ["desktop-automation-overview", "desktop-automation-python", "desktop-automation-dotnet", "desktop-automation-ci"]);
  assert.deepEqual(modules["reference-framework"], ["reference-framework"]);
  assert.deepEqual(modules["robot-framework"], robotFrameworkChapterIds);

  // The page renders exactly these tracks.
  const page = await read("app/automation-learning-page.tsx");
  assert.match(page, /trackOptions=\{automationTrackOptions\}/);
  assert.match(page, /defaultTrackId=\{AUTOMATION_DEFAULT_TRACK_ID\}/);
  assert.match(page, /referenceFrameworkModule/);
});

test("Test Automation track tabs fit inside the secondary navigation", async () => {
  const page = await read("app/automation-learning-page.tsx");

  assert.match(page, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(page, /\.kb-subnav-switch button/);
  assert.match(page, /min-width: 0/);
  assert.match(page, /white-space: normal/);
});

test("Test Automation removes visual groups and preserves old deep links", async () => {
  const page = await read("app/automation-learning-page.tsx");
  const renderer = await read("app/learning-document-page.tsx");

  assert.doesNotMatch(page, /trackGroups|kb-subnav-switch-group|data-grouped/);
  assert.match(page, /trackAliases=\{automationTrackAliases\}/);
  assert.deepEqual(automationTrackAliases, { architecture: "foundations", pytest: "python-setup" });
  assert.match(renderer, /trackAliases\?: Record<string, string>/);
  assert.match(renderer, /trackAliases\?\.\[requestedTrackId\] \?\? requestedTrackId/);
  assert.match(renderer, /resolvedTrackOptions\.some\(\(option\) => option\.id === canonicalTrackId\)/);
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
