import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, parseTsv, postgresGrid, statementKind, workspaceFor } from "../ops/hetzner/db-lab-api/server.mjs";

test("database lab assigns the same session to a bounded workspace", () => {
  const first = workspaceFor("db_session_repeatable_123");
  const second = workspaceFor("db_session_repeatable_123");
  assert.deepEqual(first, second);
  assert.ok(first.shard >= 0 && first.shard < 4);
  assert.match(first.mysqlDatabase, /^gimmejob_ws_[0-3]$/);
  assert.match(first.postgresSchema, /^ws_[0-3]$/);
  assert.equal(first.mysqlUser, first.postgresUser);
});

test("statementKind skips comments and identifies common SQL statements", () => {
  assert.equal(statementKind("SELECT 1"), "SELECT");
  assert.equal(statementKind("  -- inspect\nEXPLAIN SELECT * FROM users"), "EXPLAIN");
  assert.equal(statementKind("/* setup */ CREATE INDEX x ON orders(user_id)"), "CREATE");
});

test("TSV parser preserves headers, nulls and row values", () => {
  assert.deepEqual(parseTsv("id\tname\tnote\n1\tAlice\tNULL\n2\tBob\tok\n"), {
    columns: ["id", "name", "note"],
    rows: [["1", "Alice", null], ["2", "Bob", "ok"]],
    truncated: false,
  });
});

test("CSV parser handles commas and escaped quotes", () => {
  assert.deepEqual(parseCsv('id,note\n1,"hello, world"\n2,"a ""quote"""\n'), [
    ["id", "note"],
    ["1", "hello, world"],
    ["2", 'a "quote"'],
  ]);
});

test("PostgreSQL grid recognizes both rows and command tags", () => {
  assert.deepEqual(postgresGrid("id,name\n1,Alice\n"), {
    columns: ["id", "name"],
    rows: [["1", "Alice"]],
    truncated: false,
  });
  assert.deepEqual(postgresGrid("CREATE TABLE\n"), {
    columns: [],
    rows: [],
    truncated: false,
    command: "CREATE TABLE",
  });
});
