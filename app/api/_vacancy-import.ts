import type { IntakeJob } from "../../agent/src/job-intake.js";
import { normalizeVacancyDescription } from "../../agent/src/vacancy-content.js";
import { upsertVacancies } from "./_vacancy-intake";

type Json = Record<string, unknown>;

function object(value: unknown, index: number): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Imported job ${index + 1} must be an object.`);
  }
  return value as Json;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : fallback;
}

function required(job: Json, key: string, index: number): string {
  const value = text(job[key]);
  if (!value) throw new Error(`Imported job ${index + 1} is missing ${key}.`);
  return value;
}

function url(value: unknown, fallback: string): string {
  const candidate = text(value, fallback);
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function normalizeImportedJob(value: unknown, index: number): IntakeJob {
  const job = object(value, index);
  const title = required(job, "title", index);
  const company = required(job, "company", index);
  const fallbackUrl = "https://example.com";
  const jobUrl = url(job.url, fallbackUrl);
  const description = normalizeVacancyDescription(job.description);
  const location = text(job.location, "Unknown");

  return {
    source: text(job.source, "manual:web"),
    externalId: text(job.externalId) || null,
    title,
    company,
    location,
    remote: Boolean(job.remote) || /\b(remote|віддален|дистанційн|ремоут)\b/iu.test(`${location}\n${description}`),
    url: jobUrl,
    applyUrl: url(job.applyUrl, jobUrl),
    description,
    salaryText: text(job.salaryText) || null,
    postedAt: text(job.postedAt) || null,
    contactEmail: text(job.contactEmail) || null,
    raw: job,
  };
}

export async function upsertImportedVacancies(values: unknown[]) {
  return upsertVacancies(values.map(normalizeImportedJob));
}
