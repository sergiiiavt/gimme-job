import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const migrationPath = "scripts/_agent-apply-personal-stars-prevalence.mjs";
let migrationLines = (await readFile(migrationPath, "utf8")).split("\n");
migrationLines = migrationLines.map((line) =>
  line.includes("assert.match(uiSource") && line.includes("className=") && line.includes("iq-star-filter")
    ? "  assert.match(uiSource, /iq-star-filter/);"
    : line,
);

const brittleBlockStart = migrationLines.findIndex((line, index) =>
  line === "await replaceExact(tests," && migrationLines.slice(index, index + 9).some((candidate) => candidate.includes("prevalences")),
);
assert.ok(brittleBlockStart >= 0, "Could not find the brittle test migration block.");
let brittleBlockEnd = brittleBlockStart + 1;
while (brittleBlockEnd < migrationLines.length && migrationLines[brittleBlockEnd] !== ");") brittleBlockEnd += 1;
assert.ok(brittleBlockEnd < migrationLines.length, "Could not find the end of the brittle test migration block.");
migrationLines.splice(brittleBlockStart, brittleBlockEnd - brittleBlockStart + 1);
await writeFile(migrationPath, migrationLines.join("\n"));

const testsPath = "tests/interview-catalog.test.mjs";
const testLines = (await readFile(testsPath, "utf8")).split("\n");
const migratedTestLines = [];
let insertedStarredState = false;
let replacedIsStarred = false;
let replacedMixedFilter = false;

for (const line of testLines) {
  migratedTestLines.push(line);
  if (!insertedStarredState && line.includes("const \\[prevalences, setPrevalences\\]")) {
    migratedTestLines.push("  assert.match(uiSource, /const \\[starredOnly, setStarredOnly\\] = useState\\(false\\)/);");
    insertedStarredState = true;
    continue;
  }
  if (line.includes('const isStarred = mode === "personal"')) {
    migratedTestLines.pop();
    migratedTestLines.push("  assert.match(uiSource, /const isStarred = Boolean\\(stars\\[item\\.id\\]\\);/);");
    replacedIsStarred = true;
    continue;
  }
  if (line.includes('prevalence === "Starred"')) {
    migratedTestLines.pop();
    migratedTestLines.push("  assert.match(uiSource, /const matchesPrevalence = prevalences\\.length === 0 \\|\\| prevalences\\.includes\\(item\\.prevalence\\);/);");
    migratedTestLines.push("  assert.match(uiSource, /const matchesStarred = !starredOnly \\|\\| \\(mode === \"personal\" && isStarred\\);/);");
    migratedTestLines.push("  assert.match(uiSource, /iq-star-filter/);");
    migratedTestLines.push("  assert.match(uiSource, />Starred only</);");
    replacedMixedFilter = true;
  }
}

assert.ok(insertedStarredState, "Did not find prevalence state assertion.");
assert.ok(replacedIsStarred, "Did not find mixed editorial/personal star assertion.");
assert.ok(replacedMixedFilter, "Did not find mixed prevalence/star assertion.");
await writeFile(testsPath, migratedTestLines.join("\n"));

console.log("Fixed temporary migration quoting and test assertions.");
