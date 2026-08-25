import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modulesSource = readFileSync("content/data-learning/sql-modules.ts", "utf8");
const catalogSource = readFileSync("content/data-learning/catalog.ts", "utf8");
const sources = JSON.parse(readFileSync("content/data-learning/sources.json", "utf8"));
const pageSource = readFileSync("app/data-learning-page.tsx", "utf8");
const routeSource = readFileSync("app/learn/data/page.tsx", "utf8");
const navigationSource = readFileSync("app/navigation-paths.ts", "utf8");

const moduleIds = [
  "sql-foundations",
  "select-project-sort",
  "filtering-null-patterns",
  "expressions-functions-case",
  "joins-relationships",
  "aggregates-grouping",
  "subqueries-exists-sets",
  "ctes-query-structure",
  "window-functions",
  "dml-transactions",
  "ddl-constraints-design",
  "indexes-query-plans",
  "views-security-parameters",
  "advanced-query-patterns",
  "qa-data-validation",
  "dialects-production-sql",
  "sql-practice-roadmap",
];

test("SQL learning path publishes a complete reviewed curriculum surface", () => {
  for (const id of moduleIds) assert.match(modulesSource, new RegExp(`id: "${id}"`));
  assert.equal((modulesSource.match(/id: "/g) ?? []).length, moduleIds.length);
  assert.match(catalogSource, /status: "under-review"/);
  assert.match(pageSource, /"Under review"/);
  assert.match(pageSource, /runnable SQLite examples/);
  assert.match(routeSource, /DataLearningPage/);
  assert.match(navigationSource, /data: "\/learn\/data"/);
});

test("SQL learning path covers core, advanced, QA, performance, and security topics", () => {
  for (const phrase of [
    "SELECT, projection, DISTINCT & sorting",
    "Filtering, boolean logic, NULL & patterns",
    "JOINs & multi-table relationships",
    "Aggregates, GROUP BY & HAVING",
    "Subqueries, EXISTS & set operations",
    "CTEs & query decomposition",
    "Window functions",
    "INSERT, UPDATE, DELETE & transactions",
    "Tables, keys, constraints & schema design",
    "Indexes, EXPLAIN & query performance",
    "Views, parameters & SQL security",
    "SQL for QA & data validation",
    "SQL dialects & production habits",
  ]) assert.match(modulesSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("SQL curriculum has authoritative and practice-oriented references", () => {
  const ids = new Set(sources.map((source) => source.id));
  for (const id of [
    "w3schools-sql-syllabus",
    "postgresql-18-tutorial",
    "postgresql-18-queries",
    "postgresql-18-window",
    "sqlite-select",
    "sqlite-query-planner",
    "sqlbolt",
    "owasp-sql-injection",
  ]) assert.equal(ids.has(id), true, `missing source ${id}`);

  assert.equal(sources.every((source) => source.url.startsWith("https://")), true);
  assert.equal(sources.every((source) => source.role.length >= 40), true);
});

test("SQL modules contain executable learning examples and exercises", () => {
  assert.ok((modulesSource.match(/\$\{SQL\}/g) ?? []).length >= 25);
  assert.ok((modulesSource.match(/\*\*Practice:\*\*/g) ?? []).length >= 10);
  assert.match(modulesSource, /ROW_NUMBER\(\) OVER/);
  assert.match(modulesSource, /NOT EXISTS/);
  assert.match(modulesSource, /EXCEPT/);
  assert.match(modulesSource, /parameterized queries/i);
});
