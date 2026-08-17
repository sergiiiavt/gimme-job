import { upsertImportedVacancies } from "../../../api/_vacancy-import";
import { syncVacancySources } from "../../../api/_vacancy-intake";
import { bearerToken, constantTimeEqual } from "../email-events/email-event";

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_JOBS = 500;
const DOU_HOST = "jobs.dou.ua";

type VacancySyncEnv = { N8N_INGEST_TOKEN?: string };
type Json = Record<string, unknown>;

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

async function requestPayload(request: Request): Promise<unknown | Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_BYTES) {
    return json({ error: "Request is too large." }, 413);
  }
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }
    return JSON.parse(text);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
}

export function normalizeDouImportJobs(payload: unknown): Json[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }
  const jobs = (payload as Json).jobs;
  if (!Array.isArray(jobs)) throw new Error("jobs must be an array.");
  if (jobs.length > MAX_IMPORT_JOBS) throw new Error(`jobs must contain at most ${MAX_IMPORT_JOBS} vacancies.`);

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
    url.search = "";
    url.hash = "";
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

function importValidationError(message: string): boolean {
  return /^(Request body|jobs |Job \d+)/.test(message);
}

export async function POST(request: Request): Promise<Response> {
  const env = await runtimeEnv();
  const authError = authorize(request, env);
  if (authError) return authError;
  const payload = await requestPayload(request);
  if (payload instanceof Response) return payload;
  const startedAt = Date.now();

  try {
    if (payload && typeof payload === "object" && !Array.isArray(payload) && (payload as Json).mode === "dou-import") {
      const jobs = normalizeDouImportJobs(payload);
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
    }

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
    const message = error instanceof Error ? error.message : String(error);
    const isImport = payload && typeof payload === "object" && !Array.isArray(payload) && (payload as Json).mode === "dou-import";
    console.error({
      schemaVersion: 1,
      service: "gimmejob",
      environment: "production",
      event: isImport ? "dou_vacancy_import" : "vacancy_sync",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
      error: message,
    });
    if (isImport && importValidationError(message)) return json({ error: message }, 400);
    return json({ error: isImport ? "DOU vacancy import failed." : "Vacancy synchronization failed." }, 500);
  }
}
