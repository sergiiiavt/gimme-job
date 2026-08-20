import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveEmailEvent } from "../app/internal/n8n/email-events/vacancy-resolver.ts";
import { forwardedThreadId } from "../worker/email-forwarding.ts";

type FakeOptions = {
  emailReceivedAt?: string;
  statusUpdatedAt?: string | null;
};

function fakeResolutionDb(options: FakeOptions = {}) {
  const runs: Array<{ sql: string; values: unknown[] }> = [];
  const database = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first<T>() {
          if (sql.includes("FROM user_email_events") && sql.includes("WHERE user_id = ? AND id = ?")) {
            return {
              id: "evt-1",
              user_id: "user-1",
              received_at: options.emailReceivedAt ?? "2026-08-19T10:00:00.000Z",
              sender_email: "recruiter@ats.example",
              subject: "Application update",
              text_excerpt: "We will not proceed with your application for QA Lead.",
              classification: "REJECTION",
              company: "Example",
              job_title: "QA Lead",
              job_id: null,
              thread_id: null,
            } as T;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("instr(?, lower(jobs.url))")) return { results: [] as T[] };
          if (sql.includes("COALESCE(tracking.status, 'NEW') IN")) {
            return { results: [{
              id: "job-1",
              title: "QA Lead",
              company: "Example",
              url: "https://jobs.example/qa-lead",
              apply_url: "https://jobs.example/qa-lead/apply",
              external_id: "QA-12345",
              status: "APPLIED",
              status_updated_at: options.statusUpdatedAt ?? "2026-08-18T10:00:00.000Z",
            }] as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          runs.push({ sql, values });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, runs };
}

test("matched rejection safely moves an applied vacancy to rejected", async () => {
  const { database, runs } = fakeResolutionDb();
  const result = await resolveEmailEvent(database, "user-1", "evt-1");

  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.jobId, "job-1");
  assert.deepEqual(result.statusChange, { before: "APPLIED", after: "REJECTED" });
  assert.equal(result.statusNote, "status_updated");
  assert.ok(runs.some((entry) => /INSERT INTO job_tracking/.test(entry.sql) && entry.values.includes("REJECTED")));
  assert.ok(runs.some((entry) => /UPDATE user_vacancy_audit_log/.test(entry.sql) && entry.values.includes("automation")));
  assert.ok(runs.some((entry) => /match_status = \?/.test(entry.sql) && entry.values.includes("MATCHED")));
});

test("older rejection cannot overwrite a newer vacancy state", async () => {
  const { database, runs } = fakeResolutionDb({
    emailReceivedAt: "2026-08-18T10:00:00.000Z",
    statusUpdatedAt: "2026-08-19T10:00:00.000Z",
  });
  const result = await resolveEmailEvent(database, "user-1", "evt-1");

  assert.equal(result.matchStatus, "MATCHED");
  assert.equal(result.statusChange, null);
  assert.equal(result.statusNote, "stale_event");
  assert.ok(!runs.some((entry) => /INSERT INTO job_tracking/.test(entry.sql)));
});

test("forwarded replies share the root email thread id", () => {
  const root = new Headers({ "message-id": "<root@example.com>" });
  const reply = new Headers({
    "message-id": "<reply@example.com>",
    references: "<root@example.com> <previous@example.com>",
    "in-reply-to": "<previous@example.com>",
  });
  assert.equal(forwardedThreadId(root, "fallback-root"), "root@example.com");
  assert.equal(forwardedThreadId(reply, "fallback-reply"), "root@example.com");
});

test("n8n workflows resolve new mail and reconcile old mail before the daily report", async () => {
  const classifier = JSON.parse(await readFile(
    new URL("../ops/n8n/workflows/gimmejob-forwarded-email-classifier.json", import.meta.url),
    "utf8",
  )) as { nodes: Array<{ name: string; parameters?: { url?: string } }>; connections: Record<string, unknown> };
  const daily = JSON.parse(await readFile(
    new URL("../ops/n8n/workflows/gimmejob-daily-email-report.json", import.meta.url),
    "utf8",
  )) as { nodes: Array<{ name: string; parameters?: { url?: string; jsCode?: string } }>; connections: Record<string, unknown> };

  const resolver = classifier.nodes.find((node) => node.name === "Resolve vacancy and apply safe status");
  assert.match(resolver?.parameters?.url ?? "", /internal\/n8n\/email-resolve/);
  assert.match(JSON.stringify(classifier.connections), /Resolve vacancy and apply safe status/);

  const reconciliation = daily.nodes.find((node) => node.name === "Reconcile unresolved job emails");
  const formatter = daily.nodes.find((node) => node.name === "Format daily report");
  assert.match(reconciliation?.parameters?.url ?? "", /internal\/n8n\/email-resolve/);
  assert.match(formatter?.parameters?.jsCode ?? "", /Needs vacancy linking/);
  assert.match(formatter?.parameters?.jsCode ?? "", /Email classification and vacancy resolution/);
  assert.match(formatter?.parameters?.jsCode ?? "", /Matched:/);
});

test("important event query keeps rejection even when no action is required", async () => {
  const source = await readFile(new URL("../app/internal/n8n/email-stats/route.ts", import.meta.url), "utf8");
  assert.match(source, /classification = 'REJECTION' OR COALESCE\(action, 'NO_ACTION'\) <> 'NO_ACTION'/);
  assert.match(source, /WHEN 'REJECTION' THEN 5/);
});

test("private workspace mounts the unresolved-email panel only through personal mode", async () => {
  const route = await readFile(new URL("../app/vacancy-workspace-route.tsx", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/email-resolution-portal.tsx", import.meta.url), "utf8");
  assert.match(route, /EmailResolutionPortal enabled=\{mode === "personal"\}/);
  assert.match(portal, /\/api\/email-events\/unresolved/);
  assert.match(portal, /Choose vacancy/);
});
