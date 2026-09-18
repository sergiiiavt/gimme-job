import assert from "node:assert/strict";
import test from "node:test";
import {
  enforcePublicApiRateLimit,
  publicRateLimitPolicy,
} from "../worker/public-api-rate-limit.ts";
import { withPublicAiSessionScope } from "../worker/request-policy.ts";

const env = {};

class FakeRateLimitDb {
  constructor(changes = [1, 1], error = null) {
    this.changes = [...changes];
    this.error = error;
    this.calls = [];
  }

  prepare(sql) {
    const call = { sql: sql.replace(/\s+/g, " ").trim(), bindings: [] };
    this.calls.push(call);
    const statement = {
      bind: (...values) => {
        call.bindings = values;
        return statement;
      },
      run: async () => {
        if (this.error) throw this.error;
        return { success: true, meta: { changes: this.changes.shift() ?? 1 } };
      },
    };
    return statement;
  }
}

test("only costly public AI methods receive an AI budget", () => {
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/learning-path", { method: "POST" }), env)?.routeGroup, "ai");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/learning-path/stream", { method: "POST" }), env)?.routeGroup, "ai");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/interviews", { method: "POST" }), env)?.routeGroup, "ai");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/interviews"), env), null);
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/unknown", { method: "POST" }), env), null);
});

test("rate-limit policy accepts positive overrides and rejects invalid ones", () => {
  const request = new Request("https://gimme-job.com/api/ai/learning-path", { method: "POST" });
  assert.deepEqual(
    publicRateLimitPolicy(request, {
      PUBLIC_AI_HOURLY_IP_LIMIT: "7",
      PUBLIC_AI_DAILY_GLOBAL_LIMIT: "19",
    }),
    { routeGroup: "ai", ipLimit: 7, globalLimit: 19 },
  );
  assert.deepEqual(
    publicRateLimitPolicy(request, {
      PUBLIC_AI_HOURLY_IP_LIMIT: "0",
      PUBLIC_AI_DAILY_GLOBAL_LIMIT: "not-a-number",
    }),
    { routeGroup: "ai", ipLimit: 30, globalLimit: 1_000 },
  );
});

test("database playground POSTs receive their own budget", () => {
  assert.deepEqual(
    publicRateLimitPolicy(new Request("https://gimme-job.com/api/playgrounds/databases", { method: "POST" }), {
      PUBLIC_DB_HOURLY_IP_LIMIT: "9",
      PUBLIC_DB_DAILY_GLOBAL_LIMIT: "33",
    }),
    { routeGroup: "database", ipLimit: 9, globalLimit: 33 },
  );
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/playgrounds/databases"), env), null);
});

test("successful public requests reserve hashed IP and global budgets", async () => {
  const db = new FakeRateLimitDb([1, 1]);
  const response = await enforcePublicApiRateLimit(
    new Request("https://gimme-job.com/api/ai/learning-path", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.42" },
    }),
    {
      DB: db,
      PUBLIC_AI_HOURLY_IP_LIMIT: "5",
      PUBLIC_AI_DAILY_GLOBAL_LIMIT: "50",
    },
  );

  assert.equal(response, null);
  assert.equal(db.calls.length, 2);
  assert.match(db.calls[0].sql, /^INSERT INTO public_api_rate_limits/);
  assert.equal(db.calls[0].bindings[1], "ai");
  assert.equal(db.calls[0].bindings[2], "IP");
  assert.match(String(db.calls[0].bindings[3]), /^[a-f0-9]{64}$/);
  assert.notEqual(db.calls[0].bindings[3], "203.0.113.42");
  assert.equal(db.calls[0].bindings.at(-1), 5);
  assert.equal(db.calls[1].bindings[2], "GLOBAL");
  assert.equal(db.calls[1].bindings[3], "all");
  assert.equal(db.calls[1].bindings.at(-1), 50);
});

test("an exhausted IP budget returns 429 without reserving the global budget", async () => {
  const db = new FakeRateLimitDb([0]);
  const response = await enforcePublicApiRateLimit(
    new Request("https://gimme-job.com/api/playgrounds/databases", { method: "POST" }),
    { DB: db },
  );

  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get("cache-control"), "no-store");
  assert.equal(response?.headers.get("x-content-type-options"), "nosniff");
  assert.ok(Number(response?.headers.get("retry-after")) > 0);
  assert.deepEqual(await response?.json(), { error: "Too many requests. Try again later." });
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].bindings[2], "IP");
  assert.match(String(db.calls[0].bindings[3]), /^[a-f0-9]{64}$/);
});

test("an exhausted global budget releases the IP reservation", async () => {
  const db = new FakeRateLimitDb([1, 0, 1]);
  const response = await enforcePublicApiRateLimit(
    new Request("https://gimme-job.com/api/ai/interviews", {
      method: "POST",
      headers: { "cf-connecting-ip": "198.51.100.7" },
    }),
    { DB: db },
  );

  assert.equal(response?.status, 429);
  assert.deepEqual(await response?.json(), { error: "Service request limit reached. Try again later." });
  assert.ok(Number(response?.headers.get("retry-after")) > 0);
  assert.equal(db.calls.length, 3);
  assert.equal(db.calls[1].bindings[2], "GLOBAL");
  assert.match(db.calls[2].sql, /^UPDATE public_api_rate_limits/);
  assert.equal(db.calls[2].bindings[3], "IP");
});

test("metered routes fail closed when D1 is unavailable or throws", async (t) => {
  const request = new Request("https://gimme-job.com/api/ai/learning-path", { method: "POST" });
  const missing = await enforcePublicApiRateLimit(request, {});
  assert.equal(missing?.status, 503);
  assert.deepEqual(await missing?.json(), { error: "Public request throttling is temporarily unavailable." });

  const errors = [];
  t.mock.method(console, "error", (...values) => errors.push(values));
  const failed = await enforcePublicApiRateLimit(request, {
    DB: new FakeRateLimitDb([], new Error("simulated D1 failure")),
  });
  assert.equal(failed?.status, 503);
  assert.deepEqual(await failed?.json(), { error: "Public request throttling is temporarily unavailable." });
  assert.equal(errors.length, 1);
});

test("unmetered requests bypass D1 entirely", async () => {
  assert.equal(
    await enforcePublicApiRateLimit(new Request("https://gimme-job.com/api/ai/interviews"), {}),
    null,
  );
});

test("public AI session scope is granted only to the explicit public route contract", () => {
  const learning = withPublicAiSessionScope(new Request("https://gimme-job.com/api/ai/learning-path", { method: "POST" }));
  assert.equal(learning.headers.get("x-gimmejob-session-scope"), "ephemeral");

  const unknown = withPublicAiSessionScope(new Request("https://gimme-job.com/api/ai/unknown", { method: "POST" }));
  assert.equal(unknown.headers.get("x-gimmejob-session-scope"), null);

  const wrongMethod = withPublicAiSessionScope(new Request("https://gimme-job.com/api/ai/learning-path"));
  assert.equal(wrongMethod.headers.get("x-gimmejob-session-scope"), null);
});
