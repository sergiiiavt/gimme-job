import {
  EMAIL_ACTIONS,
  bearerToken,
  constantTimeEqual,
  type EmailAction,
  type EmailClassification,
} from "../email-events/email-event.ts";
import {
  EMAIL_CLASSIFIER_INSTRUCTIONS,
  EMAIL_CLASSIFIER_PROMPT_VERSION,
} from "./instructions.ts";
import {
  EMAIL_CLASSIFIER_VERSION,
  fallbackClassification,
  preAiClassification,
  type RuleClassification,
} from "./rules.ts";

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_ID_LENGTH = 512;
const MAX_SUMMARY_LENGTH = 500;
const MAX_NAME_LENGTH = 300;
const DEFAULT_USER_DAILY_AI_LIMIT = 50;
const DEFAULT_GLOBAL_DAILY_AI_LIMIT = 500;
const MAX_PROCESSING_ATTEMPTS = 3;
const PROCESSING_LOCK_MS = 10 * 60 * 1000;

const AI_CLASSIFICATIONS = [
  "APPLICATION_RECEIVED",
  "RECRUITER_OUTREACH",
  "INTERVIEW",
  "TEST_TASK",
  "OFFER",
  "REJECTION",
  "JOB_ALERT",
  "SERVICE_MESSAGE",
  "NON_JOB",
  "OTHER",
] as const satisfies readonly EmailClassification[];

type AiClassification = (typeof AI_CLASSIFICATIONS)[number];

type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type AiCallResult = {
  result: Omit<ClassificationResult, "id" | "userId">;
  usage: AiUsage;
  latencyMs: number;
};

export type EmailClassifierEnv = {
  DB?: D1Database;
  N8N_INGEST_TOKEN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  EMAIL_AI_ENABLED?: string;
  EMAIL_AI_DAILY_USER_LIMIT?: string;
  EMAIL_AI_DAILY_GLOBAL_LIMIT?: string;
};

type EmailEventRow = {
  id: string;
  user_id: string;
  received_at: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
  classification: string;
  classification_confidence: number | null;
  classification_source: string | null;
  summary: string | null;
  company: string | null;
  job_title: string | null;
  recruiter_name: string | null;
  action: string | null;
  processing_status: string;
  processing_started_at: string | null;
  processing_attempts: number;
};

type ClassificationResult = {
  id: string;
  userId: string;
  classification: AiClassification;
  confidence: number;
  source: string;
  summary: string;
  company: string | null;
  jobTitle: string | null;
  recruiterName: string | null;
  action: EmailAction;
};

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["classification", "confidence", "summary", "company", "jobTitle", "recruiterName", "action"],
  properties: {
    classification: { type: "string", enum: AI_CLASSIFICATIONS },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string", maxLength: 500 },
    company: { type: ["string", "null"], maxLength: 300 },
    jobTitle: { type: ["string", "null"], maxLength: 300 },
    recruiterName: { type: ["string", "null"], maxLength: 300 },
    action: { type: "string", enum: EMAIL_ACTIONS },
  },
};

async function runtimeEnv(): Promise<EmailClassifierEnv> {
  return (await import("cloudflare:workers")).env as unknown as EmailClassifierEnv;
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

function authorizationError(request: Request, env: EmailClassifierEnv): Response | null {
  const configuredToken = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configuredToken) return json({ error: "n8n email processing is not configured." }, 503);
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

async function requestJson(request: Request): Promise<Record<string, unknown> | Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return json({ error: "Request is too large." }, 413);
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) return json({ error: "Request is too large." }, 413);
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Request body must be a JSON object." }, 400);
    return value as Record<string, unknown>;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
}

function requiredId(payload: Record<string, unknown>, key: "id" | "userId"): string | null {
  const value = payload[key];
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean || clean.length > MAX_ID_LENGTH) return null;
  return clean;
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function aiEnabled(env: EmailClassifierEnv): boolean {
  const value = env.EMAIL_AI_ENABLED?.trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "off";
}

function runChanges(result: unknown): number {
  const meta = (result as { meta?: { changes?: number } } | null)?.meta;
  return Number(meta?.changes ?? 0);
}

