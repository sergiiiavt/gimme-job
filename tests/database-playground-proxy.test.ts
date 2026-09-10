import assert from "node:assert/strict";
import test from "node:test";
import { handleDatabasePlayground } from "../app/api/playgrounds/databases/route.ts";

type Env = {
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";

function env(overrides: Partial<Env> = {}): Env {
  return {
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
    ...overrides,
  };
}

function request(body: unknown, method = "POST"): Request {
  return new Request("https://gimme-job.com/api/playgrounds/databases", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

async function withFetch(mock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("database playground proxies a real query without exposing the service token", async () => {
  let upstream: Request | null = null;
  await withFetch(async (input, init) => {
    upstream = new Request(input, init);
    return Response.json({
      engine: "mysql",
      workspace: "Workspace 1/4",
      statementType: "SELECT",
      columns: ["id"],
      rows: [["1"]],
      rowCount: 1,
      truncated: false,
      durationMs: 2.3,
      message: null,
    });
  }, async () => {
    const response = await handleDatabasePlayground(request({
      action: "query",
      engine: "mysql",
      sessionId: "db_session_12345",
      sql: "SELECT id FROM users LIMIT 1;",
    }), env());

    assert.equal(response.status, 200);
    assert.ok(upstream);
    assert.equal(upstream.url, "https://ai.gimme-job.internal/db-lab/v1/query");
    assert.equal(upstream.headers.get("authorization"), `Bearer ${SERVICE_TOKEN}`);
    assert.deepEqual(await upstream.json(), {
      engine: "mysql",
      sessionId: "db_session_12345",
      sql: "SELECT id FROM users LIMIT 1;",
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(JSON.stringify(await response.json()).includes(SERVICE_TOKEN), false);
  });
});

test("database playground proxies schema and reset actions", async () => {
  const urls: string[] = [];
  await withFetch(async (input, init) => {
    urls.push(new Request(input, init).url);
    return Response.json({ ok: true, tables: [] });
  }, async () => {
    for (const action of ["schema", "reset"] as const) {
      const response = await handleDatabasePlayground(request({
        action,
        engine: "postgres",
        sessionId: "db_session_12345",
      }), env());
      assert.equal(response.status, 200);
    }
  });
  assert.deepEqual(urls, [
    "https://ai.gimme-job.internal/db-lab/v1/schema",
    "https://ai.gimme-job.internal/db-lab/v1/reset",
  ]);
});

test("database playground rejects invalid client input before contacting upstream", async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return Response.json({ ok: true });
  }, async () => {
    assert.equal((await handleDatabasePlayground(request({ action: "query", engine: "sqlite", sessionId: "db_session_12345", sql: "SELECT 1" }), env())).status, 400);
    assert.equal((await handleDatabasePlayground(request({ action: "query", engine: "mysql", sessionId: "bad space", sql: "SELECT 1" }), env())).status, 400);
    assert.equal((await handleDatabasePlayground(request({ action: "query", engine: "mysql", sessionId: "db_session_12345", sql: "" }), env())).status, 400);
    assert.equal((await handleDatabasePlayground(request({}, "GET"), env())).status, 405);
  });
  assert.equal(calls, 0);
});

test("database playground handles provider errors and missing configuration", async () => {
  await withFetch(async () => Response.json({ error: "syntax error near FROM" }, { status: 400 }), async () => {
    const response = await handleDatabasePlayground(request({
      action: "query",
      engine: "postgres",
      sessionId: "db_session_12345",
      sql: "SELECT FROM",
    }), env());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "syntax error near FROM" });
  });

  const unavailable = await handleDatabasePlayground(request({
    action: "schema",
    engine: "mysql",
    sessionId: "db_session_12345",
  }), env({ GIMMEJOB_AI_URL: "" }));
  assert.equal(unavailable.status, 503);
});
