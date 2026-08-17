import { bearerToken, constantTimeEqual } from "../email-events/email-event.ts";

const REPORT_TIME_ZONE = "Europe/Kyiv";
const MAX_USER_ID_LENGTH = 512;
const IMPORTANT_LIMIT = 20;

export type EmailStatsEnv = {
  DB?: D1Database;
  N8N_INGEST_TOKEN?: string;
};

type SummaryRow = {
  received: number | null;
  processed: number | null;
  pending: number | null;
  job_relevant: number | null;
  job_alerts: number | null;
  non_job: number | null;
  service_messages: number | null;
  held: number | null;
  failed: number | null;
  needs_review: number | null;
  rule_processed: number | null;
  ai_processed: number | null;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  ai_total_tokens: number | null;
};

type ClassificationCountRow = {
  classification: string;
  count: number;
};

type ImportantEventRow = {
  id: string;
  user_id: string;
  received_at: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  classification: string;
  classification_confidence: number | null;
  classification_source: string | null;
  summary: string | null;
  company: string | null;
  job_title: string | null;
  recruiter_name: string | null;
  action: string | null;
};

async function runtimeEnv(): Promise<EmailStatsEnv> {
  return (await import("cloudflare:workers")).env as unknown as EmailStatsEnv;
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

function authorizationError(request: Request, env: EmailStatsEnv): Response | null {
  const configuredToken = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configuredToken) return json({ error: "n8n email reporting is not configured." }, 503);

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

function datePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function formatDate({ year, month, day }: { year: number; month: number; day: number }): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayInTimeZone(timeZone: string): string {
  return formatDate(datePartsInTimeZone(new Date(), timeZone));
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function nextDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return formatDate({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() });
}

function timeZoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - Math.floor(instantMs / 1000) * 1000;
}

export function localMidnightUtc(date: string, timeZone = REPORT_TIME_ZONE): string {
  if (!validDate(date)) throw new Error("Invalid report date.");
  const [year, month, day] = date.split("-").map(Number);
  const targetWallClockAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = targetWallClockAsUtc;

  for (let index = 0; index < 4; index += 1) {
    const nextGuess = targetWallClockAsUtc - timeZoneOffsetMs(guess, timeZone);
    if (Math.abs(nextGuess - guess) < 1000) {
      guess = nextGuess;
      break;
    }
    guess = nextGuess;
  }

  return new Date(guess).toISOString();
}

function optionalUserId(request: Request): string | null | undefined {
  const raw = new URL(request.url).searchParams.get("userId");
  if (raw === null || raw.trim() === "") return null;
  const clean = raw.trim();
  return clean.length <= MAX_USER_ID_LENGTH ? clean : undefined;
}

