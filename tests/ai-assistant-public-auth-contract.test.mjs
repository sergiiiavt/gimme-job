import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrivateRequest,
  withPublicAiSessionScope,
} from "../worker/request-policy.ts";

test("AI Assistant public routes receive ephemeral scope and stay outside auth", () => {
  for (const [path, method] of [
    ["/api/ai/learning-path", "POST"],
    ["/api/ai/learning-path/stream", "POST"],
    ["/api/ai/interviews", "GET"],
    ["/api/ai/interviews", "POST"],
  ]) {
    const scoped = withPublicAiSessionScope(new Request(`https://gimmejob.example${path}`, { method }));
    assert.equal(scoped.headers.get("x-gimmejob-session-scope"), "ephemeral");
    assert.equal(isPrivateRequest(scoped), false);
  }
});

test("unknown AI routes and unsupported methods remain private", () => {
  for (const request of [
    new Request("https://gimmejob.example/api/ai/unknown", { method: "POST" }),
    new Request("https://gimmejob.example/api/ai/learning-path", { method: "GET" }),
  ]) {
    const scoped = withPublicAiSessionScope(request);
    assert.equal(scoped.headers.get("x-gimmejob-session-scope"), null);
    assert.equal(isPrivateRequest(scoped), true);
  }
});
