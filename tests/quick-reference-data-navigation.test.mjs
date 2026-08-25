import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const referenceSource = readFileSync("app/quick-reference-page.tsx", "utf8");
const learningSource = readFileSync("app/data-learning-page.tsx", "utf8");

const dataTrackIds = ["sql", "database-integrity", "etl-and-elt", "data-quality", "bi-semantics-and-lineage"];

test("Data navigation uses a two-level track switcher like the automation learning path", () => {
  for (const id of dataTrackIds) {
    assert.match(referenceSource, new RegExp(`id: "${id}"`));
    assert.match(learningSource, new RegExp(`id: "${id}"`));
  }

  assert.match(referenceSource, /activeId: "sql"/);
  assert.match(learningSource, /defaultTrackId="sql"/);
  assert.match(referenceSource, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(learningSource, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(referenceSource, /\{ id: "all", label: "All topics"/);
});

test("SQL is the completed Data track and its real chapters render below the switcher", () => {
  assert.match(learningSource, /sqlModuleIds = sqlCurriculum\.taxonomy\.map/);
  assert.match(learningSource, /id: "sql", label: "SQL", available: true, moduleIds: sqlModuleIds/);
  assert.match(referenceSource, /return sqlCurriculum\.taxonomy\.map/);
  assert.match(referenceSource, /label: item\.navLabel \?\? item\.label/);
  assert.match(referenceSource, /count: item\.count \|\| undefined/);
  assert.match(referenceSource, /referenceId === "data" \? "sql" : undefined/);
  assert.match(referenceSource, /regularLearningHref\(referenceId, topicId, activeTrack\)/);
});

test("unfinished Data tracks are top-level choices with an Under construction state", () => {
  for (const id of dataTrackIds.slice(1)) {
    assert.match(learningSource, new RegExp(`id: "${id}"[^\n]+available: false`));
  }
  assert.match(learningSource, /learning path is under construction/);
});
