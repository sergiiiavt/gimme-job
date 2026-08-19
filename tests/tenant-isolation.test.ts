import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createTenantState,
  requireTenantUser,
  tenantRequestContext,
  tenantUnavailable,
} from "../app/api/_tenant-state.ts";

type Row = Record<string, unknown>;

type TrackingRow = {
  user_id: string;
  job_id: string;
  status: string;
  status_updated_at: string | null;
  updated_at: string;
};

class FakeStatement {
  private readonly database: FakeDb;
  private readonly sql: string;
  private bindings: unknown[] = [];

  constructor(database: FakeDb, sql: string) {
    this.database = database;
    this.sql = sql;
  }

  bind(...values: unknown[]): FakeStatement {
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
  readonly settings = new Map<string, string>();
  readonly progress = new Map<string, Row>();
  readonly stars = new Map<string, Row>();
  readonly jobs = new Set<string>(["job-1", "job-2"]);
  readonly tracking = new Map<string, TrackingRow>();
  readonly gmail = new Map<string, Row>();
  readonly analyses = new Map<string, Row>();
  readonly resumes = new Map<string, Row>();
  readonly drafts = new Map<string, Row>();

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }

  private key(userId: unknown, itemId: unknown): string {
    return `${String(userId)}:${String(itemId)}`;
  }

  first(sql: string, values: unknown[]): Row | null {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("SELECT value_json FROM user_settings")) {
      const value = this.settings.get(this.key(values[0], values[1]));
      return value === undefined ? null : { value_json: value };
    }
    if (normalized.startsWith("SELECT email, status FROM gmail_connections")) {
      return this.gmail.get(String(values[0])) ?? null;
    }
    if (normalized.startsWith("SELECT id FROM jobs")) {
      return this.jobs.has(String(values[0])) ? { id: String(values[0]) } : null;
    }
    if (normalized.startsWith("SELECT status, status_updated_at FROM job_tracking")) {
      return this.tracking.get(this.key(values[0], values[1])) ?? null;
    }
    if (normalized.startsWith("SELECT pdf_base64 FROM user_resume_variants")) {
      return this.resumes.get(this.key(values[0], values[1])) ?? null;
    }
    if (normalized.startsWith("SELECT * FROM user_application_drafts")) {
      const userId = String(values[0]);
      const id = String(values[1]);
      return [...this.drafts.values()].find((row) => row.user_id === userId && row.id === id) ?? null;
    }
    throw new Error(`Unhandled first SQL: ${normalized}`);
  }

  all(sql: string, values: unknown[]): Row[] {
    const normalized = sql.replace(/\s+/g, " ").trim();
    const userId = String(values[0]);
    if (normalized.startsWith("SELECT question_id, status, updated_at FROM user_interview_progress")) {
      return [...this.progress.values()].filter((row) => row.user_id === userId);
    }
    if (normalized.startsWith("SELECT question_id, created_at FROM user_interview_stars")) {
      return [...this.stars.values()].filter((row) => row.user_id === userId);
    }
    if (normalized.startsWith("SELECT * FROM job_tracking")) {
      return [...this.tracking.values()].filter((row) => row.user_id === userId);
    }
    if (normalized.startsWith("SELECT * FROM user_analyses")) {
      return [...this.analyses.values()].filter((row) => row.user_id === userId);
    }
    if (normalized.startsWith("SELECT * FROM user_resume_variants")) {
      return [...this.resumes.values()].filter((row) => row.user_id === userId);
    }
    if (normalized.startsWith("SELECT * FROM user_application_drafts")) {
      return [...this.drafts.values()].filter((row) => row.user_id === userId);
    }
    throw new Error(`Unhandled all SQL: ${normalized}`);
  }

  run(sql: string, values: unknown[]): void {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("INSERT INTO user_settings")) {
      this.settings.set(this.key(values[0], values[1]), String(values[2]));
      return;
    }
    if (normalized.startsWith("DELETE FROM user_interview_progress")) {
      this.progress.delete(this.key(values[0], values[1]));
      return;
    }
    if (normalized.startsWith("INSERT INTO user_interview_progress")) {
      this.progress.set(this.key(values[0], values[1]), {
        user_id: String(values[0]),
        question_id: String(values[1]),
        status: String(values[2]),
        updated_at: String(values[3]),
      });
      return;
    }
    if (normalized.startsWith("DELETE FROM user_interview_stars")) {
      this.stars.delete(this.key(values[0], values[1]));
      return;
    }
    if (normalized.startsWith("INSERT INTO user_interview_stars")) {
      this.stars.set(this.key(values[0], values[1]), {
        user_id: String(values[0]),
        question_id: String(values[1]),
        created_at: String(values[2]),
      });
      return;
    }
    if (normalized.startsWith("INSERT INTO job_tracking")) {
      this.tracking.set(this.key(values[0], values[1]), {
        user_id: String(values[0]),
        job_id: String(values[1]),
        status: String(values[2]),
        status_updated_at: values[3] === null ? null : String(values[3]),
        updated_at: String(values[4]),
      });
      return;
    }
    if (normalized.startsWith("UPDATE user_application_drafts SET recipient")) {
      const draft = this.drafts.get(this.key(values[3], "job-1"));
      if (!draft || draft.id !== values[4]) throw new Error("Missing fake draft.");
      draft.recipient = String(values[0]);
      draft.status = "APPROVED";
      draft.approved_at = String(values[1]);
      draft.updated_at = String(values[2]);
      return;
    }
    if (normalized.startsWith("UPDATE user_application_drafts SET status = 'REJECTED'")) {
      const draft = [...this.drafts.values()].find((row) => row.user_id === values[1] && row.id === values[2]);
      if (!draft) throw new Error("Missing fake draft.");
      draft.status = "REJECTED";
      draft.approved_at = null;
      draft.updated_at = String(values[0]);
      return;
    }
    throw new Error(`Unhandled run SQL: ${normalized}`);
  }
}

