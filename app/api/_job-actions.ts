import {
  CandidateProfileSchema,
  type CandidateProfile,
  type StoredJob,
} from "../../agent/src/domain.js";
import {
  adjustResumeWithOpenAi,
  analyzeJobWithOpenAi,
  type JobIntelligenceMode,
} from "../../agent/src/job-intelligence.js";
import { buildResumePdf, bytesToBase64 } from "../../agent/src/resume-pdf.js";
import {
  DEFAULT_PROFILE,
  recordObservabilityEvent,
  recordObservabilitySnapshot,
} from "./_jobpilot";

type Row = Record<string, unknown>;

type CloudJobEnv = {
  DB?: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type JobActionDependencies = {
  database: D1Database;
  runtime?: Pick<CloudJobEnv, "OPENAI_API_KEY" | "OPENAI_MODEL">;
  renderPdfBase64?: (markdown: string) => Promise<string>;
  recordEvent?: typeof recordObservabilityEvent;
  recordSnapshot?: typeof recordObservabilitySnapshot;
  now?: () => Date;
};

type StorageScope = {
  userId: string | null;
  analysisTable: "analyses" | "user_analyses";
  resumeTable: "resume_variants" | "user_resume_variants";
  draftTable: "application_drafts" | "user_application_drafts";
  conflictKey: "job_id" | "user_id, job_id";
  userColumn: "" | "user_id, ";
  userPlaceholder: "" | "?, ";
  userBindings: string[];
};

async function runtimeEnv(): Promise<CloudJobEnv> {
  return (await import("cloudflare:workers")).env as unknown as CloudJobEnv;
}

function storageScope(userId: string | null): StorageScope {
  return userId
    ? {
        userId,
        analysisTable: "user_analyses",
        resumeTable: "user_resume_variants",
        draftTable: "user_application_drafts",
        conflictKey: "user_id, job_id",
        userColumn: "user_id, ",
        userPlaceholder: "?, ",
        userBindings: [userId],
      }
    : {
        userId: null,
        analysisTable: "analyses",
        resumeTable: "resume_variants",
        draftTable: "application_drafts",
        conflictKey: "job_id",
        userColumn: "",
        userPlaceholder: "",
        userBindings: [],
      };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function mapJob(row: Row, timestamp: string): StoredJob {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint ?? row.id),
    source: String(row.source ?? "unknown"),
    externalId: row.external_id ? String(row.external_id) : null,
    title: String(row.title ?? ""),
    company: String(row.company ?? "Unknown"),
    location: String(row.location ?? "Unknown"),
    remote: Boolean(row.remote),
    url: String(row.url ?? ""),
    applyUrl: String(row.apply_url ?? row.url ?? ""),
    description: String(row.description ?? ""),
    salaryText: row.salary_text ? String(row.salary_text) : null,
    postedAt: row.posted_at ? String(row.posted_at) : null,
    contactEmail: row.contact_email ? String(row.contact_email) : null,
    raw: parseJson(row.raw_json ?? {}),
    discoveredAt: String(row.discovered_at ?? timestamp),
    updatedAt: String(row.updated_at ?? timestamp),
    status: ["NEW", "REVIEWED", "ARCHIVED"].includes(String(row.status))
      ? String(row.status) as StoredJob["status"]
      : "NEW",
  };
}

function scopeWhere(scope: StorageScope, column: string): { sql: string; bindings: string[] } {
  return scope.userId
    ? { sql: `user_id = ? AND ${column}`, bindings: scope.userBindings }
    : { sql: column, bindings: [] };
}

