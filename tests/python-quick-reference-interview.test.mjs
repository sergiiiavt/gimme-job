import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const base = JSON.parse(await readFile(new URL("content/python-learning/quick-reference.json", root), "utf8"));
const guidance = JSON.parse(await readFile(new URL("content/python-learning/quick-reference-guidance.json", root), "utf8"));
const interview = JSON.parse(await readFile(new URL("content/python-learning/quick-reference-interview.json", root), "utf8"));

const allIds = new Set([
  ...base.cards.map((card) => card.id),
  ...guidance.theoryCards.map((card) => card.id),
  ...interview.cards.map((card) => card.id),
]);

test("Python quick reference prioritizes every published card exactly once", () => {
  assert.equal(interview.priority.length, allIds.size);
  assert.deepEqual(new Set(interview.priority.map((item) => item.id)), allIds);
});

test("Python interview layer covers automation-focused gaps", () => {
  const ids = new Set(interview.cards.map((card) => card.id));
  for (const id of [
    "context-managers",
    "decorators",
    "gil-concurrency-models",
    "pytest-fixtures",
    "http-automation",
    "timeout-polling-retry",
    "packaging-environments",
  ]) {
    assert.ok(ids.has(id), `Missing interview-focused Python card: ${id}`);
  }
});

test("Python interview priority is ordered by frequency band", () => {
  const rank = new Map([["Very common", 0], ["Common", 1], ["Occasional", 2], ["Specialist", 3]]);
  const values = interview.priority.map((item) => rank.get(item.frequency));
  assert.ok(values.every((value) => value !== undefined));
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] >= values[index - 1], `Priority band regressed at ${interview.priority[index].id}`);
  }
});
