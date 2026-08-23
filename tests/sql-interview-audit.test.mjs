import assert from "node:assert/strict";
import test from "node:test";
import { applySqlInterviewAudit, sqlInterviewAudit } from "../content/interview/sql-interview-audit.ts";

const existingIds = [
  "relational-versus-nonrelational-databases",
  "sql-command-families",
  "database-keys-and-constraints",
  "sql-null-semantics",
  "sql-where-group-by-having",
  "sql-union-versus-union-all",
  "sql-find-duplicate-rows",
  "sql-find-orphan-records",
  "database-normalization-denormalization",
  "sql-subqueries-and-ctes",
  "sql-window-functions",
  "star-schema-facts-dimensions-grain",
  "bi-dashboard-reconciliation",
  "database-transactions-acid",
  "transaction-isolation-anomalies",
  "database-locks-and-deadlocks",
  "database-indexes",
  "sql-explain-query-plan",
  "composite-index-column-order",
  "database-schema-migrations",
  "database-data-types-and-boundaries",
  "database-test-data-isolation",
  "database-replication-backup-recovery",
  "sql-injection-parameterized-queries",
  "database-views-procedures-triggers",
  "etl-testing-basics",
  "data-quality-dimensions",
  "data-source-target-lineage",
  "data-batch-streaming-late-events",
  "data-upstream-schema-drift",
  "data-slowly-changing-dimensions",
  "data-sensitive-test-data",
  "bi-semantic-measures-calendars",
  "database-test-scope",
  "sql-joins-and-aggregation",
];

const practicalIds = [
  "sql-return-all-duplicate-rows",
  "sql-deduplicate-keep-latest",
  "sql-latest-row-per-group",
  "sql-second-highest-distinct-value",
  "sql-top-n-per-group",
  "sql-find-entities-without-related-rows",
  "sql-compare-expected-actual-datasets",
  "sql-running-total",
  "sql-compare-previous-row",
  "sql-find-sequence-gaps",
  "sql-conditional-aggregation",
  "sql-detect-join-multiplication",
  "sql-keyset-pagination",
  "sql-percent-of-total",
];

test("SQL audit covers all 49 interview questions exactly once", () => {
  const expected = new Set([...existingIds, ...practicalIds]);
  const actual = Object.keys(sqlInterviewAudit);
  assert.equal(actual.length, 49);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(new Set(actual), expected);
});

test("every SQL audit entry separates question scope from dialect and runtime", () => {
  const scopes = new Set(["SQL language", "Database concept", "DBMS-specific", "Data / ETL / BI"]);
  const dialects = new Set(["Portable SQL", "SQL standard", "PostgreSQL", "DBMS-dependent"]);
  for (const [id, audit] of Object.entries(sqlInterviewAudit)) {
    assert.ok(scopes.has(audit.scope), `${id}: invalid scope`);
    assert.ok(dialects.has(audit.dialect), `${id}: invalid dialect`);
    assert.ok(["sqlite", "static"].includes(audit.runtime.engine), `${id}: invalid runtime engine`);
    assert.ok(audit.runtime.note.length > 20, `${id}: missing runtime explanation`);
    assert.ok(audit.runtime.noteUk.length > 20, `${id}: missing Ukrainian runtime explanation`);
    if (audit.runtime.engine === "sqlite") {
      assert.equal(audit.runtime.fixture, "sql-playground-v1", `${id}: runnable SQL must declare the playground fixture`);
    }
  }
});

test("SQL standard and PostgreSQL examples are no longer conflated with SQLite", () => {
  const dateExample = sqlInterviewAudit["sql-where-group-by-having"];
  assert.equal(dateExample.dialect, "SQL standard");
  assert.equal(dateExample.runtime.engine, "static");
  assert.match(dateExample.runtime.note, /SQL-standard/);
  assert.match(dateExample.runtime.note, /SQLite/);

  for (const id of [
    "database-indexes",
    "sql-explain-query-plan",
    "database-schema-migrations",
    "database-data-types-and-boundaries",
    "sql-injection-parameterized-queries",
    "data-upstream-schema-drift",
  ]) {
    assert.equal(sqlInterviewAudit[id].dialect, "PostgreSQL", `${id}: should be explicitly PostgreSQL`);
    assert.equal(sqlInterviewAudit[id].runtime.engine, "static", `${id}: should not use the SQLite runner`);
  }
});

test("content audit fixes the identified correctness defects", () => {
  assert.match(sqlInterviewAudit["database-keys-and-constraints"].questionPatch.shortAnswer, /non-NULL/);
  assert.match(sqlInterviewAudit["sql-find-duplicate-rows"].questionPatch.example, /LOWER\(TRIM\(email\)\)/);
  assert.match(sqlInterviewAudit["database-normalization-denormalization"].questionPatch.example, /historical snapshot/);
  assert.match(sqlInterviewAudit["database-transactions-acid"].codePatch.explanation, /ACID does not prove the business rule/);
  assert.match(sqlInterviewAudit["transaction-isolation-anomalies"].questionPatch.shortAnswer, /serialization failure/i);
  assert.match(sqlInterviewAudit["sql-explain-query-plan"].questionPatch.example, /skew/);
  assert.match(sqlInterviewAudit["data-quality-dimensions"].codePatch.code, /missing_customer_id/);
  assert.doesNotMatch(sqlInterviewAudit["data-quality-dimensions"].codePatch.code, /CASE WHEN email IS NULL/);
  assert.match(sqlInterviewAudit["data-slowly-changing-dimensions"].codePatch.code, /SUM\(CASE WHEN is_current = TRUE THEN 1 ELSE 0 END\)/);
  assert.doesNotMatch(sqlInterviewAudit["data-slowly-changing-dimensions"].codePatch.code, /WHERE is_current = TRUE/);
  assert.match(sqlInterviewAudit["sql-second-highest-distinct-value"].codePatch.code, /WHERE salary IS NOT NULL/);
  assert.match(sqlInterviewAudit["sql-compare-previous-row"].codePatch.code, /rn > 1/);
  assert.match(sqlInterviewAudit["sql-compare-previous-row"].codePatch.code, /status IS NULL AND previous_status IS NOT NULL/);
  assert.match(sqlInterviewAudit["sql-running-total"].codePatch.code, /ORDER BY account_id, occurred_at, id;/);
});

test("applying an audit attaches scope, dialect, runtime and content corrections", () => {
  const question = {
    id: "sql-find-duplicate-rows",
    shortAnswer: "original",
    example: "original example",
    codeExamples: [{
      code: "SELECT email FROM users;",
      explanation: "original code explanation",
    }],
  };
  const audited = applySqlInterviewAudit(question);
  assert.equal(audited.sqlScope, "SQL language");
  assert.equal(audited.codeExamples[0].sqlDialect, "Portable SQL");
  assert.equal(audited.codeExamples[0].sqlRuntime.engine, "sqlite");
  assert.match(audited.example, /LOWER\(TRIM\(email\)\)/);
});
