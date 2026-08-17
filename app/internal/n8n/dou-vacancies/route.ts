import { upsertImportedVacancies } from "../../../api/_vacancy-import";
import { bearerToken, constantTimeEqual } from "../email-events/email-event";

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_JOBS = 500;
const DOU_HOST = "jobs.dou.ua";

type DouImportEnv = { N8N_INGEST_TOKEN?: string };
type Json = Record<string, unknown>;

async function runtimeEnv(): Promise<DouImportEnv> {
  return (await import("cloudflare:workers")).env as unknown as DouImportEnv;
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

function authorize(request: Request, env: DouImportEnv): Response | null {
  const configured = env.N8N_INGEST_TOKEN?.trim() ?? "";
  if (!configured) return json({ error: "DOU vacancy import is not configured." }, 503);
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

function normalizedDouJobs(payload: unknown): Json[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }
  const jobs = (payload as Json).jobs;
  if (!Array.isArray(jobs)) throw new Error("jobs must be an array.");
  if (jobs.length > MAX_JOBS) throw new Error(`jobs must contain at most ${MAX_JOBS} vacancies.`);

  return jobs.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Job ${index + 1} must be an object.`);
    }
    const job = value as Json;
    const rawUrl = typeof job.url === "string" ? job.url.trim() : "";
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error(`Job ${index + 1} has an invalid URL.`);
    }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== DOU_HOST || !/^\/companies\/.+\/vacancies\/\d+\/?$/.test(url.pathname)) {
      throw new Error(`Job ${index + 1} is not a DOU vacancy URL.`);
    }
    const externalId = url.pathname.match(/\/vacancies\/(\d+)\/?$/)?.[1] ?? null;
    return {
      ...job,
      source: "rss:dou-qa",
      externalId,
      url: url.toString(),
      applyUrl: url.toString(),
    };
  });
}

export async function POST(request: Request): Promise<Response> {
  const env = await runtimeEnv();
  const authError = authorize(request, env);
  if (authError) return authError;
  const payload = await requestJson(request);
  if (payload instanceof Response) return payload;
  const startedAt = Date.now();

  try {
    const jobs = normalizedDouJobs(payload);
    const result = await upsertImportedVacancies(jobs);
    console.log({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "dou_vacancy_import",
      outcome: "success",
      durationMs: Date.now() - startedAt,
      received: jobs.length,
      relevant: result.relevant,
      rejected: result.rejected,
      inserted: result.inserted,
      updated: result.updated,
    });
    return json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const validationError = /^(Request body|jobs |Job \d+)/.test(message);
    console.error({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: "dou_vacancy_import",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
      error: message,
    });
    return json({ error: validationError ? message : "DOU vacancy import failed." }, validationError ? 400 : 500);
  }
}
