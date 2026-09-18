import assert from "node:assert/strict";
import test from "node:test";
import { createMultiUserBoundary } from "../worker/multi-user-boundary.ts";

const SERVICE_PATHS = [
  "/internal/n8n/email-events",
  "/internal/n8n/email-classify",
  "/internal/n8n/email-resolve",
  "/internal/n8n/email-stats",
  "/internal/n8n/vacancies-sync",
];

test("n8n service routes preserve bearer auth and strip spoofed identity", async () => {
  const observed = [];
  const boundary = createMultiUserBoundary({
    async fetch(request) {
      observed.push({
        authorization: request.headers.get("authorization"),
        userId: request.headers.get("x-gimmejob-user-id"),
        authenticated: request.headers.get("x-gimmejob-authenticated"),
      });
      return new Response(null, { status: 204 });
    },
  });

  for (const path of SERVICE_PATHS) {
    const response = await boundary.fetch(
      new Request(`https://gimme-job.com${path}`, {
        method: "POST",
        headers: {
          authorization: "Bearer n8n-service-token",
          "x-gimmejob-user-id": "spoofed-user",
          "x-gimmejob-authenticated": "1",
        },
      }),
      {},
      {},
    );
    assert.equal(response.status, 204);
  }

  assert.equal(observed.length, SERVICE_PATHS.length);
  for (const request of observed) {
    assert.equal(request.authorization, "Bearer n8n-service-token");
    assert.equal(request.userId, null);
    assert.equal(request.authenticated, null);
  }
});
