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

async function runtimeEnv(): Promise<CloudJobEnv> {
  return (await import("cloudflare:workers")).env as unknown as CloudJobEnv;
}

async function database(): Promise<D1Database> {
  const env = await runtimeEnv();
  if (!env.DB) throw new Error("Cloud database is not available.");
  return env.DB;
}

function now(): string {
  return new Date().toISOString();
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function mapJob(row: Row): StoredJob {
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
    discoveredAt: String(row.discovered_at ?? now()),
    updatedAt: String(row.updated_at ?? now()),
    status: ["NEW", "REVIEWED", "ARCHIVED"].includes(String(row.status))
      ? String(row.status) as StoredJob["status"]
      : "NEW",
  };
}

async function candidateProfile(userId: string | null): Promise<CandidateProfile> {
  const db = await database();
  const row = userId
    ? await db.prepare("SELECT value_json FROM user_settings WHERE user_id = ? AND key = 'profile' LIMIT 1").bind(userId).first<Row>()
    : await db.prepare("SELECT value_json FROM settings WHERE key = 'profile' LIMIT 1").first<Row>();
  return CandidateProfileSchema.parse(row ? parseJson(row.value_json) : DEFAULT_PROFILE);
}

async function openAiConfig(onFallback: (error: unknown) => void) {
  const env = await runtimeEnv();
  return {
    apiKey: env.OPENAI_API_KEY?.trim() ?? "",
    model: env.OPENAI_MODEL?.trim() || "gpt-5.6",
    onFallback,
  };
}

