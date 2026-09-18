import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicAiEndpoint,
  withPublicAiSessionScope,
} from "../worker/request-policy.ts";

test("public AI bridge covers only the declared AI Assistant API surface", () => {
  const expected = [
    ["POST", "/api/ai/learning-path"],
    ["POST", "/api/ai/learning-path/stream"],
    ["GET", "/api/ai/interviews"],
    ["POST", "/api/ai/interviews"],
  ];

  for (const [method, path] of expected) {
    const request = new Request(`https://gimmejob.example${path}`, { method });
    assert.equal(isPublicAiEndpoint(request), true);
    assert.equal(withPublicAiSessionScope(request).headers.get("x-gimmejob-session-scope"), "ephemeral");
  }

  for (const path of ["/api/ai/private-future-route", "/api/settings", "/internal/n8n/email-events"]) {
    assert.equal(isPublicAiEndpoint(new Request(`https://gimmejob.example${path}`, { method: "POST" })), false);
  }
});