export function createJobActions(dependencies: JobActionDependencies) {
  const db = dependencies.database;
  const runtime = dependencies.runtime ?? {};
  const timestamp = () => (dependencies.now ?? (() => new Date()))().toISOString();
  const recordEvent = dependencies.recordEvent ?? recordObservabilityEvent;
  const recordSnapshot = dependencies.recordSnapshot ?? recordObservabilitySnapshot;
  const renderPdfBase64 = dependencies.renderPdfBase64
    ?? (async (markdown: string) => bytesToBase64(await buildResumePdf(markdown)));

  async function candidateProfile(userId: string | null): Promise<CandidateProfile> {
    const scope = storageScope(userId);
    const row = scope.userId
      ? await db.prepare("SELECT value_json FROM user_settings WHERE user_id = ? AND key = 'profile' LIMIT 1")
          .bind(scope.userId).first<Row>()
      : await db.prepare("SELECT value_json FROM settings WHERE key = 'profile' LIMIT 1").first<Row>();
    return CandidateProfileSchema.parse(row ? parseJson(row.value_json) : DEFAULT_PROFILE);
  }

  async function pendingJobs(jobId: string | undefined, limit: number, userId: string | null): Promise<StoredJob[]> {
    const mappedAt = timestamp();
    if (jobId) {
      const result = await db.prepare("SELECT * FROM jobs WHERE id = ? LIMIT 1").bind(jobId).all<Row>();
      if (!result.results.length) throw new Error("Job not found.");
      return result.results.map((row) => mapJob(row, mappedAt));
    }

    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const scope = storageScope(userId);
    const userJoin = scope.userId ? " AND saved.user_id = ?" : "";
    const globalFilter = scope.userId ? "" : " AND jobs.status <> 'ARCHIVED'";
    const result = await db.prepare(`SELECT jobs.* FROM jobs
      LEFT JOIN ${scope.analysisTable} AS saved ON saved.job_id = jobs.id${userJoin}
      WHERE saved.job_id IS NULL${globalFilter}
      ORDER BY jobs.discovered_at DESC LIMIT ?`)
      .bind(...scope.userBindings, safeLimit)
      .all<Row>();
    return result.results.map((row) => mapJob(row, mappedAt));
  }

  async function saveAnalysis(
    userId: string | null,
    job: StoredJob,
    mode: JobIntelligenceMode,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const scope = storageScope(userId);
    const updatedAt = timestamp();
    await db.prepare(`INSERT INTO ${scope.analysisTable} (${scope.userColumn}job_id, mode, score, verdict, payload_json, created_at, updated_at)
      VALUES (${scope.userPlaceholder}?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(${scope.conflictKey}) DO UPDATE SET
        mode = excluded.mode,
        score = excluded.score,
        verdict = excluded.verdict,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`)
      .bind(...scope.userBindings, job.id, mode, payload.score, payload.verdict, JSON.stringify(payload), updatedAt, updatedAt)
      .run();

    if (!scope.userId) {
      await db.prepare("UPDATE jobs SET status = 'REVIEWED', updated_at = ? WHERE id = ?")
        .bind(updatedAt, job.id)
        .run();
    }
  }

  async function saveResumePackage(
    userId: string | null,
    job: StoredJob,
    markdown: string,
    pdfBase64: string,
    draft: { recipientGuess: string | null; subject: string; body: string },
  ): Promise<void> {
    const scope = storageScope(userId);
    const updatedAt = timestamp();
    const suffix = job.id.replace(/^job_/, "");
    const resumeId = `resume_${suffix}`;
    const draftId = `draft_${suffix}`;

    await db.prepare(`INSERT INTO ${scope.resumeTable} (${scope.userColumn}job_id, id, markdown, pdf_base64, created_at, updated_at)
      VALUES (${scope.userPlaceholder}?, ?, ?, ?, ?, ?)
      ON CONFLICT(${scope.conflictKey}) DO UPDATE SET
        markdown = excluded.markdown,
        pdf_base64 = excluded.pdf_base64,
        updated_at = excluded.updated_at`)
      .bind(...scope.userBindings, job.id, resumeId, markdown, pdfBase64, updatedAt, updatedAt)
      .run();

    const draftWhere = scopeWhere(scope, "job_id = ?");
    const existing = await db.prepare(`SELECT status FROM ${scope.draftTable} WHERE ${draftWhere.sql} LIMIT 1`)
      .bind(...draftWhere.bindings, job.id)
      .first<Row>();
    if (existing && !["PENDING_APPROVAL", "REJECTED"].includes(String(existing.status))) return;

    await db.prepare(`INSERT INTO ${scope.draftTable} (${scope.userColumn}job_id, id, recipient, subject, body, status, created_at, updated_at)
      VALUES (${scope.userPlaceholder}?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
      ON CONFLICT(${scope.conflictKey}) DO UPDATE SET
        recipient = COALESCE(excluded.recipient, ${scope.draftTable}.recipient),
        subject = excluded.subject,
        body = excluded.body,
        status = 'PENDING_APPROVAL',
        approved_at = NULL,
        updated_at = excluded.updated_at`)
      .bind(...scope.userBindings, job.id, draftId, draft.recipientGuess, draft.subject, draft.body, updatedAt, updatedAt)
      .run();
  }

  function openAiConfig(onFallback: (error: unknown) => void) {
    return {
      apiKey: runtime.OPENAI_API_KEY?.trim() ?? "",
      model: runtime.OPENAI_MODEL?.trim() || "gpt-5.6",
      onFallback,
    };
  }

  async function analyzeJobsForUser(
    userId: string | null,
    jobId?: string,
    limit = 25,
  ): Promise<Array<{ id: string; score: number; verdict: string; mode: JobIntelligenceMode }>> {
    const startedAt = Date.now();
    const profile = await candidateProfile(userId);
    const jobs = await pendingJobs(jobId, limit, userId);
    let fallbackCount = 0;
    const config = openAiConfig(() => { fallbackCount += 1; });
    const completed: Array<{ id: string; score: number; verdict: string; mode: JobIntelligenceMode }> = [];

    for (const job of jobs) {
      const { analysis, mode } = await analyzeJobWithOpenAi(job, profile, config);
      await saveAnalysis(userId, job, mode, analysis as unknown as Record<string, unknown>);
      completed.push({ id: job.id, score: analysis.score, verdict: analysis.verdict, mode });
    }

    const aiEnabled = Boolean(config.apiKey);
    const agentCount = completed.filter((item) => item.mode === "agent").length;
    const mode = !aiEnabled ? "deterministic" : fallbackCount === 0 ? "agent" : agentCount === 0 ? "deterministic" : "mixed";
    await recordEvent({
      event: "job_analysis",
      status: fallbackCount ? "degraded" : "success",
      mode,
      durationMs: Date.now() - startedAt,
      itemsSeen: jobs.length,
      itemsProcessed: completed.length,
      errorCount: fallbackCount,
      reasonCode: fallbackCount ? "openai_fallback" : null,
    });
    await recordSnapshot();
    return completed;
  }

  async function adjustResumeForUser(
    userId: string | null,
    jobId: string,
  ): Promise<{ id: string; mode: JobIntelligenceMode }> {
    const startedAt = Date.now();
    const profile = await candidateProfile(userId);
    const [job] = await pendingJobs(jobId, 1, userId);
    let fallbackCount = 0;
    const config = openAiConfig(() => { fallbackCount += 1; });
    const { pkg, mode } = await adjustResumeWithOpenAi(job, profile, config);
    const pdfBase64 = await renderPdfBase64(pkg.tailoredResume.markdown);
    await saveResumePackage(userId, job, pkg.tailoredResume.markdown, pdfBase64, pkg.applicationDraft);

    await recordEvent({
      event: "resume_generation",
      status: fallbackCount ? "degraded" : "success",
      mode,
      durationMs: Date.now() - startedAt,
      itemsSeen: 1,
      itemsProcessed: 1,
      errorCount: fallbackCount,
      reasonCode: fallbackCount ? "openai_fallback" : null,
    });
    return { id: job.id, mode };
  }

  return { analyzeJobsForUser, adjustResumeForUser };
}

async function cloudJobActions() {
  const runtime = await runtimeEnv();
  if (!runtime.DB) throw new Error("Cloud database is not available.");
  return createJobActions({ database: runtime.DB, runtime });
}

export async function analyzeJobsForUser(
  userId: string | null,
  jobId?: string,
  limit = 25,
): Promise<Array<{ id: string; score: number; verdict: string; mode: JobIntelligenceMode }>> {
  return (await cloudJobActions()).analyzeJobsForUser(userId, jobId, limit);
}

export async function adjustResumeForUser(
  userId: string | null,
  jobId: string,
): Promise<{ id: string; mode: JobIntelligenceMode }> {
  return (await cloudJobActions()).adjustResumeForUser(userId, jobId);
}
