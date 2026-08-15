import {
  EmailEventValidationError,
  bearerToken,
  constantTimeEqual,
  normalizeEmailEvent,
} from "./email-event.ts";

const MAX_REQUEST_BYTES = 32 * 1024;

export type EmailIngestEnv = {
  DB?: D1Database;
  N8N_INGEST_TOKEN?: string;
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

export async function handleEmailEvent(request: Request, env: EmailIngestEnv): Promise<Response> {
  const startedAt = Date.now();
  const configuredToken = env.N8N_INGEST_TOKEN?.trim() ?? "";

  if (!configuredToken) {
    return json({ error: "n8n ingest is not configured." }, 503);
  }

  const suppliedToken = bearerToken(request.headers.get("authorization"));
  if (!suppliedToken || !constantTimeEqual(suppliedToken, configuredToken)) {
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

  if (!env.DB) {
    return json({ error: "Cloud database is not available." }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "Request is too large." }, 413);
  }

  let payload: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

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

export async function POST(request: Request): Promise<Response> {
  return handleEmailEvent(request, await runtimeEnv());
}
