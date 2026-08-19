import { tenantRequestContext } from "../../../_tenant-state";

type VacancyAuditEnv = {
  DB?: D1Database;
};

type Row = {
  id: string;
  job_id: string;
  actor_type: string;
  actor_label: string;
  action: string;
  field: string | null;
  before_value: string | null;
  after_value: string | null;
  metadata_json: string | null;
  created_at: string;
};

type RouteContext = {
  params: Promise<{ jobId: string }> | { jobId: string };
};

const MAX_JOB_ID_LENGTH = 512;
const AUDIT_LIMIT = 100;

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

export async function handleVacancyAudit(
  request: Request,
  env: VacancyAuditEnv,
  jobId: string,
): Promise<Response> {
  const tenant = tenantRequestContext(request);
  if (!tenant.multiUser || !tenant.authenticated || !tenant.userId) {
    return json({ error: "Authentication required." }, 401);
  }
  const normalizedJobId = jobId.trim();
  if (!normalizedJobId || normalizedJobId.length > MAX_JOB_ID_LENGTH) {
    return json({ error: "Invalid job id." }, 400);
  }
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  try {
    const result = await env.DB.prepare(`SELECT
      id, job_id, actor_type, actor_label, action, field,
      before_value, after_value, metadata_json, created_at
    FROM user_vacancy_audit_log
    WHERE user_id = ? AND job_id = ?
    ORDER BY created_at DESC
    LIMIT ?`)
      .bind(tenant.userId, normalizedJobId, AUDIT_LIMIT)
      .all<Row>();

    return json({
      jobId: normalizedJobId,
      entries: (result.results ?? []).map((row) => ({
        id: row.id,
        jobId: row.job_id,
        actorType: row.actor_type,
        actorLabel: row.actor_label,
        action: row.action,
        field: row.field,
        beforeValue: row.before_value,
        afterValue: row.after_value,
        metadata: parseMetadata(row.metadata_json),
        createdAt: row.created_at,
      })),
    });
  } catch {
    return json({ error: "Failed to load vacancy audit log." }, 500);
  }
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  const env = runtime.env as unknown as VacancyAuditEnv;
  const { jobId } = await Promise.resolve(context.params);
  return handleVacancyAudit(request, env, jobId);
}
