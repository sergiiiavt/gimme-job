import {
  EMAIL_CLASSIFICATIONS,
  EmailEventValidationError,
  bearerToken,
  constantTimeEqual,
  normalizeEmailEvent,
  type EmailClassification,
} from "./email-event.ts";

const MAX_REQUEST_BYTES = 32 * 1024;
const DEFAULT_PENDING_LIMIT = 25;
const MAX_PENDING_LIMIT = 100;
const MAX_EVENT_ID_LENGTH = 512;

export type EmailIngestEnv = {
  DB?: D1Database;
  N8N_INGEST_TOKEN?: string;
};

type PendingEmailEventRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_message_id: string;
  received_at: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
};

type ClassificationUpdate = {
  id: string;
  userId: string;
  classification: Exclude<EmailClassification, "UNCLASSIFIED">;
};

async function runtimeEnv(): Promise<EmailIngestEnv> {
  return (await import("cloudflare:workers")).env as unknown as EmailIngestEnv;
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

function authorizationError(request: Request, env: EmailIngestEnv): Response | null {
  const configuredToken = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configuredToken) {
    return json({ error: "n8n ingest is not configured." }, 503);
  }

  const suppliedToken = bearerToken(request.headers.get("authorization"));
  if (suppliedToken && constantTimeEqual(suppliedToken, configuredToken)) return null;

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

async function requestJson(request: Request): Promise<unknown | Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "Request is too large." }, 413);
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }
    return JSON.parse(text);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
}

function logEmailIngest(fields: Record<string, unknown>): void {
  console.log({
    schemaVersion: 1,
    service: "gimmejob",
    environment: "production",
    event: "email_ingest",
    source: "n8n:gmail",
    ...fields,
  });
}

function pendingLimit(request: Request): number | null {
  const value = new URL(request.url).searchParams.get("limit");
  if (value === null || value === "") return DEFAULT_PENDING_LIMIT;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_PENDING_LIMIT);
}

function requiredId(payload: Record<string, unknown>, key: "id" | "userId"): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new EmailEventValidationError(`${key} is required.`);
  }
  const clean = value.trim();
  if (clean.length > MAX_EVENT_ID_LENGTH) {
    throw new EmailEventValidationError(`${key} is too long.`);
  }
  return clean;
}

function classificationUpdate(input: unknown): ClassificationUpdate {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new EmailEventValidationError("Request body must be a JSON object.");
  }
  const payload = input as Record<string, unknown>;
  const rawClassification = payload.classification;
  if (typeof rawClassification !== "string" || !rawClassification.trim()) {
    throw new EmailEventValidationError("classification is required.");
  }
  const classification = rawClassification.trim().toUpperCase() as EmailClassification;
  if (!EMAIL_CLASSIFICATIONS.includes(classification)) {
    throw new EmailEventValidationError(`Unsupported classification: ${rawClassification}.`);
  }
  if (classification === "UNCLASSIFIED") {
    throw new EmailEventValidationError("classification must resolve the event.");
  }

  return {
    id: requiredId(payload, "id"),
    userId: requiredId(payload, "userId"),
    classification,
  };
}

export async function handlePendingEmailEvents(request: Request, env: EmailIngestEnv): Promise<Response> {
  const authError = authorizationError(request, env);
  if (authError) return authError;
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  const limit = pendingLimit(request);
  if (limit === null) return json({ error: "limit must be a positive integer." }, 400);

  try {
    const result = await env.DB.prepare(`SELECT
      id,
      user_id,
      provider,
      provider_message_id,
      received_at,
      sender_name,
      sender_email,
      subject
    FROM user_email_events
    WHERE classification = 'UNCLASSIFIED'
    ORDER BY received_at ASC
    LIMIT ?`)
      .bind(limit)
      .all<PendingEmailEventRow>();

    const events = (result.results ?? []).map((event) => ({
      id: event.id,
      userId: event.user_id,
      provider: event.provider,
      providerMessageId: event.provider_message_id,
      receivedAt: event.received_at,
      senderName: event.sender_name,
      senderEmail: event.sender_email,
      subject: event.subject,
    }));

    return json({ events });
  } catch {
    return json({ error: "Failed to load pending email events." }, 500);
  }
}

