import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function between(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  assert.ok(to > from, `missing end marker: ${end}`);
  return text.slice(from, to);
}

test("vacancy dashboard reads trust persisted intake metadata", async () => {
  const intake = await source("app/api/_vacancy-intake.ts");
  assert.doesNotMatch(intake, /LIMIT 1000/);

  const compact = between(intake, "export function compactDashboardPayload", "export async function publicVacancyById");
  assert.doesNotMatch(compact, /sanitizeDashboardPayload|filterRelevantVacancies|deduplicateVacancies/);

  const summaries = between(intake, "export async function publicVacancySummaries", "export async function publicVacancies");
  const publicJobs = between(intake, "export async function publicVacancies", "/**\n * Bootstraps an empty catalogue only.");
  assert.match(summaries, /WHERE relevant = 1/);
  assert.match(publicJobs, /WHERE relevant = 1/);
  assert.doesNotMatch(publicJobs, /sanitizeJobs|raw_json/);
});


test("anonymous legacy dashboard returns before private workflow queries", async () => {
  const legacy = await source("app/api/_jobpilot.ts");
  const legacyDashboard = between(legacy, "export async function dashboard", "export async function resumePdf");
  const anonymousBranch = between(legacyDashboard, "if (!authenticated) {", "const database = await db();");

  assert.match(anonymousBranch, /publicVacancySummaries\(\)/);
  assert.match(anonymousBranch, /buildAnonymousVacancyDashboard\(publicPayload, vacancySync, now\(\)\)/);
  assert.doesNotMatch(anonymousBranch, /analyses|resume_variants|application_drafts|status_updated_at/);
});

test("dashboard list queries never project raw vacancy JSON or resume PDFs", async () => {
  const legacy = await source("app/api/_jobpilot.ts");
  const legacyDashboard = between(legacy, "export async function dashboard", "export async function resumePdf");
  assert.doesNotMatch(legacyDashboard, /SELECT \* FROM jobs|SELECT \* FROM resume_variants|raw_json/);

  const tenant = await source("app/api/_tenant-state.ts");
  const tenantDashboard = between(tenant, "async function dashboard", "return {\n    dashboard,");
  assert.doesNotMatch(tenantDashboard, /SELECT \* FROM user_resume_variants|SELECT \* FROM user_analyses|SELECT \* FROM job_tracking/);
});
