import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleVacancyAutomationActivity } from "../app/internal/n8n/vacancies-sync/activity.ts";

const TOKEN = "test-ingest-token";

type Query = { sql: string; values: unknown[] };

function request(query: string, token: string | null = TOKEN): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://gimme-job.com/internal/n8n/vacancies-sync${query}`, { headers });
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
          if (sql.includes("FROM user_vacancy_audit_log")) {
            return { results: [{
              id: "audit-1",
              user_id: "user-a",
              job_id: "job-1",
              title: "QA Lead",
              company: "Example",
              actor_label: "GimmeJob automation",
              action: "status_changed",
              field: "status",
              before_value: "APPLIED",
              after_value: "INTERVIEW",
              metadata_json: JSON.stringify({ matchMethod: "COMPOSITE" }),
              created_at: "2026-08-19T10:00:00.000Z",
            }] as T[] };
          }
          return { results: [{
            id: "evt-1",
            user_id: "user-a",
            subject: "Interview invitation",
            classification: "INTERVIEW",
            classification_confidence: 0.97,
            classification_source: "OPENAI:gpt-5.6",
            summary: "Technical interview invitation.",
            company: "Example",
            job_title: "QA Lead",
            recruiter_name: "Anna",
            action: "PREPARE_INTERVIEW",
            classified_at: "2026-08-19T11:00:00.000Z",
            job_id: "job-1",
            match_status: "MATCHED",
            match_method: "COMPOSITE",
            match_confidence: 0.9,
            status_apply_note: "status_updated",
            resolved_at: "2026-08-19T11:00:01.000Z",
            status_applied_at: "2026-08-19T11:00:01.000Z",
            matched_title: "QA Lead",
            matched_company: "Example",
          }] as T[] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, queries };
}

test("daily automation activity reports vacancy mutations separately from email classification and resolution", async () => {
  const { database, queries } = fakeDb();
  const response = await handleVacancyAutomationActivity(
    request("?startUtc=2026-08-18T21%3A00%3A00.000Z&endUtc=2026-08-19T21%3A00%3A00.000Z&userId=user-a"),
    { DB: database, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, unknown>;
  assert.deepEqual(payload.window, {
    startUtc: "2026-08-18T21:00:00.000Z",
    endUtc: "2026-08-19T21:00:00.000Z",
  });
  assert.equal((payload.vacancyChanges as unknown[]).length, 1);
  assert.equal((payload.classifications as unknown[]).length, 1);
  assert.equal(payload.resolutionNeedsAttention, 0);
  const classification = (payload.classifications as Array<Record<string, unknown>>)[0];
  assert.deepEqual(classification.changedFields, [
    { field: "classification", value: "UNCLASSIFIED → INTERVIEW" },
    { field: "confidence", value: "97%" },
    { field: "company", value: "Example" },
    { field: "job title", value: "QA Lead" },
    { field: "recruiter", value: "Anna" },
    { field: "action", value: "PREPARE_INTERVIEW" },
  ]);
  assert.deepEqual(classification.resolution, {
    status: "MATCHED",
    jobId: "job-1",
    method: "COMPOSITE",
    confidence: 0.9,
    statusNote: "status_updated",
    resolvedAt: "2026-08-19T11:00:01.000Z",
    statusAppliedAt: "2026-08-19T11:00:01.000Z",
    matchedTitle: "QA Lead",
    matchedCompany: "Example",
  });
  assert.equal(queries.length, 2);
  assert.match(queries[0]?.sql ?? "", /audit\.actor_type = 'automation'/);
  assert.match(queries[1]?.sql ?? "", /WHEN 'OFFER' THEN 1/);
  assert.match(queries[1]?.sql ?? "", /WHEN 'REJECTION' THEN 5/);
});

test("daily automation activity requires bearer auth and validates the time window", async () => {
  const { database } = fakeDb();
  assert.equal((await handleVacancyAutomationActivity(
    request("?startUtc=2026-08-18T21%3A00%3A00.000Z&endUtc=2026-08-19T21%3A00%3A00.000Z", null),
    { DB: database, N8N_INGEST_TOKEN: TOKEN },
  )).status, 401);
  assert.equal((await handleVacancyAutomationActivity(
    request("?startUtc=bad&endUtc=2026-08-19T21%3A00%3A00.000Z"),
    { DB: database, N8N_INGEST_TOKEN: TOKEN },
  )).status, 400);
});

test("daily report workflow reconciles unresolved mail and renders detailed resolution activity", async () => {
  const workflow = JSON.parse(await readFile(
    new URL("../ops/n8n/workflows/gimmejob-daily-email-report.json", import.meta.url),
    "utf8",
  )) as { nodes: Array<{ name: string; parameters?: { jsCode?: string; url?: string } }>; connections: Record<string, unknown> };
  const reconciliationNode = workflow.nodes.find((node) => node.name === "Reconcile unresolved job emails");
  const activityNode = workflow.nodes.find((node) => node.name === "Get detailed automation activity");
  const formatNode = workflow.nodes.find((node) => node.name === "Format daily report");
  assert.match(reconciliationNode?.parameters?.url ?? "", /internal\/n8n\/email-resolve/);
  assert.match(activityNode?.parameters?.url ?? "", /internal\/n8n\/vacancies-sync/);
  assert.match(activityNode?.parameters?.url ?? "", /startUtc/);
  assert.match(formatNode?.parameters?.jsCode ?? "", /Vacancy changes by automation/);
  assert.match(formatNode?.parameters?.jsCode ?? "", /Email classification and vacancy resolution/);
  assert.match(formatNode?.parameters?.jsCode ?? "", /Needs vacancy linking/);
  assert.ok(Object.prototype.hasOwnProperty.call(workflow.connections, "Reconcile unresolved job emails"));
});
