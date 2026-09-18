import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobPublicAiCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobPublicAiCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

function fakeDb() {
  const counters = new Map();
  return {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, " ").trim();
      const statement = {
        params: [],
        bind(...values) { statement.params = values; return statement; },
        async first() {
          if (text.startsWith("INSERT INTO public_request_limits")) {
            const key = statement.params.slice(0, 4).join("|");
            const count = (counters.get(key) ?? 0) + 1;
            counters.set(key, count);
            return { request_count: count };
          }
          return null;
        },
        async all() { return { results: [] }; },
        async run() { return { success: true }; },
      };
      return statement;
    },
  };
}

function envFor(db) {
  return {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "legacy-core-password",
    DB: db,
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

const context = { waitUntil() {}, passThroughOnException() {} };

test("built Worker serves the public database playground through its protected proxy", async (t) => {
  const { default: worker } = await import("../dist/server/index.js");
  const forwarded = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const upstream = new Request(input, init);
    forwarded.push(upstream);
    return Response.json({ engine: "mysql", columns: ["value"], rows: [["1"]] });
  });
  for (const mode of ["true", "false"]) {
    const env = {
      ...envFor(fakeDb()),
      MULTI_USER_ENABLED: mode,
      GIMMEJOB_AI_URL: "https://ai.gimmejob.example",
      GIMMEJOB_AI_SERVICE_TOKEN: "test-database-service-token",
    };
    const response = await worker.fetch(new Request("https://gimmejob.example/api/playgrounds/databases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "query", engine: "mysql", sessionId: "db_worker_test_123", sql: "SELECT 1 AS value" }),
    }), env, context);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).rows, [["1"]]);
    const upstream = forwarded.at(-1);
    assert.equal(upstream.url, "https://ai.gimmejob.example/db-lab/v1/query");
    assert.equal(upstream.headers.get("authorization"), "Bearer test-database-service-token");
    assert.equal(upstream.headers.get("cookie"), null);

    const unsupported = await worker.fetch(new Request("https://gimmejob.example/api/playgrounds/databases"), env, context);
    assert.equal(unsupported.status, 405);
    const privateResponse = await worker.fetch(new Request("https://gimmejob.example/api/settings"), env, context);
    assert.equal(privateResponse.status, 401);
  }
  assert.equal(forwarded.length, 2);
});

test("built Worker keeps the AI Assistant public without client auth or session headers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("public-ai-core-gate-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const db = fakeDb();
  const env = envFor(db);

  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";

  const interviewResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/ai/interviews"),
    env,
    context,
  );
  assert.equal(interviewResponse.status, 200);
  assert.deepEqual(await interviewResponse.json(), {
    persistent: false,
    recentSessions: [],
    areas: [],
  });

  const streamResponse = await worker.fetch(new Request("https://gimmejob.example/api/ai/learning-path/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Teach me test isolation" }],
      language: "en",
    }),
  }), env, context);
  assert.equal(streamResponse.status, 503);
  assert.deepEqual(await streamResponse.json(), { error: "AI learning path service is not configured." });
});


test("built Worker rate-limits repeated public AI requests by client", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("public-ai-rate-limit-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const db = fakeDb();
  const env = {
    ...envFor(db),
    PUBLIC_AI_RATE_LIMIT_PER_MINUTE: "2",
    PUBLIC_AI_RATE_LIMIT_PER_DAY: "100",
    PUBLIC_AI_GLOBAL_LIMIT_PER_MINUTE: "100",
    PUBLIC_AI_GLOBAL_LIMIT_PER_DAY: "1000",
  };

  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";

  const headers = { "cf-connecting-ip": "203.0.113.10" };
  const first = await worker.fetch(new Request("https://gimmejob.example/api/ai/interviews", { headers }), env, context);
  const second = await worker.fetch(new Request("https://gimmejob.example/api/ai/interviews", { headers }), env, context);
  const third = await worker.fetch(new Request("https://gimmejob.example/api/ai/interviews", { headers }), env, context);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  assert.ok(Number(third.headers.get("retry-after")) > 0);
});