function publicPayload() {
  return {
    jobs: [
      {
        id: "job-1",
        source: "DOU",
        title: "Senior QA Engineer",
        company: "Example",
        location: "Kyiv",
        remote: true,
        url: "https://example.com/job-1",
        applyUrl: "https://example.com/job-1",
        description: "Playwright role with бронювання",
        salaryText: "$5000",
        postedAt: "2026-08-15T10:00:00.000Z",
        discoveredAt: "2026-08-15T10:00:00.000Z",
      },
      {
        id: "job-2",
        source: "Djinni",
        title: "QA Engineer",
        company: "Other",
        location: "Remote",
        remote: true,
        url: "https://example.com/job-2",
        applyUrl: "https://example.com/job-2",
        description: "API testing",
        salaryText: null,
        postedAt: null,
        discoveredAt: "2026-08-14T10:00:00.000Z",
      },
    ],
  };
}

function state(database: FakeDb) {
  return createTenantState({
    database: database as unknown as D1Database,
    runtime: {
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "gpt-5.6",
    },
    loadPublicJobs: async () => publicPayload(),
  });
}

test("tenant request context requires an authenticated user id in multi-user mode", () => {
  const anonymous = tenantRequestContext(new Request("https://gimme-job.com/api/dashboard", {
    headers: { "x-gimmejob-auth-mode": "multi-user", "x-gimmejob-authenticated": "1" },
  }));
  assert.deepEqual(anonymous, { multiUser: true, userId: null, authenticated: false });

  const authenticated = tenantRequestContext(new Request("https://gimme-job.com/api/dashboard", {
    headers: {
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-a",
    },
  }));
  assert.deepEqual(authenticated, { multiUser: true, userId: "user-a", authenticated: true });
  assert.equal(requireTenantUser(new Request("https://gimme-job.com/", { headers: {
    "x-gimmejob-auth-mode": "multi-user",
    "x-gimmejob-authenticated": "1",
    "x-gimmejob-user-id": "user-a",
  } })), "user-a");
  assert.throws(() => requireTenantUser(new Request("https://gimme-job.com/")), /not enabled/);
});

test("settings and Gmail connection state are isolated by user", async () => {
  const database = new FakeDb();
  const tenant = state(database);
  database.gmail.set("user-a", { email: "a@example.com", status: "ACTIVE" });

  await tenant.saveSetting("user-a", "profile", { name: "A" });
  await tenant.saveSetting("user-b", "profile", { name: "B" });
  await tenant.saveSetting("user-a", "sources", { rss: [1], gmail: { enabled: true } });

  const a = await tenant.settingsView("user-a");
  const b = await tenant.settingsView("user-b");
  assert.deepEqual(a.profile, { name: "A" });
  assert.deepEqual(b.profile, { name: "B" });
  assert.equal(a.connections.gmail.connected, true);
  assert.equal(a.connections.gmail.email, "a@example.com");
  assert.equal(a.connections.gmail.enabled, true);
  assert.equal(b.connections.gmail.connected, false);
});

