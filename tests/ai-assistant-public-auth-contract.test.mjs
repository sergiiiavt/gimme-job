import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicAiEndpoint,
  isPublicEphemeralAiRequest,
  withPublicAiSessionScope,
} from "../worker/request-policy.ts";

test("AI Assistant public policy is exact and adds ephemeral scope before auth", () => {
  const publicCases = [
    ["POST", "/api/ai/learning-path"],
    ["POST", "/api/ai/learning-path/stream"],
    ["GET", "/api/ai/interviews"],
    ["POST", "/api/ai/interviews"],
  ];

  for (const [method, path] of publicCases) {
    const request = new Request(`https://example.com${path}`, { method });
    assert.equal(isPublicAiEndpoint(request), true, `${method} ${path}`);
    const scoped = withPublicAiSessionScope(request);
    assert.equal(scoped.headers.get("x-gimmejob-session-scope"), "ephemeral");
    assert.equal(isPublicEphemeralAiRequest(scoped), true);
  }

  for (const [method, path] of [
    ["GET", "/api/ai/learning-path"],
    ["GET", "/api/ai/learning-path/stream"],
    ["DELETE", "/api/ai/interviews"],
    ["POST", "/api/ai/future-route"],
    ["POST", "/api/jobs/1"],
  ]) {
    const request = new Request(`https://example.com${path}`, { method });
    assert.equal(isPublicAiEndpoint(request), false, `${method} ${path}`);
    assert.equal(withPublicAiSessionScope(request).headers.get("x-gimmejob-session-scope"), null);
  }
});
