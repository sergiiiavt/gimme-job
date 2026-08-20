import { bearerToken, constantTimeEqual } from "../email-events/email-event.ts";
import { resolveEmailEvent, type VacancyResolutionResult } from "../email-events/vacancy-resolver.ts";

export type EmailResolveEnv = {
  DB?: D1Database;
  N8N_INGEST_TOKEN?: string;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 90;

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

function authorizationError(request: Request, env: EmailResolveEnv): Response | null {
  const configured = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configured) return json({ error: "Email vacancy resolution is not configured." }, 503);
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

async function runtimeEnv(): Promise<EmailResolveEnv> {
  return (await import("cloudflare:workers")).env as unknown as EmailResolveEnv;
}

async function requestJson(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Request body must be a JSON object." }, 400);
    return value as Record<string, unknown>;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return null;
  return Math.min(value, maximum);
}

function optionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean.length <= 512 ? clean : null;
}

export async function handleEmailResolution(request: Request, env: EmailResolveEnv): Promise<Response> {
  const authError = authorizationError(request, env);
  if (authError) return authError;
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  const payload = await requestJson(request);
  if (payload instanceof Response) return payload;

  const eventId = optionalId(payload.id);
  const userId = optionalId(payload.userId);
  if ((eventId && !userId) || (!eventId && userId)) {
    return json({ error: "id and userId must be provided together." }, 400);
  }

  if (eventId && userId) {
    try {
      const result = await resolveEmailEvent(env.DB, userId, eventId);
      return json({ processed: 1, results: [result] });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Failed to resolve email event." }, 400);
    }
  }

  const limit = boundedInteger(payload.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const lookbackDays = boundedInteger(payload.lookbackDays, DEFAULT_LOOKBACK_DAYS, MAX_LOOKBACK_DAYS);
  if (!limit || !lookbackDays) return json({ error: "limit and lookbackDays must be positive integers." }, 400);

  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  let pending: Array<{ id: string; user_id: string }>;
  try {
    const result = await env.DB.prepare(`SELECT id, user_id
      FROM user_email_events
      WHERE classification IN (
        'APPLICATION_RECEIVED', 'RECRUITER_OUTREACH', 'INTERVIEW', 'TEST_TASK', 'OFFER', 'REJECTION'
      )
        AND match_status IN ('PENDING', 'UNRESOLVED', 'AMBIGUOUS')
        AND received_at >= ?
      ORDER BY received_at ASC
      LIMIT ?`)
      .bind(cutoff, limit)
      .all<{ id: string; user_id: string }>();
    pending = result.results ?? [];
  } catch {
    return json({ error: "Failed to load unresolved email events." }, 500);
  }

  const results: VacancyResolutionResult[] = [];
  const errors: Array<{ id: string; userId: string; error: string }> = [];
  for (const event of pending) {
    try {
      results.push(await resolveEmailEvent(env.DB, event.user_id, event.id));
    } catch (error) {
      errors.push({
        id: event.id,
        userId: event.user_id,
        error: error instanceof Error ? error.message : "Resolution failed.",
      });
    }
  }

  const counts = results.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.matchStatus] = (accumulator[result.matchStatus] ?? 0) + 1;
    return accumulator;
  }, {});

  return json({
    processed: results.length,
    failed: errors.length,
    counts,
    results,
    errors,
    lookbackDays,
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleEmailResolution(request, await runtimeEnv());
}