function isAiClassification(value: unknown): value is AiClassification {
  return typeof value === "string" && AI_CLASSIFICATIONS.includes(value as AiClassification);
}

function isEmailAction(value: unknown): value is EmailAction {
  return typeof value === "string" && EMAIL_ACTIONS.includes(value as EmailAction);
}

function actionMatchesClassification(classification: AiClassification, action: EmailAction): boolean {
  switch (classification) {
    case "APPLICATION_RECEIVED": return action === "TRACK_APPLICATION";
    case "RECRUITER_OUTREACH": return action === "RESPOND" || action === "REVIEW";
    case "INTERVIEW": return action === "PREPARE_INTERVIEW";
    case "TEST_TASK": return action === "COMPLETE_TEST_TASK";
    case "OFFER": return action === "REVIEW_OFFER";
    case "REJECTION":
    case "SERVICE_MESSAGE":
    case "NON_JOB": return action === "NO_ACTION";
    case "JOB_ALERT": return action === "REVIEW_JOB_ALERT";
    case "OTHER": return action === "REVIEW";
  }
}

function normalizedAiResult(value: unknown, model: string): Omit<ClassificationResult, "id" | "userId"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OpenAI returned an invalid classification object.");
  const payload = value as Record<string, unknown>;
  const classification = payload.classification;
  if (!isAiClassification(classification)) throw new Error("OpenAI returned an unsupported email classification.");
  const confidence = payload.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("OpenAI returned an invalid confidence score.");
  const action = payload.action;
  if (!isEmailAction(action) || !actionMatchesClassification(classification, action)) {
    throw new Error("OpenAI returned an action inconsistent with the classification.");
  }
  const summary = boundedText(payload.summary, MAX_SUMMARY_LENGTH);
  if (!summary) throw new Error("OpenAI returned an empty email summary.");

  return {
    classification,
    confidence,
    source: `OPENAI:${model}`.slice(0, 100),
    summary,
    company: boundedText(payload.company, MAX_NAME_LENGTH),
    jobTitle: boundedText(payload.jobTitle, MAX_NAME_LENGTH),
    recruiterName: boundedText(payload.recruiterName, MAX_NAME_LENGTH),
    action,
  };
}

function existingResult(event: EmailEventRow): ClassificationResult | null {
  if (!isAiClassification(event.classification)) return null;
  const action = event.action;
  if (!isEmailAction(action)) return null;
  return {
    id: event.id,
    userId: event.user_id,
    classification: event.classification,
    confidence: event.classification_confidence ?? 1,
    source: event.classification_source ?? "EXISTING",
    summary: event.summary ?? event.subject.slice(0, 240),
    company: event.company,
    jobTitle: event.job_title,
    recruiterName: event.recruiter_name,
    action,
  };
}

async function claimEvent(db: D1Database, event: EmailEventRow, now: string): Promise<boolean> {
  const staleBefore = new Date(Date.parse(now) - PROCESSING_LOCK_MS).toISOString();
  const result = await db.prepare(`UPDATE user_email_events
    SET
      processing_status = 'PROCESSING',
      processing_started_at = ?,
      processing_attempts = COALESCE(processing_attempts, 0) + 1,
      processing_error = NULL,
      updated_at = ?
    WHERE user_id = ? AND id = ? AND classification = 'UNCLASSIFIED'
      AND (
        (processing_status IN ('PENDING', 'RETRY', 'HOLD') AND (next_retry_at IS NULL OR next_retry_at <= ?))
        OR (processing_status = 'PROCESSING' AND (processing_started_at IS NULL OR processing_started_at <= ?))
      )`)
    .bind(now, now, event.user_id, event.id, now, staleBefore)
    .run();
  return runChanges(result) > 0;
}

