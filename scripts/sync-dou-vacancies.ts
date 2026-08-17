import { RssJobSource } from "../agent/src/sources/rss.js";

const DEFAULT_APP_URL = "https://gimmejob.gimmejob.workers.dev";
const DOU_RSS_URL = "https://jobs.dou.ua/vacancies/feeds/?search=QA";
const MIN_EXPECTED_VACANCIES = 100;
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

async function main(): Promise<void> {
  const token = requiredEnvironment("N8N_INGEST_TOKEN");
  const appUrl = new URL(process.env.GIMMEJOB_URL?.trim() || DEFAULT_APP_URL).origin;
  const source = new RssJobSource("dou-qa", DOU_RSS_URL);
  const jobs = await source.collect();

  if (jobs.length < MIN_EXPECTED_VACANCIES) {
    throw new Error("DOU discovery returned an unexpectedly incomplete catalog.");
  }

  const response = await fetch(`${appUrl}/internal/n8n/vacancies-sync`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-gimmejob-mode": "dou-import",
      "x-gimmejob-trigger": process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "manual",
    },
    body: JSON.stringify({ jobs }),
    signal: AbortSignal.timeout(120_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`DOU import returned HTTP ${response.status}.`);
  }

  const payload = body ? JSON.parse(body) as { result?: Record<string, unknown> } : {};
  const result = payload.result ?? {};
  const relevant = numberField(result.relevant);
  const rejected = numberField(result.rejected);
  const inserted = numberField(result.inserted);
  const updated = numberField(result.updated);
  console.log(`DOU runner sync complete: ${jobs.length} collected, ${relevant} relevant, ${rejected} rejected, ${inserted} inserted, ${updated} updated.`);

  await verifyReportedVacancies(appUrl, jobs);
}

try {
  await main();
} catch {
  console.error("DOU runner sync failed.");
  process.exitCode = 1;
}
