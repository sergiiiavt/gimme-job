type Json = Record<string, unknown>;

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_JOBS = 500;
const DOU_HOST = "jobs.dou.ua";
const DOU_IMPORT_MODE = "dou-import";

export interface DouImportResult {
  relevant: number;
  rejected: number;
  inserted: number;
  updated: number;
  [key: string]: unknown;
}

type DouUpsert = (jobs: unknown[]) => Promise<DouImportResult>;

class DouImportValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DouImportValidationError";
    this.status = status;
  }
}

function response(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function numericContentLength(request: Request): number {
  const value = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(value) ? value : 0;
}

async function importPayload(request: Request): Promise<unknown> {
  if (numericContentLength(request) > MAX_IMPORT_BYTES) {
    throw new DouImportValidationError("Request is too large.", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    throw new DouImportValidationError("Request is too large.", 413);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new DouImportValidationError("Request body must be valid JSON.");
  }
}

export function normalizeDouImportJobs(payload: unknown): Json[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new DouImportValidationError("Request body must be a JSON object.");
  }
  const jobs = (payload as Json).jobs;
  if (!Array.isArray(jobs)) throw new DouImportValidationError("jobs must be an array.");
  if (jobs.length > MAX_IMPORT_JOBS) {
    throw new DouImportValidationError(`jobs must contain at most ${MAX_IMPORT_JOBS} vacancies.`);
  }

  return jobs.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new DouImportValidationError(`Job ${index + 1} must be an object.`);
    }
    const job = value as Json;
    const rawUrl = typeof job.url === "string" ? job.url.trim() : "";
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new DouImportValidationError(`Job ${index + 1} has an invalid URL.`);
    }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== DOU_HOST || !/^\/companies\/.+\/vacancies\/\d+\/?$/.test(url.pathname)) {
      throw new DouImportValidationError(`Job ${index + 1} is not a DOU vacancy URL.`);
    }
    url.search = "";
    url.hash = "";
    const idMatch = /\/vacancies\/(\d+)\/?$/.exec(url.pathname);
    const externalId = idMatch?.[1] ?? null;
    return {
      ...job,
      source: "rss:dou-qa",
      externalId,
      url: url.toString(),
      applyUrl: url.toString(),
    };
  });
}

export async function handleDouVacancyImport(
  request: Request,
  upsert: DouUpsert,
): Promise<Response | null> {
  if (request.headers.get("x-gimmejob-mode") !== DOU_IMPORT_MODE) return null;
  const startedAt = Date.now();

  try {
    const payload = await importPayload(request);
    const jobs = normalizeDouImportJobs(payload);
    const result = await upsert(jobs);
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
    return response({ ok: true, result });
  } catch (error) {
    const validation = error instanceof DouImportValidationError;
    const message = error instanceof Error ? error.message : String(error);
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
    if (validation) return response({ error: message }, error.status);
    return response({ error: "DOU vacancy import failed." }, 500);
  }
}
