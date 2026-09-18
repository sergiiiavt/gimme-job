import assert from "node:assert/strict";
import test from "node:test";
import { publicRateLimitPolicy } from "../worker/public-api-rate-limit.ts";
import { withPublicAiSessionScope } from "../worker/request-policy.ts";

const env = {};

test("only costly public AI methods receive an AI budget", () => {
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/learning-path", { method: "POST" }), env)?.routeGroup, "ai");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/learning-path/stream", { method: "POST" }), env)?.routeGroup, "ai");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/interviews", { method: "POST" }), env)?.routeGroup, "ai");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/interviews"), env), null);
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/ai/unknown", { method: "POST" }), env), null);
});

test("database playground POSTs receive their own budget", () => {
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/playgrounds/databases", { method: "POST" }), env)?.routeGroup, "database");
  assert.equal(publicRateLimitPolicy(new Request("https://gimme-job.com/api/playgrounds/databases"), env), null);
});

test("public AI session scope is granted only to the explicit public route contract", () => {
  const learning = withPublicAiSessionScope(new Request("https://gimme-job.com/api/ai/learning-path", { method: "POST" }));
  assert.equal(learning.headers.get("x-gimmejob-session-scope"), "ephemeral");

  const unknown = withPublicAiSessionScope(new Request("https://gimme-job.com/api/ai/unknown", { method: "POST" }));
  assert.equal(unknown.headers.get("x-gimmejob-session-scope"), null);

  const wrongMethod = withPublicAiSessionScope(new Request("https://gimme-job.com/api/ai/learning-path"));
  assert.equal(wrongMethod.headers.get("x-gimmejob-session-scope"), null);
});
