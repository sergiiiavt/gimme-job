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
  if (userId) {
    return {
      userId,
      analysisTable: "user_analyses",
      resumeTable: "user_resume_variants",
      draftTable: "user_application_drafts",
      conflictKey: "user_id, job_id",
      userColumn: "user_id, ",
      userPlaceholder: "?, ",
      userBindings: [userId],
    };
  }
  return {
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

function rowText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function nullableRowText(value: unknown): string | null {
  const text = rowText(value).trim();
  return text || null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function jobStatus(value: unknown): StoredJob["status"] {
  const status = rowText(value, "NEW");
  if (status === "REVIEWED" || status === "ARCHIVED") return status;
  return "NEW";
}

function mapJob(row: Row, timestamp: string): StoredJob {
  const id = rowText(row.id);
  const url = rowText(row.url);
  return {
    id,
    fingerprint: rowText(row.fingerprint, id),
    source: rowText(row.source, "unknown"),
    externalId: nullableRowText(row.external_id),
    title: rowText(row.title),
    company: rowText(row.company, "Unknown"),
    location: rowText(row.location, "Unknown"),
    remote: row.remote === 1 || row.remote === true,
    url,
    applyUrl: rowText(row.apply_url, url),
    description: rowText(row.description),
    salaryText: nullableRowText(row.salary_text),
    postedAt: nullableRowText(row.posted_at),
    contactEmail: nullableRowText(row.contact_email),
    raw: parseJson(row.raw_json ?? {}),
    discoveredAt: rowText(row.discovered_at, timestamp),
    updatedAt: rowText(row.updated_at, timestamp),
    status: jobStatus(row.status),
  };
}

function scopeWhere(scope: StorageScope, column: string): { sql: string; bindings: string[] } {
  if (scope.userId) return { sql: `user_id = ? AND ${column}`, bindings: scope.userBindings };
  return { sql: column, bindings: [] };
}

function analysisMode(aiEnabled: boolean, fallbackCount: number, agentCount: number): "agent" | "deterministic" | "mixed" {
  if (!aiEnabled) return "deterministic";
  if (fallbackCount === 0) return "agent";
  if (agentCount === 0) return "deterministic";
  return "mixed";
}

export function createJobActions(dependencies: JobActionDependencies) {
  const db = dependencies.database;
  const runtime = dependencies.runtime ?? {};
  const clock = dependencies.now ?? (() => new Date());
  const timestamp = () => clock().toISOString();
  const recordEvent = dependencies.recordEvent ?? recordObservabilityEvent;
  const recordSnapshot = dependencies.recordSnapshot ?? recordObservabilitySnapshot;
  const renderPdfBase64 = dependencies.renderPdfBase64
    ?? (async (markdown: string) => bytesToBase64(await buildResumePdf(markdown)));

  async function candidateProfile(userId: string | null): Promise<CandidateProfile> {
    let row: Row | null;
    if (userId) {
      row = await db.prepare("SELECT value_json FROM user_settings WHERE user_id = ? AND key = 'profile' LIMIT 1")
        .bind(userId)
        .first<Row>();
    } else {
      row = await db.prepare("SELECT value_json FROM settings WHERE key = 'profile' LIMIT 1").first<Row>();
    }
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
    const existingStatus = existing ? rowText(existing.status) : "";
    if (existingStatus && !["PENDING_APPROVAL", "REJECTED"].includes(existingStatus)) return;

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

    const agentCount = completed.filter((item) => item.mode === "agent").length;
    const mode = analysisMode(Boolean(config.apiKey), fallbackCount, agentCount);
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