import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateRequest } from "../worker/request-policy.ts";

test("public vacancy detail reads stay public while mutations remain private", () => {
  const detailUrl = "https://gimme-job.com/api/public/jobs/job-123";
  assert.equal(isPrivateRequest(new Request(detailUrl), new URL(detailUrl)), false);
  assert.equal(isPrivateRequest(new Request(detailUrl, { method: "HEAD" }), new URL(detailUrl)), false);
  assert.equal(isPrivateRequest(new Request(detailUrl, { method: "POST" }), new URL(detailUrl)), true);
});