async function persistClassification(
  db: D1Database,
  event: EmailEventRow,
  result: Omit<ClassificationResult, "id" | "userId">,
  telemetry: { model?: string | null; usage?: AiUsage | null; latencyMs?: number | null },
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE user_email_events
    SET
      classification = ?,
      classification_confidence = ?,
      classification_source = ?,
      summary = ?,
      company = ?,
      job_title = ?,
      recruiter_name = ?,
      action = ?,
      processing_status = 'CLASSIFIED',
      processing_started_at = NULL,
      next_retry_at = NULL,
      processing_error = NULL,
      classified_at = ?,
      classifier_version = ?,
      prompt_version = ?,
      ai_model = ?,
      ai_input_tokens = ?,
      ai_output_tokens = ?,
      ai_total_tokens = ?,
      ai_latency_ms = ?,
      updated_at = ?
    WHERE user_id = ? AND id = ? AND classification = 'UNCLASSIFIED'`)
    .bind(
      result.classification,
      result.confidence,
      result.source,
      result.summary,
      result.company,
      result.jobTitle,
      result.recruiterName,
      result.action,
      now,
      EMAIL_CLASSIFIER_VERSION,
      EMAIL_CLASSIFIER_PROMPT_VERSION,
      telemetry.model ?? null,
      telemetry.usage?.inputTokens ?? null,
      telemetry.usage?.outputTokens ?? null,
      telemetry.usage?.totalTokens ?? null,
      telemetry.latencyMs ?? null,
      now,
      event.user_id,
      event.id,
    )
    .run();
}

function retryAt(attempt: number): string {
  const delayMinutes = attempt <= 1 ? 1 : attempt === 2 ? 5 : 15;
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function nextUtcBudgetWindow(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
  return next.toISOString();
}

async function markProcessingState(
  db: D1Database,
  event: EmailEventRow,
  status: "RETRY" | "FAILED" | "HOLD",
  errorCode: string,
  nextRetryAt: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`UPDATE user_email_events
    SET processing_status = ?, processing_started_at = NULL, processing_error = ?, next_retry_at = ?, updated_at = ?
    WHERE user_id = ? AND id = ? AND classification = 'UNCLASSIFIED'`)
    .bind(status, errorCode.slice(0, 500), nextRetryAt, now, event.user_id, event.id)
    .run();
}

async function reserveBudgetRow(
  db: D1Database,
  date: string,
  scope: "USER" | "GLOBAL",
  key: string,
  limit: number,
  now: string,
): Promise<boolean> {
  const result = await db.prepare(`INSERT INTO email_ai_daily_usage (
    usage_date, scope, scope_key, reserved_calls, completed_calls, failed_calls,
    input_tokens, output_tokens, total_tokens, updated_at
  ) VALUES (?, ?, ?, 1, 0, 0, 0, 0, 0, ?)
  ON CONFLICT(usage_date, scope, scope_key) DO UPDATE SET
    reserved_calls = email_ai_daily_usage.reserved_calls + 1,
    updated_at = excluded.updated_at
  WHERE email_ai_daily_usage.reserved_calls < ?`)
    .bind(date, scope, key, now, limit)
    .run();
  return runChanges(result) > 0;
}

async function releaseBudgetRow(db: D1Database, date: string, scope: "USER" | "GLOBAL", key: string): Promise<void> {
  await db.prepare(`UPDATE email_ai_daily_usage
    SET reserved_calls = CASE WHEN reserved_calls > 0 THEN reserved_calls - 1 ELSE 0 END,
        updated_at = ?
    WHERE usage_date = ? AND scope = ? AND scope_key = ?`)
    .bind(new Date().toISOString(), date, scope, key)
    .run();
}

async function reserveAiBudget(db: D1Database, userId: string, env: EmailClassifierEnv): Promise<{ date: string } | null> {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const userLimit = positiveInteger(env.EMAIL_AI_DAILY_USER_LIMIT, DEFAULT_USER_DAILY_AI_LIMIT);
  const globalLimit = positiveInteger(env.EMAIL_AI_DAILY_GLOBAL_LIMIT, DEFAULT_GLOBAL_DAILY_AI_LIMIT);

  if (!await reserveBudgetRow(db, date, "USER", userId, userLimit, now)) return null;
  if (!await reserveBudgetRow(db, date, "GLOBAL", "all", globalLimit, now)) {
    await releaseBudgetRow(db, date, "USER", userId);
    return null;
  }
  return { date };
}

async function recordAiUsage(
  db: D1Database,
  date: string,
  userId: string,
  usage: AiUsage | null,
  success: boolean,
): Promise<void> {
  const completedDelta = success ? 1 : 0;
  const failedDelta = success ? 0 : 1;
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  const total = usage?.totalTokens ?? 0;
  const now = new Date().toISOString();

  for (const [scope, key] of [["USER", userId], ["GLOBAL", "all"]] as const) {
    await db.prepare(`UPDATE email_ai_daily_usage
      SET completed_calls = completed_calls + ?,
          failed_calls = failed_calls + ?,
          input_tokens = input_tokens + ?,
          output_tokens = output_tokens + ?,
          total_tokens = total_tokens + ?,
          updated_at = ?
      WHERE usage_date = ? AND scope = ? AND scope_key = ?`)
      .bind(completedDelta, failedDelta, input, output, total, now, date, scope, key)
      .run();
  }
}

async function classifyWithOpenAI(event: EmailEventRow, apiKey: string, model: string): Promise<AiCallResult> {
  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-client-request-id": crypto.randomUUID(),
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      store: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "gimmejob_email_classification",
          strict: true,
          schema: CLASSIFICATION_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: EMAIL_CLASSIFIER_INSTRUCTIONS },
        {
          role: "user",
          content: JSON.stringify({
            UNTRUSTED_EMAIL: {
              receivedAt: event.received_at,
              senderName: event.sender_name,
              senderEmail: event.sender_email,
              subject: event.subject,
              textExcerpt: event.text_excerpt,
            },
          }),
        },
      ],
    }),
  });

  const latencyMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(`OpenAI email classification failed: HTTP ${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const choices = payload.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content !== "string") throw new Error("OpenAI returned no structured email classification.");
  const rawUsage = payload.usage as Record<string, unknown> | undefined;
  const inputTokens = Number(rawUsage?.prompt_tokens ?? 0);
  const outputTokens = Number(rawUsage?.completion_tokens ?? 0);
  const totalTokens = Number(rawUsage?.total_tokens ?? inputTokens + outputTokens);

  return {
    result: normalizedAiResult(JSON.parse(content), model),
    usage: {
      inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
      outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    },
    latencyMs,
  };
}

