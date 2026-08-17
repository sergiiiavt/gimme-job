import { RssJobSource } from "../agent/src/sources/rss.js";

const DEFAULT_APP_URL = "https://gimmejob.gimmejob.workers.dev";
const DOU_RSS_URL = "https://jobs.dou.ua/vacancies/feeds/?search=QA";
const MIN_EXPECTED_VACANCIES = 100;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function main(): Promise<void> {
  const token = requiredEnvironment("N8N_INGEST_TOKEN");
  const appUrl = new URL(process.env.GIMMEJOB_URL?.trim() || DEFAULT_APP_URL).origin;
  const source = new RssJobSource("dou-qa", DOU_RSS_URL);
  const jobs = await source.collect();

  if (jobs.length < MIN_EXPECTED_VACANCIES) {
    throw new Error(`DOU discovery returned only ${jobs.length} vacancies; refusing to publish an unexpectedly incomplete catalog.`);
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
    const details = body ? `: ${body.slice(0, 500)}` : "";
    throw new Error(`DOU import returned HTTP ${response.status}${details}.`);
  }

  const payload = body ? JSON.parse(body) as { result?: Record<string, unknown> } : {};
  const result = payload.result ?? {};
  const relevant = numberField(result.relevant);
  const rejected = numberField(result.rejected);
  const inserted = numberField(result.inserted);
  const updated = numberField(result.updated);
  console.log(`DOU runner sync complete: ${jobs.length} collected, ${relevant} relevant, ${rejected} rejected, ${inserted} inserted, ${updated} updated.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