test("interview progress cannot cross tenant boundaries", async () => {
  const database = new FakeDb();
  const tenant = state(database);

  await tenant.updateInterviewProgress("user-a", "api-testing", { status: "learning" });
  await tenant.updateInterviewProgress("user-b", "api-testing", { status: "learned" });
  assert.equal((await tenant.interviewProgress("user-a")).progress[0]?.status, "LEARNING");
  assert.equal((await tenant.interviewProgress("user-b")).progress[0]?.status, "LEARNED");

  await tenant.updateInterviewProgress("user-a", "api-testing", { status: null });
  assert.equal((await tenant.interviewProgress("user-a")).progress.length, 0);
  assert.equal((await tenant.interviewProgress("user-b")).progress.length, 1);
  await assert.rejects(() => tenant.updateInterviewProgress("user-a", "BAD ID", { status: "LEARNING" }), /identifier/);
  await assert.rejects(() => tenant.updateInterviewProgress("user-a", "api-testing", { status: "DONE" }), /status/);
});

test("interview stars cannot cross tenant boundaries", async () => {
  const database = new FakeDb();
  const tenant = state(database);

  await tenant.updateInterviewStar("user-a", "api-testing", { starred: true });
  assert.deepEqual((await tenant.interviewStars("user-a")).starredQuestionIds, ["api-testing"]);
  assert.deepEqual((await tenant.interviewStars("user-b")).starredQuestionIds, []);

  await tenant.updateInterviewStar("user-b", "api-testing", { starred: true });
  assert.deepEqual((await tenant.interviewStars("user-a")).starredQuestionIds, ["api-testing"]);
  assert.deepEqual((await tenant.interviewStars("user-b")).starredQuestionIds, ["api-testing"]);

  await tenant.updateInterviewStar("user-a", "api-testing", { starred: false });
  assert.deepEqual((await tenant.interviewStars("user-a")).starredQuestionIds, []);
  assert.deepEqual((await tenant.interviewStars("user-b")).starredQuestionIds, ["api-testing"]);
  await assert.rejects(() => tenant.updateInterviewStar("user-a", "BAD ID", { starred: true }), /identifier/);
});

test("job status is tenant scoped", async () => {
  const database = new FakeDb();
  const tenant = state(database);

  const a = await tenant.updateJobTracking("user-a", "job-1", { status: "APPLIED" });
  const b = await tenant.updateJobTracking("user-b", "job-1", { status: "NOT_INTERESTED" });
  assert.equal(a.status, "APPLIED");
  assert.equal(b.status, "NOT_INTERESTED");
  assert.equal(database.tracking.get("user-a:job-1")?.status, "APPLIED");
  assert.equal(database.tracking.get("user-b:job-1")?.status, "NOT_INTERESTED");
  await assert.rejects(() => tenant.updateJobTracking("user-a", "missing", { status: "APPLIED" }), /not found/);
  await assert.rejects(() => tenant.updateJobTracking("user-a", "job-1", { status: "HACKED" }), /status/);
  await assert.rejects(() => tenant.updateJobTracking("user-a", "job-1", {}), /status/);
});

