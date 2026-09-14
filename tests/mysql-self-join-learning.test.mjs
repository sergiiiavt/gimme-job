import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const learningSource = readFileSync(
  new URL("../app/playgrounds/databases/mysql-self-join-learning.ts", import.meta.url),
  "utf8",
);
const playgroundSource = readFileSync(
  new URL("../app/playgrounds/databases/database-playground.tsx", import.meta.url),
  "utf8",
);

test("self-join lessons use real seeded tables instead of hidden CTE fixtures", () => {
  assert.doesNotMatch(learningSource, /\bWITH\s+(?:Weather|Activity)\b/i);
  assert.match(learningSource, /FROM Weather\s+AS today/);
  assert.match(learningSource, /FROM Activity\s+AS s/);
  assert.match(learningSource, /Inspect · Weather comparison data/);
  assert.match(learningSource, /Inspect · Activity process data/);
});

test("Weather lesson adds one idea at a time", () => {
  for (const step of [
    "Weather self-join · 1 · all pairs",
    "Weather self-join · 2 · consecutive days",
    "Weather self-join · 3 · warmer than yesterday",
    "Weather self-join · 4 · final answer",
  ]) assert.match(learningSource, new RegExp(step.replaceAll("·", "\\u00b7")));

  assert.match(learningSource, /CROSS JOIN Weather AS previous/);
  assert.match(learningSource, /DATEDIFF\(today\.recordDate, previous\.recordDate\) = 1/);
  assert.match(learningSource, /WHERE today\.temperature > previous\.temperature/);
  assert.match(learningSource, /sql: `SELECT today\.id\nFROM Weather AS today/);
  assert.match(learningSource, /If the requirement were 'compare with every earlier day'/);
});

test("Activity lesson builds pairing before arithmetic and aggregation", () => {
  for (const step of [
    "Process duration · 1 · all pairs",
    "Process duration · 2 · same machine",
    "Process duration · 3 · same process",
    "Process duration · 4 · start to end",
    "Process duration · 5 · calculate duration",
    "Process duration · 6 · average per machine",
  ]) assert.match(learningSource, new RegExp(step.replaceAll("·", "\\u00b7")));

  assert.match(learningSource, /ON s\.machine_id = e\.machine_id/);
  assert.match(learningSource, /AND s\.process_id = e\.process_id/);
  assert.match(learningSource, /WHERE s\.activity_type = 'start'\n  AND e\.activity_type = 'end'/);
  assert.match(learningSource, /e\.timestamp - s\.timestamp AS duration/);
  assert.match(learningSource, /ROUND\(AVG\(e\.timestamp - s\.timestamp\), 3\) AS processing_time/);
});

test("playground renders reasoning with the learning query and keeps it MySQL-only", () => {
  assert.match(playgroundSource, /MYSQL_SELF_JOIN_LEARNING_EXAMPLES/);
  assert.match(playgroundSource, /mysql \? MYSQL_SELF_JOIN_LEARNING_EXAMPLES/);
  assert.match(playgroundSource, /data-db-learning-note/);
  assert.match(playgroundSource, /Think: \{note\}/);
});