export async function handleEmailClassificationUpdate(request: Request, env: EmailIngestEnv): Promise<Response> {
  const authError = authorizationError(request, env);
  if (authError) return authError;
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  const payload = await requestJson(request);
  if (payload instanceof Response) return payload;

  let update: ClassificationUpdate;
  try {
    update = classificationUpdate(payload);
  } catch (error) {
    if (error instanceof EmailEventValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  try {
    const existing = await env.DB.prepare(`SELECT classification FROM user_email_events
      WHERE user_id = ? AND id = ? LIMIT 1`)
      .bind(update.userId, update.id)
      .first<{ classification?: string }>();

    if (!existing) return json({ error: "Email event was not found." }, 404);
    if (existing.classification === update.classification) {
      return json({ ok: true, id: update.id, classification: update.classification, changed: false });
    }
    if (existing.classification !== "UNCLASSIFIED") {
      return json({ error: "Email event is already classified." }, 409);
    }

    await env.DB.prepare(`UPDATE user_email_events
      SET classification = ?, updated_at = ?
      WHERE user_id = ? AND id = ? AND classification = 'UNCLASSIFIED'`)
      .bind(update.classification, new Date().toISOString(), update.userId, update.id)
      .run();

    return json({ ok: true, id: update.id, classification: update.classification, changed: true });
  } catch {
    return json({ error: "Failed to update email classification." }, 500);
  }
}

export async function handleEmailEvent(request: Request, env: EmailIngestEnv): Promise<Response> {
  const startedAt = Date.now();
  const authError = authorizationError(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return json({ error: "Cloud database is not available." }, 503);
  }

  const payload = await requestJson(request);
  if (payload instanceof Response) return payload;

  let event: ReturnType<typeof normalizeEmailEvent>;
  try {
    event = normalizeEmailEvent(payload);
  } catch (error) {
    if (error instanceof EmailEventValidationError) {
      return json({ error: error.message }, 400);
    }
    throw error;
  }

  try {
    const existing = await env.DB.prepare("SELECT id FROM email_events WHERE id = ? LIMIT 1")
      .bind(event.id)
      .first<{ id: string }>();
    const timestamp = new Date().toISOString();

    await env.DB.prepare(`INSERT INTO email_events (
      id,
      provider,
      provider_message_id,
      thread_id,
      received_at,
      sender_name,
      sender_email,
      subject,
      classification,
      summary,
      company,
      job_title,
      recruiter_name,
      job_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      thread_id = excluded.thread_id,
      received_at = excluded.received_at,
      sender_name = excluded.sender_name,
      sender_email = excluded.sender_email,
      subject = excluded.subject,
      classification = excluded.classification,
      summary = excluded.summary,
      company = excluded.company,
      job_title = excluded.job_title,
      recruiter_name = excluded.recruiter_name,
      job_id = excluded.job_id,
      updated_at = excluded.updated_at`)
      .bind(
        event.id,
        event.provider,
        event.providerMessageId,
        event.threadId,
        event.receivedAt,
        event.senderName,
        event.senderEmail,
        event.subject,
        event.classification,
        event.summary,
        event.company,
        event.jobTitle,
        event.recruiterName,
        event.jobId,
        timestamp,
        timestamp,
      )
      .run();

    logEmailIngest({
      phase: "complete",
      outcome: "success",
      durationMs: Date.now() - startedAt,
      created: !existing,
      classification: event.classification,
    });

    return json(
      {
        ok: true,
        id: event.id,
        created: !existing,
        classification: event.classification,
      },
      existing ? 200 : 201,
    );
  } catch (error) {
    logEmailIngest({
      phase: "complete",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ error: "Failed to store email event." }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handlePendingEmailEvents(request, await runtimeEnv());
}

export async function PATCH(request: Request): Promise<Response> {
  return handleEmailClassificationUpdate(request, await runtimeEnv());
}

export async function POST(request: Request): Promise<Response> {
  return handleEmailEvent(request, await runtimeEnv());
}
