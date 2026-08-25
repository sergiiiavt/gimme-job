import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const referenceSource = readFileSync("app/quick-reference-page.tsx", "utf8");

test("data Quick Reference separates the completed SQL path from future data topics", () => {
  assert.match(referenceSource, /referenceId === "data"/);
  assert.match(referenceSource, /\{ id: "sql", label: "SQL", count: 17 \}/);
  assert.doesNotMatch(referenceSource, /\{ id: "all", label: "All topics"/);
  assert.doesNotMatch(referenceSource, /label: "SQL foundations", status: "under-construction"/);

  for (const id of ["database-integrity", "etl-and-elt", "data-quality", "bi-semantics-and-lineage"]) {
    assert.match(referenceSource, new RegExp(`id: "${id}"[^\n]+status: "under-construction"`));
  }
});

test("data Quick Reference opens SQL without pretending unfinished topics are SQL chapters", () => {
  assert.match(referenceSource, /if \(referenceId === "data"\)/);
  assert.match(referenceSource, /if \(topicId === "sql"\) window\.location\.assign\(regularLearningHref\(referenceId\)\)/);
  assert.match(referenceSource, /window\.location\.assign\(regularLearningHref\(referenceId, topicId, activeTrack\)\)/);
});
