import { tenantRequestContext } from "../../_tenant-state.ts";
import { resolveEmailEvent } from "../../../internal/n8n/email-events/vacancy-resolver.ts";

type EmailResolutionEnv = {
  DB?: D1Database;
};

type ResolutionRow = {
  id: string;
  subject: string;
  classification: string;
  summary: string | null;
  company: string | null;
  job_title: string | null;
  recruiter_name: string | null;
  received_at: string;
  match_status: string;
  match_method: string | null;
  match_confidence: number | null;
  match_evidence_json: string | null;
  status_apply_note: string | null;
};

const RESOLUTION_LIMIT = 30;
const MAX_ID_LENGTH = 512;

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

function parseEvidence(value: string | null): Record<string, unknown> {
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

function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean.length <= MAX_ID_LENGTH ? clean : null;
}

async function runtimeEnv(): Promise<EmailResolutionEnv> {
  return (await import("cloudflare:workers")).env as unknown as EmailResolutionEnv;
}

export async function handleUnresolvedEmailEvents(request: Request, env: EmailResolutionEnv): Promise<Response> {
  const tenant = tenantRequestContext(request);
  if (!tenant.multiUser || !tenant.authenticated || !tenant.userId) {
    return json({ error: "Authentication required." }, 401);
  }
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  try {
    const result = await env.DB.prepare(`SELECT
      id, subject, classification, summary, company, job_title, recruiter_name,
      received_at, match_status, match_method, match_confidence,
      match_evidence_json, status_apply_note
    FROM user_email_events
    WHERE user_id = ?
      AND classification IN (
        'APPLICATION_RECEIVED', 'RECRUITER_OUTREACH', 'INTERVIEW', 'TEST_TASK', 'OFFER', 'REJECTION'
      )
      AND match_status IN ('AMBIGUOUS', 'UNRESOLVED')
    ORDER BY received_at DESC
    LIMIT ?`)
      .bind(tenant.userId, RESOLUTION_LIMIT)
      .all<ResolutionRow>();

    return json({
      events: (result.results ?? []).map((row) => ({
        id: row.id,
        subject: row.subject,
        classification: row.classification,
        summary: row.summary,
        company: row.company,
        jobTitle: row.job_title,
        recruiterName: row.recruiter_name,
        receivedAt: row.received_at,
        matchStatus: row.match_status,
        matchMethod: row.match_method,
        confidence: row.match_confidence,
        evidence: parseEvidence(row.match_evidence_json),
        statusNote: row.status_apply_note,
      })),
    });
  } catch {
    return json({ error: "Failed to load unresolved email events." }, 500);
  }
}

export async function handleManualEmailLink(request: Request, env: EmailResolutionEnv): Promise<Response> {
  const tenant = tenantRequestContext(request);
  if (!tenant.multiUser || !tenant.authenticated || !tenant.userId) {
    return json({ error: "Authentication required." }, 401);
  }
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  let payload: Record<string, unknown>;
  try {
    const parsed = await request.json() as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Request body must be a JSON object." }, 400);
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const eventId = cleanId(payload.eventId);
  const jobId = cleanId(payload.jobId);
  if (!eventId || !jobId) return json({ error: "eventId and jobId are required." }, 400);

  try {
    const result = await resolveEmailEvent(env.DB, tenant.userId, eventId, {
      forcedJobId: jobId,
      actorType: "user",
      actorLabel: "You",
    });
    return json({ result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Failed to link email event." }, 400);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleUnresolvedEmailEvents(request, await runtimeEnv());
}

export async function PATCH(request: Request): Promise<Response> {
  return handleManualEmailLink(request, await runtimeEnv());
}
