import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleVacancyAudit } from "../app/api/jobs/[jobId]/audit/route.ts";

type Query = { sql: string; values: unknown[] };

function authenticatedRequest(userId = "user-a"): Request {
  return new Request("https://gimme-job.com/api/jobs/job-1/audit", {
    headers: {
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": userId,
    },
  });
}

function fakeDb() {
  const queries: Query[] = [];
  const database = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          queries.push({ sql, values });
          return statement;
        },
        async all<T>() {
          return {
            results: [{
              id: "audit-1",
              job_id: "job-1",
              actor_type: "automation",
              actor_label: "GimmeJob automation",
              action: "analysis_created",
              field: "analysis",
              before_value: null,
              after_value: "91/100 · strong",
              metadata_json: JSON.stringify({ mode: "agent" }),
              created_at: "2026-08-20T00:00:00.000Z",
            }] as T[],
          };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, queries };
}

test("vacancy audit is tenant-scoped and maps actor/change details", async () => {
  const { database, queries } = fakeDb();
  const response = await handleVacancyAudit(authenticatedRequest(), { DB: database }, "job-1");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    jobId: "job-1",
    entries: [{
      id: "audit-1",
      jobId: "job-1",
      actorType: "automation",
      actorLabel: "GimmeJob automation",
      action: "analysis_created",
      field: "analysis",
      beforeValue: null,
      afterValue: "91/100 · strong",
      metadata: { mode: "agent" },
      createdAt: "2026-08-20T00:00:00.000Z",
    }],
  });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]?.values, ["user-a", "job-1", 100]);
  assert.match(queries[0]?.sql ?? "", /WHERE user_id = \? AND job_id = \?/);
});

test("vacancy audit rejects unauthenticated access", async () => {
  const response = await handleVacancyAudit(
    new Request("https://gimme-job.com/api/jobs/job-1/audit"),
    { DB: fakeDb().database },
    "job-1",
  );
  assert.equal(response.status, 401);
});

test("audit migration captures user and automation mutation paths without no-op status entries", async () => {
  const sql = await readFile(new URL("../drizzle/0014_vacancy_audit_log.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE `user_vacancy_audit_log`/);
  assert.match(sql, /CREATE TRIGGER `audit_job_tracking_update`/);
  assert.match(sql, /WHEN OLD\.status <> NEW\.status/);
  assert.match(sql, /'user', 'You', 'status_changed'/);
  assert.match(sql, /CREATE TRIGGER `audit_user_analyses_update`/);
  assert.match(sql, /'automation', 'GimmeJob automation', 'analysis_regenerated'/);
  assert.match(sql, /CREATE TRIGGER `audit_user_resume_variants_update`/);
  assert.match(sql, /CREATE TRIGGER `audit_user_application_drafts_user_status`/);
});
