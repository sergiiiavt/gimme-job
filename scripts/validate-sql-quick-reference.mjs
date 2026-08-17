import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../content/data-learning/sql-quick-reference.json", import.meta.url), "utf8"));
const tasks = JSON.parse(readFileSync(new URL("../content/data-learning/sql-practical-tasks.json", import.meta.url), "utf8"));
const quickReferencePage = readFileSync(new URL("../app/quick-reference-page.tsx", import.meta.url), "utf8");
const requiredDialects = ["All", "Portable", "PostgreSQL", "MySQL", "SQLite", "SQL Server"];
const requiredTopics = ["All", "Core", "Filtering", "Aggregation", "Joins", "CTE & subquery", "Windows", "DML", "DDL", "Transactions", "Performance", "Functions", "QA patterns", "Dialect"];
const allowedTaskTopics = [...requiredTopics, "Tasks"];
assert.deepEqual(catalog.dialectFilters, requiredDialects, "SQL dialect filters changed unexpectedly");
assert.deepEqual(catalog.topicFilters, requiredTopics, "SQL topic filters changed unexpectedly");
assert.deepEqual(tasks.topicFilters, ["Tasks"], "practical SQL catalog must expose the Tasks topic");
assert.deepEqual(tasks.dialectFilters, [], "practical task catalog should reuse the main SQL dialect filters");
assert.ok(catalog.cards.length >= 18, "SQL reference should stay comprehensive without exploding into hundreds of cards");
assert.ok(tasks.cards.length >= 16, "SQL Tasks should cover a substantial practical interview/work set");
const ids = new Set();
for (const card of catalog.cards) {
  assert.match(card.id, /^[a-z0-9-]+$/, `invalid card id: ${card.id}`);
  assert.ok(!ids.has(card.id), `duplicate card id: ${card.id}`);
  ids.add(card.id);
  assert.ok(card.title && card.summary, `missing title/summary: ${card.id}`);
  assert.ok(Array.isArray(card.topics) && card.topics.length > 0, `missing topics: ${card.id}`);
  assert.ok(Array.isArray(card.dialects) && card.dialects.length > 0, `missing dialects: ${card.id}`);
  for (const topic of card.topics) assert.ok(requiredTopics.includes(topic), `unknown topic ${topic} in ${card.id}`);
  for (const dialect of card.dialects) assert.ok(requiredDialects.includes(dialect), `unknown dialect ${dialect} in ${card.id}`);
  assert.ok(Array.isArray(card.entries) && card.entries.length > 0, `missing entries: ${card.id}`);
  assert.ok(Array.isArray(card.more), `missing expandable rows array: ${card.id}`);
  for (const row of [...card.entries, ...card.more]) {
    assert.ok(row.term && row.detail, `incomplete row in ${card.id}`);
  }
}
for (const card of tasks.cards) {
  assert.match(card.id, /^task-[a-z0-9-]+$/, `practical SQL card id must start with task-: ${card.id}`);
  assert.ok(!ids.has(card.id), `duplicate SQL card id across reference/task catalogs: ${card.id}`);
  ids.add(card.id);
  assert.ok(card.title.startsWith("Task · "), `task title must read like a practical prompt: ${card.id}`);
  assert.ok(card.title && card.summary, `missing task title/summary: ${card.id}`);
  assert.ok(card.topics.includes("Tasks"), `task card must include Tasks topic: ${card.id}`);
  assert.ok(card.topics.some((topic) => topic !== "Tasks"), `task card must also map to a SQL concept topic: ${card.id}`);
  for (const topic of card.topics) assert.ok(allowedTaskTopics.includes(topic), `unknown task topic ${topic} in ${card.id}`);
  assert.ok(Array.isArray(card.dialects) && card.dialects.length > 0, `missing task dialects: ${card.id}`);
  for (const dialect of card.dialects) assert.ok(requiredDialects.includes(dialect), `unknown task dialect ${dialect} in ${card.id}`);
  assert.ok(Array.isArray(card.entries) && card.entries.length >= 2, `task needs answer plus explanation: ${card.id}`);
  assert.ok(Array.isArray(card.more), `missing task expandable rows array: ${card.id}`);
  for (const row of [...card.entries, ...card.more]) {
    assert.ok(row.term && row.meaning && row.detail, `task row needs label, explanation, and answer/detail: ${card.id}`);
  }
}
const portableText = JSON.stringify([
  ...catalog.cards.filter((card) => card.dialects.includes("Portable")),
  ...tasks.cards.filter((card) => card.dialects.includes("Portable")),
]);
for (const nonPortableFragment of [" = TRUE", " = FALSE", "WITH RECURSIVE"]) {
  assert.ok(!portableText.includes(nonPortableFragment), `portable SQL cards contain dialect-specific syntax: ${nonPortableFragment}`);
}
for (const id of ["select-skeleton", "joins", "window-ranking", "dml", "transactions", "indexes-explain", "qa-data-checks", "pagination-dialects", "upsert-returning", "date-dialects"]) {
  assert.ok(ids.has(id), `missing essential SQL card: ${id}`);
}
for (const id of ["task-find-duplicates", "task-return-all-duplicate-rows", "task-deduplicate-safely", "task-latest-row-per-entity", "task-second-highest", "task-top-n-per-group", "task-missing-related-rows", "task-compare-expected-actual", "task-running-total", "task-find-sequence-gaps", "task-conditional-aggregation", "task-keyset-pagination"]) {
  assert.ok(ids.has(id), `missing essential practical SQL task: ${id}`);
}
assert.ok(quickReferencePage.includes('flexDirection: "column"'), "SQL Topic and Dialect controls must render on separate rows");
assert.ok(quickReferencePage.includes('sqlPracticalTasks'), "SQL practical task catalog must be integrated into Quick Reference");
console.log(`SQL quick reference validation passed: ${catalog.cards.length} reference cards + ${tasks.cards.length} practical tasks`);
