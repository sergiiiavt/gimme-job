import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import test from "node:test";
import {
  createLabServer,
  MYSQL_BASE_FIXTURE_COUNTS,
  MYSQL_WORKSPACE_MARKER,
  mysqlArgs,
  mysqlBaseFixtureCountSql,
  parseCsv,
  parseTsv,
  postgresGrid,
  statementKind,
  workspaceFor,
} from "../ops/hetzner/db-lab-api/server.mjs";

test("HTTP adapter keeps request targets local and requires authorization on every SQL route", async (t) => {
  const server = createLabServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;

  async function send(path) {
    return new Promise((resolve, reject) => {
      const request = httpRequest({ hostname: "127.0.0.1", port, method: "POST", path }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      });
      request.on("error", reject);
      request.end("{}");
    });
  }

  for (const path of ["/v1/query", "/v1/schema", "/v1/reset", "/v1/query?source=browser"]) {
    assert.deepEqual(await send(path), { status: 401, body: { error: "Unauthorized." } });
  }
  for (const path of ["//example.invalid/v1/query", "http://example.invalid/v1/query", "/missing"]) {
    assert.deepEqual(await send(path), { status: 404, body: { error: "Not found." } });
  }
});

test("database lab assigns the same session to a bounded workspace", () => {
  const first = workspaceFor("db_session_repeatable_123");
  const second = workspaceFor("db_session_repeatable_123");
  assert.deepEqual(first, second);
  assert.ok(first.shard >= 0 && first.shard < 4);
  assert.match(first.mysqlDatabase, /^gimmejob_ws_[0-3]$/);
  assert.match(first.postgresSchema, /^ws_[0-3]$/);
  assert.equal(first.mysqlUser, first.postgresUser);
});

test("deployment smoke sessions cover every bounded workspace shard", () => {
  const sessions = [
    "deploy-smoke-shard-0",
    "deploy-smoke-shard-1",
    "deploy-smoke-shard-2",
    "deploy-smoke-shard-3",
  ];
  assert.deepEqual(sessions.map((sessionId) => workspaceFor(sessionId).shard).sort(), [0, 1, 2, 3]);
});

test("MySQL base fixture and workspace marker are versioned for seeded data", () => {
  assert.equal(MYSQL_BASE_FIXTURE_COUNTS, "10000:200:50000");
  assert.equal(MYSQL_WORKSPACE_MARKER, "__gimmejob_workspace_v3");
  assert.match(mysqlBaseFixtureCountSql(), /gimmejob_lab\.users/);
  assert.match(mysqlBaseFixtureCountSql(), /gimmejob_lab\.products/);
  assert.match(mysqlBaseFixtureCountSql(), /gimmejob_lab\.orders/);
});

test("MySQL fixture seed uses a reusable helper table instead of a temporary self-join", () => {
  const seedSql = readFileSync(new URL("../ops/hetzner/db-lab/mysql-init.sql", import.meta.url), "utf8");
  assert.doesNotMatch(seedSql, /CREATE\s+TEMPORARY\s+TABLE\s+digits/i);
  assert.match(seedSql, /CREATE\s+TABLE\s+__gimmejob_seed_digits/i);
  assert.match(seedSql, /CROSS\s+JOIN\s+__gimmejob_seed_digits\s+d4/i);
  assert.match(seedSql, /DROP\s+TABLE\s+__gimmejob_seed_digits/i);
});

test("statementKind skips comments and identifies common SQL statements", () => {
  assert.equal(statementKind("SELECT 1"), "SELECT");
  assert.equal(statementKind("  -- inspect\nEXPLAIN SELECT * FROM users"), "EXPLAIN");
  assert.equal(statementKind("/* setup */ CREATE INDEX x ON orders(user_id)"), "CREATE");
});

test("MySQL client preserves query headers and skips them only for scalar admin reads", () => {
  const withHeaders = mysqlArgs({
    user: "gjws_0",
    database: "gimmejob_ws_0",
    sql: "SELECT 1 AS ok;",
  });
  assert.ok(withHeaders.includes("--column-names"));
  assert.ok(!withHeaders.includes("--skip-column-names"));
  assert.ok(!withHeaders.includes("--silent"));

  const withoutHeaders = mysqlArgs({
    user: "root",
    database: "",
    sql: "SELECT 1;",
    skipHeaders: true,
  });
  assert.ok(withoutHeaders.includes("--skip-column-names"));
  assert.ok(!withoutHeaders.includes("--column-names"));
});

test("TSV parser preserves headers, nulls and row values", () => {
  assert.deepEqual(parseTsv("id\tname\tnote\n1\tAlice\tNULL\n2\tBob\tok\n"), {
    columns: ["id", "name", "note"],
    rows: [["1", "Alice", null], ["2", "Bob", "ok"]],
    truncated: false,
  });
  assert.deepEqual(parseTsv("ok\n1\n"), {
    columns: ["ok"],
    rows: [["1"]],
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
