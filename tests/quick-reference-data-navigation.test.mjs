import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const referenceSource = readFileSync("app/quick-reference-page.tsx", "utf8");
const publicSource = readFileSync("app/public-site.tsx", "utf8");

test("data Quick Reference keeps the data topic list and exits to selected normal topic", () => {
  assert.match(referenceSource, /referenceId === "data"/);
  for (const id of ["sql-foundations", "database-integrity", "etl-and-elt", "data-quality", "bi-semantics-and-lineage"]) assert.match(referenceSource, new RegExp(id));
  assert.match(referenceSource, /window\.location\.assign\(regularLearningHref\(referenceId, topicId, activeTrack\)\)/);
  assert.match(publicSource, /searchParams\.get\("topic"\) \?\? "all"/);
});