function number(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function whereClause(userId: string | null): { sql: string; values: string[] } {
  if (userId) return { sql: "received_at >= ? AND received_at < ? AND user_id = ?", values: [userId] };
  return { sql: "received_at >= ? AND received_at < ?", values: [] };
}

export async function handleEmailStats(request: Request, env: EmailStatsEnv): Promise<Response> {
  const authError = authorizationError(request, env);
  if (authError) return authError;
  if (!env.DB) return json({ error: "Cloud database is not available." }, 503);

  const url = new URL(request.url);
  const reportDate = url.searchParams.get("date")?.trim() || todayInTimeZone(REPORT_TIME_ZONE);
  if (!validDate(reportDate)) return json({ error: "date must use YYYY-MM-DD." }, 400);

  const userId = optionalUserId(request);
  if (userId === undefined) return json({ error: "userId is too long." }, 400);

  const startUtc = localMidnightUtc(reportDate, REPORT_TIME_ZONE);
  const endUtc = localMidnightUtc(nextDate(reportDate), REPORT_TIME_ZONE);
  const where = whereClause(userId);
  const baseBindings = [startUtc, endUtc, ...where.values];

  try {
    const summary = await env.DB.prepare(`SELECT
      COUNT(*) AS received,
      SUM(CASE WHEN classification <> 'UNCLASSIFIED' THEN 1 ELSE 0 END) AS processed,
      SUM(CASE WHEN classification = 'UNCLASSIFIED' AND processing_status IN ('PENDING', 'RETRY', 'PROCESSING') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN classification IN ('APPLICATION_RECEIVED', 'RECRUITER_OUTREACH', 'INTERVIEW', 'TEST_TASK', 'OFFER', 'REJECTION') THEN 1 ELSE 0 END) AS job_relevant,
      SUM(CASE WHEN classification = 'JOB_ALERT' THEN 1 ELSE 0 END) AS job_alerts,
      SUM(CASE WHEN classification = 'NON_JOB' THEN 1 ELSE 0 END) AS non_job,
      SUM(CASE WHEN classification = 'SERVICE_MESSAGE' THEN 1 ELSE 0 END) AS service_messages,
      SUM(CASE WHEN processing_status = 'HOLD' THEN 1 ELSE 0 END) AS held,
      SUM(CASE WHEN processing_status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN action IS NOT NULL AND action <> 'NO_ACTION' THEN 1 ELSE 0 END) AS needs_review,
      SUM(CASE WHEN classification_source LIKE 'RULE:%' THEN 1 ELSE 0 END) AS rule_processed,
      SUM(CASE WHEN classification_source LIKE 'OPENAI:%' THEN 1 ELSE 0 END) AS ai_processed,
      SUM(COALESCE(ai_input_tokens, 0)) AS ai_input_tokens,
      SUM(COALESCE(ai_output_tokens, 0)) AS ai_output_tokens,
      SUM(COALESCE(ai_total_tokens, 0)) AS ai_total_tokens
    FROM user_email_events
    WHERE ${where.sql}`)
      .bind(...baseBindings)
      .first<SummaryRow>();

    const classifications = await env.DB.prepare(`SELECT classification, COUNT(*) AS count
      FROM user_email_events
      WHERE ${where.sql}
      GROUP BY classification
      ORDER BY count DESC, classification ASC`)
      .bind(...baseBindings)
      .all<ClassificationCountRow>();

    const important = await env.DB.prepare(`SELECT
        id, user_id, received_at, sender_name, sender_email, subject,
        classification, classification_confidence, classification_source,
        summary, company, job_title, recruiter_name, action
      FROM user_email_events
      WHERE ${where.sql}
        AND classification IN ('APPLICATION_RECEIVED', 'RECRUITER_OUTREACH', 'INTERVIEW', 'TEST_TASK', 'OFFER', 'REJECTION', 'OTHER')
        AND COALESCE(action, 'NO_ACTION') <> 'NO_ACTION'
      ORDER BY received_at DESC
      LIMIT ?`)
      .bind(...baseBindings, IMPORTANT_LIMIT)
      .all<ImportantEventRow>();

    const processed = number(summary?.processed);
    const ruleProcessed = number(summary?.rule_processed);
    const aiProcessed = number(summary?.ai_processed);
    const routed = ruleProcessed + aiProcessed;
    const byClassification = Object.fromEntries((classifications.results ?? []).map((row) => [row.classification, number(row.count)]));

    return json({
      date: reportDate,
      timeZone: REPORT_TIME_ZONE,
      userId,
      window: { startUtc, endUtc },
      totals: {
        received: number(summary?.received),
        processed,
        pending: number(summary?.pending),
        jobRelevant: number(summary?.job_relevant),
        jobAlerts: number(summary?.job_alerts),
        nonJob: number(summary?.non_job),
        serviceMessages: number(summary?.service_messages),
        held: number(summary?.held),
        failed: number(summary?.failed),
        needsReview: number(summary?.needs_review),
      },
      routing: {
        rule: ruleProcessed,
        ai: aiProcessed,
        other: Math.max(0, processed - routed),
        aiAvoidanceRatePct: routed > 0 ? Math.round((ruleProcessed / routed) * 1000) / 10 : 100,
      },
      ai: {
        classifiedCalls: aiProcessed,
        inputTokens: number(summary?.ai_input_tokens),
        outputTokens: number(summary?.ai_output_tokens),
        totalTokens: number(summary?.ai_total_tokens),
      },
      byClassification,
      important: (important.results ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        receivedAt: row.received_at,
        senderName: row.sender_name,
        senderEmail: row.sender_email,
        subject: row.subject,
        classification: row.classification,
        confidence: row.classification_confidence,
        source: row.classification_source,
        summary: row.summary,
        company: row.company,
        jobTitle: row.job_title,
        recruiterName: row.recruiter_name,
        action: row.action,
      })),
    });
  } catch {
    return json({ error: "Failed to load email automation statistics." }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleEmailStats(request, await runtimeEnv());
}