async function pendingJobs(jobId: string | undefined, limit: number, userId: string | null): Promise<StoredJob[]> {
  const db = await database();
  if (jobId) {
    const result = await db.prepare("SELECT * FROM jobs WHERE id = ? LIMIT 1").bind(jobId).all<Row>();
    if (!result.results.length) throw new Error("Job not found.");
    return result.results.map(mapJob);
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const result = userId
    ? await db.prepare(`SELECT jobs.* FROM jobs
        LEFT JOIN user_analyses ON user_analyses.job_id = jobs.id AND user_analyses.user_id = ?
        WHERE user_analyses.job_id IS NULL
        ORDER BY jobs.discovered_at DESC LIMIT ?`).bind(userId, safeLimit).all<Row>()
    : await db.prepare(`SELECT jobs.* FROM jobs
        LEFT JOIN analyses ON analyses.job_id = jobs.id
        WHERE analyses.job_id IS NULL AND jobs.status <> 'ARCHIVED'
        ORDER BY jobs.discovered_at DESC LIMIT ?`).bind(safeLimit).all<Row>();
  return result.results.map(mapJob);
}

async function saveAnalysis(userId: string | null, job: StoredJob, mode: JobIntelligenceMode, payload: Record<string, unknown>): Promise<void> {
  const db = await database();
  const timestamp = now();
  if (userId) {
    await db.prepare(`INSERT INTO user_analyses (user_id, job_id, mode, score, verdict, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, job_id) DO UPDATE SET
        mode = excluded.mode,
        score = excluded.score,
        verdict = excluded.verdict,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at`)
      .bind(userId, job.id, mode, payload.score, payload.verdict, JSON.stringify(payload), timestamp, timestamp)
      .run();
    return;
  }

  await db.prepare(`INSERT INTO analyses (job_id, mode, score, verdict, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      mode = excluded.mode,
      score = excluded.score,
      verdict = excluded.verdict,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at`)
    .bind(job.id, mode, payload.score, payload.verdict, JSON.stringify(payload), timestamp, timestamp)
    .run();
  await db.prepare("UPDATE jobs SET status = 'REVIEWED', updated_at = ? WHERE id = ?").bind(timestamp, job.id).run();
}

export async function analyzeJobsForUser(
  userId: string | null,
  jobId?: string,
  limit = 25,
): Promise<Array<{ id: string; score: number; verdict: string; mode: JobIntelligenceMode }>> {
  const startedAt = Date.now();
  const profile = await candidateProfile(userId);
  const jobs = await pendingJobs(jobId, limit, userId);
  let fallbackCount = 0;
  const config = await openAiConfig(() => { fallbackCount += 1; });
  const completed: Array<{ id: string; score: number; verdict: string; mode: JobIntelligenceMode }> = [];

  for (const job of jobs) {
    const { analysis, mode } = await analyzeJobWithOpenAi(job, profile, config);
    await saveAnalysis(userId, job, mode, analysis as unknown as Record<string, unknown>);
    completed.push({ id: job.id, score: analysis.score, verdict: analysis.verdict, mode });
  }

  const aiEnabled = Boolean(config.apiKey);
  const agentCount = completed.filter((item) => item.mode === "agent").length;
  const mode = !aiEnabled ? "deterministic" : fallbackCount === 0 ? "agent" : agentCount === 0 ? "deterministic" : "mixed";
  await recordObservabilityEvent({
    event: "job_analysis",
    status: fallbackCount ? "degraded" : "success",
    mode,
    durationMs: Date.now() - startedAt,
    itemsSeen: jobs.length,
    itemsProcessed: completed.length,
    errorCount: fallbackCount,
    reasonCode: fallbackCount ? "openai_fallback" : null,
  });
  await recordObservabilitySnapshot();
  return completed;
}

async function saveResumePackage(
  userId: string | null,
  job: StoredJob,
  markdown: string,
  pdfBase64: string,
  draft: { recipientGuess: string | null; subject: string; body: string },
): Promise<void> {
  const db = await database();
  const timestamp = now();
  const suffix = job.id.replace(/^job_/, "");
  const resumeId = `resume_${suffix}`;
  const draftId = `draft_${suffix}`;

  if (userId) {
    await db.prepare(`INSERT INTO user_resume_variants (user_id, job_id, id, markdown, pdf_base64, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, job_id) DO UPDATE SET
        markdown = excluded.markdown,
        pdf_base64 = excluded.pdf_base64,
        updated_at = excluded.updated_at`)
      .bind(userId, job.id, resumeId, markdown, pdfBase64, timestamp, timestamp)
      .run();

    const existing = await db.prepare("SELECT status FROM user_application_drafts WHERE user_id = ? AND job_id = ? LIMIT 1")
      .bind(userId, job.id)
      .first<Row>();
    if (!existing || ["PENDING_APPROVAL", "REJECTED"].includes(String(existing.status))) {
      await db.prepare(`INSERT INTO user_application_drafts (user_id, job_id, id, recipient, subject, body, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
        ON CONFLICT(user_id, job_id) DO UPDATE SET
          recipient = COALESCE(excluded.recipient, user_application_drafts.recipient),
          subject = excluded.subject,
          body = excluded.body,
          status = 'PENDING_APPROVAL',
          approved_at = NULL,
          updated_at = excluded.updated_at`)
        .bind(userId, job.id, draftId, draft.recipientGuess, draft.subject, draft.body, timestamp, timestamp)
        .run();
    }
    return;
  }

  await db.prepare(`INSERT INTO resume_variants (id, job_id, markdown, pdf_base64, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET markdown = excluded.markdown, pdf_base64 = excluded.pdf_base64, updated_at = excluded.updated_at`)
    .bind(resumeId, job.id, markdown, pdfBase64, timestamp, timestamp)
    .run();

  const existing = await db.prepare("SELECT status FROM application_drafts WHERE job_id = ? LIMIT 1").bind(job.id).first<Row>();
  if (!existing || ["PENDING_APPROVAL", "REJECTED"].includes(String(existing.status))) {
    await db.prepare(`INSERT INTO application_drafts (id, job_id, recipient, subject, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        recipient = COALESCE(excluded.recipient, application_drafts.recipient),
        subject = excluded.subject,
        body = excluded.body,
        status = 'PENDING_APPROVAL',
        approved_at = NULL,
        updated_at = excluded.updated_at`)
      .bind(draftId, job.id, draft.recipientGuess, draft.subject, draft.body, timestamp, timestamp)
      .run();
  }
}

export async function adjustResumeForUser(
  userId: string | null,
  jobId: string,
): Promise<{ id: string; mode: JobIntelligenceMode }> {
  const startedAt = Date.now();
  const profile = await candidateProfile(userId);
  const [job] = await pendingJobs(jobId, 1, userId);
  let fallbackCount = 0;
  const config = await openAiConfig(() => { fallbackCount += 1; });
  const { pkg, mode } = await adjustResumeWithOpenAi(job, profile, config);
  const pdfBase64 = bytesToBase64(await buildResumePdf(pkg.tailoredResume.markdown));
  await saveResumePackage(userId, job, pkg.tailoredResume.markdown, pdfBase64, pkg.applicationDraft);

  await recordObservabilityEvent({
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
