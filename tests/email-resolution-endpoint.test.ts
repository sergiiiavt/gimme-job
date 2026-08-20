import assert from "node:assert/strict";
import test from "node:test";
import { handleEmailResolution } from "../app/internal/n8n/email-resolve/route.ts";
import { handleUnresolvedEmailEvents } from "../app/api/email-events/unresolved/route.ts";

const TOKEN = "test-ingest-token";

function n8nRequest(body: unknown, token: string | null = TOKEN): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("https://gimme-job.com/internal/n8n/email-resolve", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function privateRequest(): Request {
  return new Request("https://gimme-job.com/api/email-events/unresolved", {
    headers: {
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-1",
    },
  });
}

test("batch reconciliation is authenticated and bounded", async () => {
  const bindings: unknown[][] = [];
  const db = {
    prepare() {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          bindings.push(bound);
          return statement;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  const unauthorized = await handleEmailResolution(n8nRequest({}, null), { DB: db, N8N_INGEST_TOKEN: TOKEN });
  assert.equal(unauthorized.status, 401);

  const response = await handleEmailResolution(
    n8nRequest({ limit: 500, lookbackDays: 500 }),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(payload.processed, 0);
  assert.equal(payload.failed, 0);
  assert.equal(payload.lookbackDays, 90);
  assert.equal(bindings[0]?.at(-1), 100);
});

test("single-event resolution requires id and userId together", async () => {
  const db = { prepare() { throw new Error("should not query"); } } as unknown as D1Database;
  const response = await handleEmailResolution(
    n8nRequest({ id: "evt-1" }),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(response.status, 400);
});

test("private unresolved endpoint is tenant scoped and returns match evidence", async () => {
  const bindings: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      const statement = {
        bind(...bound: unknown[]) {
          bindings.push(bound);
          return statement;
        },
        async all<T>() {
          assert.match(sql, /match_status IN \('AMBIGUOUS', 'UNRESOLVED'\)/);
          return { results: [{
            id: "evt-1",
            subject: "Application update",
            classification: "REJECTION",
            summary: "We will not proceed.",
            company: null,
            job_title: "QA Lead",
            recruiter_name: null,
            received_at: "2026-08-19T10:00:00.000Z",
            match_status: "AMBIGUOUS",
            match_method: "COMPOSITE",
            match_confidence: 0.8,
            match_evidence_json: JSON.stringify({ candidates: [{ jobId: "job-1", score: 80 }] }),
            status_apply_note: "needs_manual_link",
          }] as T[] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  const response = await handleUnresolvedEmailEvents(privateRequest(), { DB: db });
  assert.equal(response.status, 200);
  const payload = await response.json() as { events: Array<Record<string, unknown>> };
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0]?.matchStatus, "AMBIGUOUS");
  assert.deepEqual(payload.events[0]?.evidence, { candidates: [{ jobId: "job-1", score: 80 }] });
  assert.deepEqual(bindings[0], ["user-1", 30]);

  const unauthorized = await handleUnresolvedEmailEvents(
    new Request("https://gimme-job.com/api/email-events/unresolved"),
    { DB: db },
  );
  assert.equal(unauthorized.status, 401);
});
