import { RssJobSource } from "../agent/src/sources/rss.js";

const DEFAULT_APP_URL = "https://gimmejob.gimmejob.workers.dev";
const DOU_LISTING_URL = "https://jobs.dou.ua/vacancies/?category=QA";
const MIN_EXPECTED_VACANCIES = 100;
const IMPORT_CHUNK_SIZE = 40;
const REPORTED_REGRESSION_IDS = new Set(["368919", "368979", "364050"]);

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function externalId(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/** A failure with the step it happened in. Messages never contain the token or request headers. */
class SyncStepError extends Error {
  constructor(readonly step: string, message: string) {
    super(message);
    this.name = "SyncStepError";
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  // fetch() reports network failures as "fetch failed" and puts the reason (DNS, refused, reset, TLS) in `cause`.
  const cause = (error as { cause?: unknown }).cause;
  const reason = cause instanceof Error
    ? ` (${[(cause as { code?: unknown }).code, cause.message].filter((part) => typeof part === "string" && part).join(": ")})`
    : "";
  return `${error.name}: ${error.message}${reason}`;
}

async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw error instanceof SyncStepError ? error : new SyncStepError(name, describeError(error));
  }
}

/** Server text is untrusted: control characters (line breaks included) become spaces before it is logged. */
function singleLine(text: string, limit: number): string {
  return text.slice(0, limit * 2).replace(/\p{Cc}+/gu, " ").trim().slice(0, limit);
}

/** The route answers with {"error": "..."}; anything else (a platform error page) is shown as a short excerpt. */
function responseDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string") return singleLine(parsed.error, 300);
  } catch {
    // not JSON
  }
  return singleLine(body, 200);
}

async function verifyReportedVacancies(appUrl: string, collected: Array<{ externalId?: string | null }>): Promise<void> {
  const expected = new Set(
    collected
      .map((job) => externalId(job.externalId))
      .filter((id): id is string => Boolean(id) && REPORTED_REGRESSION_IDS.has(id)),
  );
  if (expected.size === 0) return;

  const response = await fetch(`${appUrl}/api/public/jobs`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Production vacancy verification request failed.");

  const payload = await response.json() as { jobs?: Array<{ externalId?: unknown }> };
  const visible = new Set(
    Array.isArray(payload.jobs)
      ? payload.jobs.map((job) => externalId(job.externalId)).filter((id): id is string => Boolean(id))
      : [],
  );
  const missing = [...expected].filter((id) => !visible.has(id));
  if (missing.length > 0) throw new Error("Reported DOU vacancy regression check failed.");

  console.log(`Production DOU regression check passed: ${expected.size}/${expected.size} reported vacancies visible.`);
}

async function importChunk(appUrl: string, token: string, chunk: unknown[], label: string): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  const response = await step("import", () => fetch(`${appUrl}/internal/n8n/vacancies-sync`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-gimmejob-mode": "dou-import",
      "x-gimmejob-trigger": process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "manual",
    },
    body: JSON.stringify({ jobs: chunk }),
    signal: AbortSignal.timeout(120_000),
  }));
  const body = await step("import", () => response.text());
  if (!response.ok) {
    const detail = responseDetail(body);
    const summary = `${label}: HTTP ${response.status} after ${Date.now() - startedAt} ms`;
    throw new SyncStepError("import", detail ? `${summary}: ${detail}` : summary);
  }
  const payload = body ? JSON.parse(body) as { result?: Record<string, unknown> } : {};
  return payload.result ?? {};
}

async function main(): Promise<void> {
  const token = requiredEnvironment("N8N_INGEST_TOKEN");
  const appUrl = new URL(process.env.GIMMEJOB_URL?.trim() || DEFAULT_APP_URL).origin;
  // This runner is a plain Node process on a GitHub-hosted machine: no
  // subrequest ceiling and a ten-minute budget, so it enriches the whole
  // catalogue. The Worker-hosted sync keeps the bounded default.
  const source = new RssJobSource("dou-qa", DOU_LISTING_URL, { detailBudget: Number.POSITIVE_INFINITY });
  const jobs = await step("discovery", () => source.collect());
  const detailed = jobs.filter((job) => (job.raw as { descriptionSource?: unknown } | undefined)?.descriptionSource === "detail-page").length;
  console.log(`DOU discovery: ${jobs.length} vacancies, ${detailed} with a detail-page description.`);

  if (jobs.length < MIN_EXPECTED_VACANCIES) {
    throw new SyncStepError("discovery", `only ${jobs.length} vacancies, fewer than the expected ${MIN_EXPECTED_VACANCIES}.`);
  }

  // One request per chunk. The Worker has a fixed memory and CPU budget per request, and importing the
  // whole catalogue in one request exceeded it (Cloudflare error 1102, from 2026-09-27). Upserts are
  // idempotent and each chunk finds the rows of earlier chunks as duplicate candidates, so the result
  // is the same as one large import.
  const totals = { relevant: 0, rejected: 0, inserted: 0, updated: 0 };
  const chunks = Math.ceil(jobs.length / IMPORT_CHUNK_SIZE);
  for (let index = 0; index < chunks; index += 1) {
    const chunk = jobs.slice(index * IMPORT_CHUNK_SIZE, (index + 1) * IMPORT_CHUNK_SIZE);
    const result = await importChunk(appUrl, token, chunk, `chunk ${index + 1}/${chunks}`);
    totals.relevant += numberField(result.relevant);
    totals.rejected += numberField(result.rejected);
    totals.inserted += numberField(result.inserted);
    totals.updated += numberField(result.updated);
  }
  console.log(`DOU runner sync complete: ${jobs.length} collected in ${chunks} requests, ${totals.relevant} relevant, `
    + `${totals.rejected} rejected, ${totals.inserted} inserted, ${totals.updated} updated.`);

  await step("verification", () => verifyReportedVacancies(appUrl, jobs));
}

try {
  await main();
} catch (error) {
  // One JSON line: any text that came from the network stays inside a quoted, escaped value.
  console.error(JSON.stringify({
    event: "dou_runner_sync",
    outcome: "failure",
    step: error instanceof SyncStepError ? error.step : "setup",
    error: error instanceof SyncStepError ? error.message : describeError(error),
  }));
  process.exitCode = 1;
}
