import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [walkthroughSource, catalogSource, pageSource] = await Promise.all([
  readFile(new URL("../content/automation-learning/desktop-automation-walkthrough.ts", import.meta.url), "utf8"),
  readFile(new URL("../content/automation-learning/catalog.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/automation-learning-page.tsx", import.meta.url), "utf8"),
]);

const reviewedCommit = "005202a18108c5b287fe98467f9dabfa93d17508";
const lessonIds = [...walkthroughSource.matchAll(/id:\s*"(ta-lesson-desktop-automation-[^"]+)"/g)].map((match) => match[1]);
const lessonOrders = [...walkthroughSource.matchAll(/\n\s*order:\s*(\d+),/g)].map((match) => Number(match[1]));

assert.ok(walkthroughSource.includes('id: "desktop-automation-lab"'), "Desktop automation module must remain present.");
assert.ok(walkthroughSource.includes(`const REVIEWED_COMMIT = "${reviewedCommit}"`), "Walkthrough must stay pinned to the reviewed desktop-automation commit.");
assert.ok(walkthroughSource.includes("reviewedUrl(spec.path)"), "Each generated lesson concept must link its exact reviewed repository path.");

assert.equal(lessonIds.length, 23, "Desktop automation walkthrough must contain exactly 23 block-by-block lessons.");
assert.equal(new Set(lessonIds).size, lessonIds.length, "Desktop automation walkthrough lesson ids must be unique.");
assert.deepEqual(lessonOrders, Array.from({ length: 23 }, (_, index) => 49 + index), "Desktop automation lesson orders must remain contiguous from 49 through 71.");

for (const language of ["text", "python", "xml", "csharp", "powershell", "yaml"]) {
  assert.ok(walkthroughSource.includes(`codeLanguage: "${language}"`), `Walkthrough must retain a ${language} project block.`);
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
  assert.ok(walkthroughSource.includes(requiredSnippet), `Desktop automation walkthrough is missing required real-project content: ${requiredSnippet}`);
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
  assert.ok(walkthroughSource.includes(section), `Walkthrough presentation layer is missing section label: ${section}`);
}

assert.ok(catalogSource.includes('from "./desktop-automation-walkthrough"'), "Automation catalog must import the desktop walkthrough.");
assert.ok(catalogSource.includes("...desktopAutomationLessons"), "Automation catalog must include desktop walkthrough lessons.");
assert.ok(catalogSource.includes("...desktopAutomationSources"), "Automation catalog must include desktop walkthrough sources.");
assert.ok(catalogSource.includes("desktopAutomationModule"), "Automation catalog must include desktop walkthrough module taxonomy.");

assert.ok(pageSource.includes('id: "real-projects"'), "Automation page must expose the Real Projects track.");
assert.ok(pageSource.includes('moduleIds: ["desktop-automation-lab"]'), "Real Projects track must route to the desktop automation module.");

console.log(`Desktop automation walkthrough validated: ${lessonIds.length} lessons pinned to ${reviewedCommit.slice(0, 7)}.`);
