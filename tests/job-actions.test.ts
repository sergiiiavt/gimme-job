import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { createJobActions } = await import("../app/api/_job-actions.ts");

type Row = Record<string, unknown>;

const sourceJob: Row = {
  id: "job-1",
  fingerprint: "fingerprint-1",
  source: "DOU",
  external_id: "1",
  title: "QA Lead",
  company: "Example",
  location: "Remote",
  remote: 1,
  url: "https://example.com/job-1",
  apply_url: "https://example.com/job-1",
  description: "Lead web and API testing with Playwright, SQL and test strategy. Бронювання.",
  salary_text: null,
  posted_at: "2026-08-16T10:00:00.000Z",
  contact_email: "hr@example.com",
  raw_json: "{}",
  discovered_at: "2026-08-16T10:00:00.000Z",
  updated_at: "2026-08-16T10:00:00.000Z",
  status: "NEW",
};

class FakeStatement {
  private bindings: unknown[] = [];
  private readonly database: FakeDb;
  private readonly sql: string;

  constructor(database: FakeDb, sql: string) {
    this.database = database;
    this.sql = sql;
  }

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.database.first(this.sql, this.bindings) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.all(this.sql, this.bindings) as T[] };
  }

  async run(): Promise<{ success: true }> {
    this.database.run(this.sql, this.bindings);
    return { success: true };
  }
}

class FakeDb {
  jobs = new Map<string, Row>([["job-1", { ...sourceJob }]]);
  userAnalyses = new Map<string, Row>();
  analyses = new Map<string, Row>();
  userResumes = new Map<string, Row>();
  resumes = new Map<string, Row>();
  userDrafts = new Map<string, Row>();
  drafts = new Map<string, Row>();
  lastLimit: number | null = null;

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  private normalized(sql: string) {
    return sql.replace(/\s+/g, " ").trim();
  }

  private userKey(userId: unknown, jobId: unknown) {
    return `${String(userId)}:${String(jobId)}`;
  }

  first(sql: string, values: unknown[]): Row | null {
    const normalized = this.normalized(sql);
    if (normalized.startsWith("SELECT value_json FROM user_settings")) return null;
    if (normalized.startsWith("SELECT value_json FROM settings")) return null;
    if (normalized.startsWith("SELECT status FROM user_application_drafts")) {
      return this.userDrafts.get(this.userKey(values[0], values[1])) ?? null;
    }
    if (normalized.startsWith("SELECT status FROM application_drafts")) {
      return this.drafts.get(String(values[0])) ?? null;
    }
    throw new Error(`Unhandled first SQL: ${normalized}`);
  }

  all(sql: string, values: unknown[]): Row[] {
    const normalized = this.normalized(sql);
    if (normalized.startsWith("SELECT * FROM jobs WHERE id")) {
      const row = this.jobs.get(String(values[0]));
      return row ? [{ ...row }] : [];
    }
    if (normalized.includes("LEFT JOIN user_analyses")) {
      const userId = String(values[0]);
      this.lastLimit = Number(values[1]);
      return [...this.jobs.values()]
        .filter((row) => !this.userAnalyses.has(this.userKey(userId, row.id)))
        .slice(0, this.lastLimit)
        .map((row) => ({ ...row }));
    }
    if (normalized.includes("LEFT JOIN analyses")) {
      this.lastLimit = Number(values[0]);
      return [...this.jobs.values()]
        .filter((row) => row.status !== "ARCHIVED" && !this.analyses.has(String(row.id)))
        .slice(0, this.lastLimit)
        .map((row) => ({ ...row }));
    }
    throw new Error(`Unhandled all SQL: ${normalized}`);
  }

