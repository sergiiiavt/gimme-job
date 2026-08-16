import assert from "node:assert/strict";
import test from "node:test";
import { createMultiUserBoundary } from "../worker/multi-user-boundary.ts";

type FakeEnv = { APP_PASSWORD?: string; MULTI_USER_ENABLED?: string; DB?: D1Database };
type CapturedCall = { request: Request; env: FakeEnv };

test("vacancy sync preserves bearer auth through the multi-user boundary", async () => {
  const calls: CapturedCall[] = [];
  const core = {
    async fetch(request: Request, env: FakeEnv): Promise<Response> {
      calls.push({ request, env });
      return Response.json({ core: true });
    },
  };
  const boundary = createMultiUserBoundary(core);
  const response = await boundary.fetch(
    new Request("https://gimmejob.example/internal/n8n/vacancies-sync", {
      method: "POST",
      headers: {
        authorization: "Bearer n8n-service-token",
        "x-gimmejob-auth-mode": "multi-user",
        "x-gimmejob-authenticated": "1",
        "x-gimmejob-user-id": "attacker-controlled-user",
      },
    }),
    { MULTI_USER_ENABLED: "true" },
    undefined,
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.request.headers.get("authorization"), "Bearer n8n-service-token");
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-auth-mode"), null);
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-authenticated"), null);
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-user-id"), null);
});