function publicRuleResult(id: string, userId: string, result: RuleClassification) {
  return { id, userId, processingStatus: "CLASSIFIED", ...result };
}

export async function handleEmailClassification(request: Request, env: EmailClassifierEnv): Promise<Response> {
  const authError = authorizationError(request, env);
  if (authError) return authError;
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  const payload = await requestJson(request);
  if (payload instanceof Response) return payload;
  const id = requiredId(payload, "id");
  const userId = requiredId(payload, "userId");
  if (!id || !userId) return json({ error: "id and userId are required." }, 400);

  let event: EmailEventRow | null;
  try {
    event = await env.DB.prepare(`SELECT
      id, user_id, received_at, sender_name, sender_email, subject, text_excerpt,
      classification, classification_confidence, classification_source, summary, company,
      job_title, recruiter_name, action, processing_status, processing_started_at, processing_attempts
    FROM user_email_events
    WHERE user_id = ? AND id = ?
    LIMIT 1`)
      .bind(userId, id)
      .first<EmailEventRow>();
  } catch {
    return json({ error: "Failed to load email event." }, 500);
  }

  if (!event) return json({ error: "Email event was not found." }, 404);
  if (event.classification !== "UNCLASSIFIED") {
    const existing = existingResult(event);
    return existing
      ? json({ ...existing, processingStatus: "CLASSIFIED", reused: true })
      : json({ error: "Email event is already classified." }, 409);
  }

  const now = new Date().toISOString();
  try {
    if (!await claimEvent(env.DB, event, now)) {
      return json({ id, userId, processingStatus: "BUSY", message: "Email event is already being processed or is waiting for retry." }, 202);
    }
  } catch {
    return json({ error: "Failed to claim email event for processing." }, 500);
  }

  const attempt = (event.processing_attempts ?? 0) + 1;
  const rule = preAiClassification(event);
  if (rule) {
    await persistClassification(env.DB, event, rule, {});
    return json(publicRuleResult(id, userId, rule));
  }

  const fallback = fallbackClassification(event);
  const apiKey = env.OPENAI_API_KEY?.trim() ?? "";
  const model = env.OPENAI_MODEL?.trim() || "gpt-5.6";

  if (!aiEnabled(env)) {
    if (fallback) {
      const disabledFallback = { ...fallback, source: fallback.source.replace(/^RULE:/, "FALLBACK:AI_DISABLED:") };
      await persistClassification(env.DB, event, disabledFallback, {});
      return json(publicRuleResult(id, userId, disabledFallback));
    }
    await markProcessingState(env.DB, event, "HOLD", "AI_DISABLED", nextUtcBudgetWindow());
    return json({ id, userId, processingStatus: "HOLD", reason: "AI_DISABLED" }, 202);
  }

  if (!apiKey) {
    if (fallback) {
      const noKeyFallback = { ...fallback, source: fallback.source.replace(/^RULE:/, "FALLBACK:NO_OPENAI_KEY:") };
      await persistClassification(env.DB, event, noKeyFallback, {});
      return json(publicRuleResult(id, userId, noKeyFallback));
    }
    await markProcessingState(env.DB, event, "HOLD", "NO_OPENAI_KEY", nextUtcBudgetWindow());
    return json({ id, userId, processingStatus: "HOLD", reason: "NO_OPENAI_KEY" }, 202);
  }

  let budget: { date: string } | null;
  try {
    budget = await reserveAiBudget(env.DB, userId, env);
  } catch {
    await markProcessingState(env.DB, event, "RETRY", "AI_BUDGET_CHECK_FAILED", retryAt(attempt));
    return json({ id, userId, processingStatus: "RETRY", reason: "AI_BUDGET_CHECK_FAILED" }, 202);
  }

  if (!budget) {
    await markProcessingState(env.DB, event, "HOLD", "AI_DAILY_BUDGET_EXCEEDED", nextUtcBudgetWindow());
    return json({ id, userId, processingStatus: "HOLD", reason: "AI_DAILY_BUDGET_EXCEEDED" }, 202);
  }

  try {
    const ai = await classifyWithOpenAI(event, apiKey, model);
    await recordAiUsage(env.DB, budget.date, userId, ai.usage, true);
    await persistClassification(env.DB, event, ai.result, {
      model,
      usage: ai.usage,
      latencyMs: ai.latencyMs,
    });
    return json({
      id,
      userId,
      processingStatus: "CLASSIFIED",
      ...ai.result,
      classifierVersion: EMAIL_CLASSIFIER_VERSION,
      promptVersion: EMAIL_CLASSIFIER_PROMPT_VERSION,
      aiUsage: ai.usage,
      aiLatencyMs: ai.latencyMs,
    });
  } catch (error) {
    await recordAiUsage(env.DB, budget.date, userId, null, false);
    console.warn({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "email_ai_classification",
      outcome: "failure",
      errorType: error instanceof Error ? error.name : "UnknownError",
      attempt,
    });

    if (fallback) {
      const failedFallback = { ...fallback, source: fallback.source.replace(/^RULE:/, "FALLBACK:OPENAI_ERROR:") };
      await persistClassification(env.DB, event, failedFallback, { model });
      return json(publicRuleResult(id, userId, failedFallback));
    }

    const status = attempt >= MAX_PROCESSING_ATTEMPTS ? "FAILED" : "RETRY";
    const nextRetryAt = status === "RETRY" ? retryAt(attempt) : null;
    await markProcessingState(env.DB, event, status, "OPENAI_CLASSIFICATION_FAILED", nextRetryAt);
    return json({ id, userId, processingStatus: status, reason: "OPENAI_CLASSIFICATION_FAILED", nextRetryAt }, 202);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleEmailClassification(request, await runtimeEnv());
}