  run(sql: string, values: unknown[]) {
    const normalized = this.normalized(sql);
    if (normalized.startsWith("INSERT INTO user_analyses")) {
      this.userAnalyses.set(this.userKey(values[0], values[1]), {
        user_id: values[0], job_id: values[1], mode: values[2], score: values[3], verdict: values[4], payload_json: values[5],
      });
      return;
    }
    if (normalized.startsWith("INSERT INTO analyses")) {
      this.analyses.set(String(values[0]), { job_id: values[0], mode: values[1], score: values[2], verdict: values[3], payload_json: values[4] });
      return;
    }
    if (normalized.startsWith("UPDATE jobs SET status = 'REVIEWED'")) {
      const row = this.jobs.get(String(values[1]));
      if (row) row.status = "REVIEWED";
      return;
    }
    if (normalized.startsWith("INSERT INTO user_resume_variants")) {
      this.userResumes.set(this.userKey(values[0], values[1]), { user_id: values[0], job_id: values[1], id: values[2], markdown: values[3], pdf_base64: values[4] });
      return;
    }
    if (normalized.startsWith("INSERT INTO resume_variants")) {
      this.resumes.set(String(values[0]), { job_id: values[0], id: values[1], markdown: values[2], pdf_base64: values[3] });
      return;
    }
    if (normalized.startsWith("INSERT INTO user_application_drafts")) {
      this.userDrafts.set(this.userKey(values[0], values[1]), {
        user_id: values[0], job_id: values[1], id: values[2], recipient: values[3], subject: values[4], body: values[5], status: "PENDING_APPROVAL",
      });
      return;
    }
    if (normalized.startsWith("INSERT INTO application_drafts")) {
      this.drafts.set(String(values[0]), { job_id: values[0], id: values[1], recipient: values[2], subject: values[3], body: values[4], status: "PENDING_APPROVAL" });
      return;
    }
    throw new Error(`Unhandled run SQL: ${normalized}`);
  }
}

function actions(database: FakeDb) {
  const events: Row[] = [];
  let snapshots = 0;
  const service = createJobActions({
    database: database as unknown as D1Database,
    runtime: { OPENAI_API_KEY: "", OPENAI_MODEL: "gpt-5.6" },
    renderPdfBase64: async () => "pdf-base64",
    recordEvent: async (event) => { events.push(event as unknown as Row); },
    recordSnapshot: async () => { snapshots += 1; },
    now: () => new Date("2026-08-16T12:00:00.000Z"),
  });
  return { service, events, snapshots: () => snapshots };
}

test("tenant analysis uses shared logic and writes only user-scoped analysis", async () => {
  const database = new FakeDb();
  const { service, events, snapshots } = actions(database);
  const result = await service.analyzeJobsForUser("user-a", undefined, 500);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "job-1");
  assert.equal(result[0].mode, "deterministic");
  assert.equal(database.userAnalyses.has("user-a:job-1"), true);
  assert.equal(database.analyses.size, 0);
  assert.equal(database.jobs.get("job-1")?.status, "NEW");
  assert.equal(database.lastLimit, 100);
  assert.equal(events[0].event, "job_analysis");
  assert.equal(events[0].status, "success");
  assert.equal(snapshots(), 1);
});

test("legacy owner analysis uses the same logic with global persistence", async () => {
  const database = new FakeDb();
  const { service } = actions(database);
  const result = await service.analyzeJobsForUser(null, undefined, 0);

  assert.equal(result.length, 1);
  assert.equal(database.analyses.has("job-1"), true);
  assert.equal(database.userAnalyses.size, 0);
  assert.equal(database.jobs.get("job-1")?.status, "REVIEWED");
  assert.equal(database.lastLimit, 1);
});

test("tenant resume generation stores private resume and draft", async () => {
  const database = new FakeDb();
  const { service, events } = actions(database);
  const result = await service.adjustResumeForUser("user-a", "job-1");

  assert.equal(result.id, "job-1");
  assert.equal(result.mode, "deterministic");
  assert.equal(database.userResumes.get("user-a:job-1")?.pdf_base64, "pdf-base64");
  assert.equal(database.userDrafts.get("user-a:job-1")?.status, "PENDING_APPROVAL");
  assert.equal(database.resumes.size, 0);
  assert.equal(events.at(-1)?.event, "resume_generation");
});

test("global resume generation uses the same orchestration and global tables", async () => {
  const database = new FakeDb();
  const { service } = actions(database);
  await service.adjustResumeForUser(null, "job-1");

  assert.equal(database.resumes.get("job-1")?.pdf_base64, "pdf-base64");
  assert.equal(database.drafts.get("job-1")?.status, "PENDING_APPROVAL");
  assert.equal(database.userResumes.size, 0);
});

test("approved or sent draft is not reset when resume is regenerated", async () => {
  const database = new FakeDb();
  database.userDrafts.set("user-a:job-1", { user_id: "user-a", job_id: "job-1", status: "SENT", subject: "existing" });
  const { service } = actions(database);
  await service.adjustResumeForUser("user-a", "job-1");

  assert.equal(database.userDrafts.get("user-a:job-1")?.status, "SENT");
  assert.equal(database.userDrafts.get("user-a:job-1")?.subject, "existing");
  assert.equal(database.userResumes.has("user-a:job-1"), true);
});

test("explicit unknown job fails cleanly", async () => {
  const database = new FakeDb();
  const { service } = actions(database);
  await assert.rejects(() => service.adjustResumeForUser("user-a", "missing"), /Job not found/);
});