test("dashboard overlays only the current tenant private state", async () => {
  const database = new FakeDb();
  const tenant = state(database);
  await tenant.updateJobTracking("user-a", "job-1", { status: "INTERVIEW" });
  database.analyses.set("user-a:job-1", {
    user_id: "user-a",
    job_id: "job-1",
    payload_json: JSON.stringify({ verdict: "strong", requirementKeywords: ["Playwright"], missingSkills: ["K6"] }),
  });
  database.resumes.set("user-a:job-1", {
    user_id: "user-a",
    job_id: "job-1",
    id: "resume-a",
    markdown: "# Private A resume",
    pdf_base64: Buffer.from("pdf-a").toString("base64"),
  });
  database.drafts.set("user-a:job-1", {
    user_id: "user-a",
    job_id: "job-1",
    id: "draft-a",
    recipient: "hr@example.com",
    subject: "Application",
    body: "Private A draft",
    status: "PENDING_APPROVAL",
    approved_at: null,
    sent_at: null,
    provider_message_id: null,
    created_at: "2026-08-15T10:00:00.000Z",
    updated_at: "2026-08-15T10:00:00.000Z",
  });

  const a = await tenant.dashboard("user-a");
  const b = await tenant.dashboard("user-b");
  const anonymous = await tenant.dashboard(null);
  assert.equal(a.jobs[0]?.status, "INTERVIEW");
  assert.equal((a.jobs[0]?.analysis as Row)?.verdict, "strong");
  assert.equal(a.jobs[0]?.resume, "# Private A resume");
  assert.equal((a.jobs[0]?.draft as Row)?.body, "Private A draft");
  assert.equal(a.market.analyzedJobs, 1);
  assert.deepEqual(a.market.topRequirements, [{ name: "Playwright", count: 1 }]);
  assert.equal(b.jobs[0]?.status, "NEW");
  assert.equal(b.jobs[0]?.analysis, null);
  assert.equal(b.jobs[0]?.resume, null);
  assert.equal(anonymous.jobs[0]?.analysis, null);
  assert.equal(anonymous.authenticated, false);
});

test("resume PDF and draft mutations stay inside the tenant", async () => {
  const database = new FakeDb();
  const tenant = state(database);
  database.resumes.set("user-a:job-1", {
    user_id: "user-a",
    job_id: "job-1",
    pdf_base64: Buffer.from("tenant-a-pdf").toString("base64"),
  });
  database.drafts.set("user-a:job-1", {
    user_id: "user-a",
    job_id: "job-1",
    id: "draft-a",
    recipient: null,
    status: "PENDING_APPROVAL",
    subject: "Application",
    body: "Body",
    approved_at: null,
    sent_at: null,
    provider_message_id: null,
    created_at: "2026-08-15T10:00:00.000Z",
    updated_at: "2026-08-15T10:00:00.000Z",
  });

  assert.equal(Buffer.from((await tenant.resumePdf("user-a", "job-1")) ?? []).toString(), "tenant-a-pdf");
  assert.equal(await tenant.resumePdf("user-b", "job-1"), null);
  await tenant.updateDraft("user-a", "draft-a", "approve", "hr@example.com");
  assert.equal(database.drafts.get("user-a:job-1")?.status, "APPROVED");
  await assert.rejects(() => tenant.updateDraft("user-b", "draft-a", "approve", "x@example.com"), /not found/);
  await assert.rejects(() => tenant.updateDraft("user-a", "draft-a", "send"), /not configured/);
  await tenant.updateDraft("user-a", "draft-a", "reject");
  assert.equal(database.drafts.get("user-a:job-1")?.status, "REJECTED");
  await assert.rejects(() => tenant.updateDraft("user-a", "draft-a", "unknown"), /Unsupported/);
});

test("tenant migration scopes every private data family by user id", async () => {
  const sql = await readFile(new URL("../drizzle/0008_tenant_isolation.sql", import.meta.url), "utf8");
  for (const table of [
    "user_settings",
    "user_interview_progress",
    "job_tracking",
    "user_analyses",
    "user_resume_variants",
    "user_application_drafts",
    "user_email_events",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE \\\`${table}\\\``));
  }
  assert.match(sql, /user_email_events_provider_message_id_unique[^\n]*user_id/);
  assert.match(sql, /PRIMARY KEY \(`user_id`, `job_id`\)/);
});

test("interview stars migration keeps personal stars tenant-scoped", async () => {
  const sql = await readFile(new URL("../drizzle/0012_interview_stars.sql", import.meta.url), "utf8");

  assert.match(sql, /CREATE TABLE `user_interview_stars`/);
  assert.match(sql, /PRIMARY KEY \(`user_id`, `question_id`\)/);
  assert.match(sql, /FOREIGN KEY \(`user_id`\) REFERENCES `users`\(`id`\)[^\n]*ON DELETE cascade/);
});

test("interview star cleanup migration removes every pre-existing star", async () => {
  const sql = await readFile(new URL("../drizzle/0013_clear_interview_stars.sql", import.meta.url), "utf8");
  assert.match(sql, /DELETE FROM `user_interview_stars`/);
  assert.doesNotMatch(sql, /WHERE/);
});

test("tenant unavailable response is explicit and non-cacheable", async () => {
  const response = tenantUnavailable("Job analysis");
  assert.equal(response.status, 501);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(JSON.stringify(await response.json()), /tenant-scoped/);
});
