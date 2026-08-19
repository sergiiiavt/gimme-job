import { handleDouVacancyImport } from "../../../api/_dou-vacancy-import";
import { upsertImportedVacancies } from "../../../api/_vacancy-import";
import { syncVacancySources } from "../../../api/_vacancy-intake";
import { bearerToken, constantTimeEqual } from "../email-events/email-event";

type VacancySyncEnv = {
  DB?: D1Database;
  N8N_INGEST_TOKEN?: string;
};

type AuditRow = {
  id: string;
  user_id: string;
  job_id: string;
  title: string | null;
  company: string | null;
  actor_label: string;
  action: string;
  field: string | null;
  before_value: string | null;
  after_value: string | null;
  metadata_json: string | null;
  created_at: string;
};

type ClassificationRow = {
  id: string;
  user_id: string;
  subject: string;
  classification: string;
  classification_confidence: number | null;
  classification_source: string | null;
  summary: string | null;
  company: string | null;
  job_title: string | null;
  recruiter_name: string | null;
  action: string | null;
  classified_at: string | null;
};

const ACTIVITY_LIMIT = 50;
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

async function runtimeEnv(): Promise<VacancySyncEnv> {
  return (await import("cloudflare:workers")).env as unknown as VacancySyncEnv;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function authorize(request: Request, env: VacancySyncEnv): Response | null {
  const configured = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configured) return json({ error: "Vacancy sync is not configured." }, 503);
  const supplied = bearerToken(request.headers.get("authorization"));
  if (supplied && constantTimeEqual(supplied, configured)) return null;
  return new Response(JSON.stringify({ error: "Authentication required." }), {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "www-authenticate": "Bearer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function validInstant(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function optionalUserId(request: Request): string | null | undefined {
  const value = new URL(request.url).searchParams.get("userId");
  if (value === null || !value.trim()) return null;
  const clean = value.trim();
  return clean.length <= 512 ? clean : undefined;
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function classificationChanges(row: ClassificationRow): Array<{ field: string; value: string }> {
  const changes: Array<{ field: string; value: string }> = [
    { field: "classification", value: `UNCLASSIFIED → ${row.classification}` },
  ];
  if (row.classification_confidence !== null) {
    changes.push({ field: "confidence", value: `${Math.round(row.classification_confidence * 100)}%` });
  }
  if (row.company) changes.push({ field: "company", value: row.company });
  if (row.job_title) changes.push({ field: "job title", value: row.job_title });
  if (row.recruiter_name) changes.push({ field: "recruiter", value: row.recruiter_name });
  if (row.action) changes.push({ field: "action", value: row.action });
  return changes;
}

export async function handleVacancyAutomationActivity(request: Request, env: VacancySyncEnv): Promise<Response> {
  const authError = authorize(request, env);
  if (authError) return authError;
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  const url = new URL(request.url);
  const startUtc = validInstant(url.searchParams.get("startUtc"));
  const endUtc = validInstant(url.searchParams.get("endUtc"));
  if (!startUtc || !endUtc) return json({ error: "startUtc and endUtc must be valid timestamps." }, 400);
  const startMs = Date.parse(startUtc);
  const endMs = Date.parse(endUtc);
  if (endMs <= startMs || endMs - startMs > MAX_RANGE_MS) {
    return json({ error: "Activity window must be positive and no longer than 7 days." }, 400);
  }

  const userId = optionalUserId(request);
  if (userId === undefined) return json({ error: "userId is too long." }, 400);
  const userFilter = userId ? " AND audit.user_id = ?" : "";
  const emailUserFilter = userId ? " AND user_id = ?" : "";
  const userBindings = userId ? [userId] : [];

  try {
    const [audit, classifications] = await Promise.all([
      env.DB.prepare(`SELECT
        audit.id, audit.user_id, audit.job_id, jobs.title, jobs.company,
        audit.actor_label, audit.action, audit.field, audit.before_value,
        audit.after_value, audit.metadata_json, audit.created_at
      FROM user_vacancy_audit_log AS audit
      LEFT JOIN jobs ON jobs.id = audit.job_id
      WHERE audit.created_at >= ? AND audit.created_at < ?
        AND audit.actor_type = 'automation'${userFilter}
      ORDER BY audit.created_at DESC
      LIMIT ?`)
        .bind(startUtc, endUtc, ...userBindings, ACTIVITY_LIMIT)
        .all<AuditRow>(),
      env.DB.prepare(`SELECT
        id, user_id, subject, classification, classification_confidence,
        classification_source, summary, company, job_title, recruiter_name,
        action, classified_at
      FROM user_email_events
      WHERE classified_at >= ? AND classified_at < ?${emailUserFilter}
      ORDER BY CASE classification
        WHEN 'OFFER' THEN 1
        WHEN 'INTERVIEW' THEN 2
        WHEN 'TEST_TASK' THEN 3
        WHEN 'RECRUITER_OUTREACH' THEN 4
        WHEN 'APPLICATION_RECEIVED' THEN 5
        WHEN 'REJECTION' THEN 6
        WHEN 'JOB_ALERT' THEN 7
        WHEN 'OTHER' THEN 8
        WHEN 'SERVICE_MESSAGE' THEN 9
        WHEN 'NON_JOB' THEN 10
        ELSE 11
      END, classified_at DESC
      LIMIT ?`)
        .bind(startUtc, endUtc, ...userBindings, ACTIVITY_LIMIT)
        .all<ClassificationRow>(),
    ]);

    return json({
      window: { startUtc, endUtc },
      userId,
      limit: ACTIVITY_LIMIT,
      vacancyChanges: (audit.results ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        jobId: row.job_id,
        title: row.title,
        company: row.company,
        actor: row.actor_label,
        action: row.action,
        field: row.field,
        beforeValue: row.before_value,
        afterValue: row.after_value,
        metadata: parseMetadata(row.metadata_json),
        changedAt: row.created_at,
      })),
      classifications: (classifications.results ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        subject: row.subject,
        classification: row.classification,
        confidence: row.classification_confidence,
        source: row.classification_source,
        summary: row.summary,
        company: row.company,
        jobTitle: row.job_title,
        recruiterName: row.recruiter_name,
        action: row.action,
        classifiedAt: row.classified_at,
        changedFields: classificationChanges(row),
      })),
    });
  } catch {
    return json({ error: "Failed to load vacancy automation activity." }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleVacancyAutomationActivity(request, await runtimeEnv());
}

export async function POST(request: Request): Promise<Response> {
  const env = await runtimeEnv();
  const authError = authorize(request, env);
  if (authError) return authError;

  const douImport = await handleDouVacancyImport(request, upsertImportedVacancies);
  if (douImport) return douImport;

  const startedAt = Date.now();
  try {
    const result = await syncVacancySources();
    console.log({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "vacancy_sync",
      outcome: result.errors.length ? "degraded" : "success",
      durationMs: Date.now() - startedAt,
      seen: result.seen,
      relevant: result.relevant,
      rejected: result.rejected,
      duplicates: result.duplicates,
      inserted: result.inserted,
      updated: result.updated,
      sourceErrors: result.errors.length,
      skippedSources: result.skipped.map((entry) => entry.source),
    });
    return json({ ok: true, result });
  } catch (error) {
    console.error({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "vacancy_sync",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "Vacancy synchronization failed." }, 500);
  }
}
