import assert from "node:assert/strict";
import test from "node:test";
import { N8N_SERVICE_PATHS } from "../worker/request-policy.ts";

test("n8n service routes use one explicit bearer-auth allowlist", () => {
  assert.deepEqual([...N8N_SERVICE_PATHS].sort(), [
    "/internal/n8n/email-classify",
    "/internal/n8n/email-events",
    "/internal/n8n/email-resolve",
    "/internal/n8n/email-stats",
    "/internal/n8n/vacancies-sync",
  ]);
});
