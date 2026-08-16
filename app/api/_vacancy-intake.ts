import type { JobInput } from "../../agent/src/domain.js";
import {
  areDuplicateVacancies,
  deduplicateVacancies,
  filterRelevantVacancies,
  mergeDuplicateVacancies,
  type IntakeJob,
} from "../../agent/src/job-intake.js";
import { AshbySource, GreenhouseSource, LeverSource } from "../../agent/src/sources/ats.js";
import { LobbyXSource } from "../../agent/src/sources/lobbyx.js";
import { RobotaUaSource } from "../../agent/src/sources/robotaua.js";
import { RssJobSource } from "../../agent/src/sources/rss.js";
import { collectAllSources, type JobSource } from "../../agent/src/sources/types.js";
import { normalizeVacancyDescription } from "../../agent/src/vacancy-content.js";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Row>(): Promise<T | null>;
      all<T = Row>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
    first<T = Row>(): Promise<T | null>;
    all<T = Row>(): Promise<{ results: T[] }>;
  };
}

export interface VacancySourceError {
  source: string;
  error: string;
}

export interface VacancySourceSkip {
  source: string;
  reason: string;
}

export interface VacancySyncResult {
  seen: number;
  relevant: number;
  rejected: number;
  duplicates: number;
  inserted: number;
  updated: number;
  accepted: number;
  errors: VacancySourceError[];
  skipped: VacancySourceSkip[];
}

export const DEFAULT_VACANCY_SOURCES = {
  rss: [
    { name: "dou-qa", url: "https://jobs.dou.ua/vacancies/feeds/?search=QA" },
    { name: "djinni-qa", url: "https://djinni.co/jobs/rss/?primary_keyword=QA" },
  ],
  greenhouse: [] as Json[],
  lever: [] as Json[],
  ashby: [] as Json[],
  workUa: [{ name: "workua-qa", query: "QA Engineer" }],
  robotaUa: [{ name: "robotaua-qa", query: "QA Engineer" }],
  lobbyX: [{ name: "lobbyx-qa", query: "QA Engineer" }],
};

async function database(override?: D1DatabaseLike): Promise<D1DatabaseLike> {
  if (override) return override;
  const runtime = (await import("cloudflare:workers")).env as unknown as { DB?: D1DatabaseLike };
  if (!runtime.DB) throw new Error("Cloud database is not available.");
  return runtime.DB;
}

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function sourceArray(config: Json, key: string, fallback: Json[]): Json[] {
  return Array.isArray(config[key]) ? config[key] as Json[] : fallback;
}

function isPrivateIpv4(host: string): boolean {
  return /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
}

export function publicHttpsUrl(value: unknown): string {
  const raw = cleanText(value);
  if (!raw) throw new Error("Source URL is missing.");
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  const blockedHost = host === "localhost"
    || host === "::1"
    || host.endsWith(".local")
    || isPrivateIpv4(host);
  if (url.protocol !== "https:" || blockedHost) {
    throw new Error("Only public HTTPS source URLs are allowed.");
  }
  return url.toString();
}

async function sourceConfig(databaseOverride?: D1DatabaseLike): Promise<Json> {
  const db = await database(databaseOverride);
  const row = await db.prepare("SELECT value_json FROM settings WHERE key = ?").bind("sources").first<Row>();
  const configured = row ? parseJson<Json>(row.value_json, {}) : {};
  return {
    ...configured,
    rss: sourceArray(configured, "rss", DEFAULT_VACANCY_SOURCES.rss),
    greenhouse: sourceArray(configured, "greenhouse", DEFAULT_VACANCY_SOURCES.greenhouse),
    lever: sourceArray(configured, "lever", DEFAULT_VACANCY_SOURCES.lever),
    ashby: sourceArray(configured, "ashby", DEFAULT_VACANCY_SOURCES.ashby),
    workUa: sourceArray(configured, "workUa", DEFAULT_VACANCY_SOURCES.workUa),
    robotaUa: sourceArray(configured, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa),
    lobbyX: sourceArray(configured, "lobbyX", DEFAULT_VACANCY_SOURCES.lobbyX),
  };
}

export function buildVacancySources(config: Json): JobSource[] {
  const sources: JobSource[] = [];

  for (const source of sourceArray(config, "rss", DEFAULT_VACANCY_SOURCES.rss)) {
    const name = cleanText(source.name, "rss");
    sources.push(new RssJobSource(name, publicHttpsUrl(source.url)));
  }
  for (const source of sourceArray(config, "greenhouse", [])) {
    const name = cleanText(source.name);
    const board = cleanText(source.board);
    if (name && board) sources.push(new GreenhouseSource(name, board));
  }
  for (const source of sourceArray(config, "lever", [])) {
    const name = cleanText(source.name);
    const board = cleanText(source.board);
    if (name && board) sources.push(new LeverSource(name, board));
  }
  for (const source of sourceArray(config, "ashby", [])) {
    const name = cleanText(source.name);
    const board = cleanText(source.board);
    if (name && board) sources.push(new AshbySource(name, board));
  }
  for (const source of sourceArray(config, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa)) {
    sources.push(new RobotaUaSource(cleanText(source.name, "robotaua-qa"), cleanText(source.query, "QA Engineer")));
  }
  for (const source of sourceArray(config, "lobbyX", DEFAULT_VACANCY_SOURCES.lobbyX)) {
    sources.push(new LobbyXSource(cleanText(source.name, "lobbyx-qa"), cleanText(source.query, "QA Engineer")));
  }

  return sources;
}

export function skippedCloudSources(config: Json): VacancySourceSkip[] {
  return sourceArray(config, "workUa", DEFAULT_VACANCY_SOURCES.workUa).map((source) => ({
    source: `workua:${cleanText(source.name, "workua-qa")}`,
    reason: "Direct Work.ua HTML access is blocked from cloud-hosted runners (HTTP 403); the adapter remains available for local sync only.",
  }));
}

function normalizedJob(value: IntakeJob): IntakeJob {
  const url = cleanText(value.url);
  return {
    ...value,
    source: cleanText(value.source, "job-board"),
    externalId: value.externalId ? cleanText(value.externalId) : null,
    title: cleanText(value.title, "Untitled role"),
    company: cleanText(value.company, "Unknown"),
    location: cleanText(value.location, "Unknown"),
    remote: Boolean(value.remote),
    url,
    applyUrl: cleanText(value.applyUrl, url),
    description: normalizeVacancyDescription(value.description),
    salaryText: value.salaryText ? cleanText(value.salaryText) : null,
    postedAt: value.postedAt ? cleanText(value.postedAt) : null,
    contactEmail: value.contactEmail ? cleanText(value.contactEmail) : null,
  };
}

function mapExisting(row: Row): IntakeJob & { id: string; fingerprint: string; status?: string; feedback?: string | null } {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    source: String(row.source),
    externalId: row.external_id ? String(row.external_id) : null,
    title: String(row.title),
    company: String(row.company),
    location: String(row.location),
    remote: Number(row.remote) === 1,
    url: String(row.url),
    applyUrl: String(row.apply_url),
    description: String(row.description ?? ""),
    salaryText: row.salary_text ? String(row.salary_text) : null,
    postedAt: row.posted_at ? String(row.posted_at) : null,
    contactEmail: row.contact_email ? String(row.contact_email) : null,
    raw: parseJson(row.raw_json, {}),
    status: row.status ? String(row.status) : undefined,
    feedback: row.feedback ? String(row.feedback) : null,
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function upsertVacancies(
  values: IntakeJob[],
  databaseOverride?: D1DatabaseLike,
): Promise<Omit<VacancySyncResult, "errors" | "skipped">> {
  const normalized = values.map(normalizedJob).filter((job) => job.title && job.company && job.url);
  const relevance = filterRelevantVacancies(normalized);
  const incoming = deduplicateVacancies(relevance.jobs);
  const db = await database(databaseOverride);
  const existingResult = await db.prepare("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 1000").all<Row>();
  const existing = existingResult.results.map(mapExisting);
  let inserted = 0;
  let updated = 0;
  const timestamp = new Date().toISOString();

  for (const job of incoming.jobs) {
    const duplicate = existing.find((candidate) => areDuplicateVacancies(candidate, job));
    if (duplicate) {
      const merged = mergeDuplicateVacancies(duplicate, job);
      await db.prepare(`UPDATE jobs SET
        source = ?, external_id = COALESCE(?, external_id), title = ?, company = ?, location = ?, remote = ?,
        url = ?, apply_url = ?, description = ?, salary_text = COALESCE(?, salary_text),
        posted_at = COALESCE(?, posted_at), contact_email = COALESCE(?, contact_email), updated_at = ?, raw_json = ?
        WHERE id = ?`)
        .bind(
          merged.source,
          merged.externalId,
          merged.title,
          merged.company,
          merged.location,
          merged.remote ? 1 : 0,
          merged.url,
          merged.applyUrl,
          merged.description,
          merged.salaryText,
          merged.postedAt,
          merged.contactEmail,
          timestamp,
          JSON.stringify(merged.raw ?? {}),
          duplicate.id,
        )
        .run();
      Object.assign(duplicate, merged);
      updated += 1;
      continue;
    }

    const fingerprint = await sha256(`${job.source}|${job.externalId || job.url}`);
    const id = `job_${fingerprint.slice(0, 20)}`;
    await db.prepare(`INSERT INTO jobs (
      id, fingerprint, source, external_id, title, company, location, remote, url, apply_url, description,
      salary_text, posted_at, contact_email, discovered_at, updated_at, status, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
    ON CONFLICT(fingerprint) DO UPDATE SET
      source = excluded.source,
      external_id = COALESCE(excluded.external_id, jobs.external_id),
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      remote = MAX(jobs.remote, excluded.remote),
      url = excluded.url,
      apply_url = excluded.apply_url,
      description = CASE WHEN length(excluded.description) > length(jobs.description) THEN excluded.description ELSE jobs.description END,
      salary_text = COALESCE(excluded.salary_text, jobs.salary_text),
      posted_at = COALESCE(excluded.posted_at, jobs.posted_at),
      contact_email = COALESCE(excluded.contact_email, jobs.contact_email),
      updated_at = excluded.updated_at,
      raw_json = excluded.raw_json`)
      .bind(
        id,
        fingerprint,
        job.source,
        job.externalId,
        job.title,
        job.company,
        job.location,
        job.remote ? 1 : 0,
        job.url,
        job.applyUrl,
        job.description,
        job.salaryText,
        job.postedAt,
        job.contactEmail,
        timestamp,
        timestamp,
        JSON.stringify(job.raw ?? {}),
      )
      .run();
    existing.push({ ...job, id, fingerprint });
    inserted += 1;
  }

  return {
    seen: normalized.length,
    relevant: relevance.jobs.length,
    rejected: relevance.rejected.length,
    duplicates: incoming.duplicateCount,
    inserted,
    updated,
    accepted: inserted + updated,
  };
}

export async function syncVacancySources(databaseOverride?: D1DatabaseLike): Promise<VacancySyncResult> {
  const config = await sourceConfig(databaseOverride);
  const results = await collectAllSources(buildVacancySources(config));
  const intake = results.find((result) => result.source === "intake");
  const errors = results
    .filter((result) => result.error)
    .map((result) => ({ source: result.source, error: result.error ?? "Unknown source failure" }));
  const jobs = intake?.jobs ?? [];
  const stored = await upsertVacancies(jobs, databaseOverride);

  return {
    ...stored,
    seen: intake?.seen ?? jobs.length,
    relevant: jobs.length,
    rejected: intake?.rejected ?? 0,
    duplicates: intake?.duplicates ?? stored.duplicates,
    errors,
    skipped: skippedCloudSources(config),
  };
}

function displaySource(source: string): string {
  const labels: string[] = [];
  const value = String(source ?? "").toLowerCase();
  if (value.includes("dou")) labels.push("DOU");
  if (value.includes("djinni")) labels.push("Djinni");
  if (value.includes("workua") || value.includes("work.ua")) labels.push("Work.ua");
  if (value.includes("robotaua") || value.includes("robota.ua") || value.includes("rabota")) labels.push("Robota.ua");
  if (value.includes("lobby")) labels.push("Lobby X");
  if (value.includes("greenhouse")) labels.push("Greenhouse");
  if (value.includes("lever")) labels.push("Lever");
  if (value.includes("ashby")) labels.push("Ashby");
  return labels.length ? [...new Set(labels)].join(" + ") : source.replace(/^\w+:/, "") || "Job board";
}

function isCompleteJob(value: unknown): value is IntakeJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<JobInput>;
  return typeof job.title === "string"
    && typeof job.company === "string"
    && typeof job.location === "string"
    && typeof job.url === "string"
    && typeof job.applyUrl === "string"
    && typeof job.description === "string";
}

export function sanitizeJobs<T extends IntakeJob>(jobs: T[]): T[] {
  const normalized = jobs.map((job) => ({ ...job, description: normalizeVacancyDescription(job.description) }));
  const relevant = filterRelevantVacancies(normalized).jobs;
  return deduplicateVacancies(relevant).jobs.map((job) => ({ ...job, source: displaySource(job.source) }));
}

export function sanitizeDashboardPayload<T extends { jobs?: unknown }>(payload: T): T {
  if (!Array.isArray(payload.jobs)) return payload;
  const complete = payload.jobs.filter(isCompleteJob) as IntakeJob[];
  const incomplete = payload.jobs.filter((job) => !isCompleteJob(job));
  return { ...payload, jobs: [...sanitizeJobs(complete), ...incomplete] } as T;
}

export async function publicVacancies(databaseOverride?: D1DatabaseLike): Promise<{
  jobs: Array<IntakeJob & { id: string; discoveredAt: string }>;
  generatedAt: string;
}> {
  const db = await database(databaseOverride);
  const result = await db.prepare(`SELECT
    id, fingerprint, source, external_id, title, company, location, remote, url, apply_url, description,
    salary_text, posted_at, contact_email, discovered_at, raw_json
    FROM jobs
    ORDER BY COALESCE(posted_at, discovered_at) DESC, discovered_at DESC
    LIMIT 500`).all<Row>();
  const jobs = result.results.map((row) => ({
    ...mapExisting(row),
    id: String(row.id),
    discoveredAt: String(row.discovered_at),
  }));
  return { jobs: sanitizeJobs(jobs), generatedAt: new Date().toISOString() };
}

export async function ensureVacancyCatalog(databaseOverride?: D1DatabaseLike): Promise<void> {
  const db = await database(databaseOverride);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM jobs").first<Row>();
  if (Number(row?.count ?? 0) > 0) return;
  await syncVacancySources(databaseOverride);
}

export function mergeVacancySourceDefaults(value: unknown): Json {
  const settings = value && typeof value === "object" ? value as Json : {};
  const sources = settings.sources && typeof settings.sources === "object" ? settings.sources as Json : {};
  return {
    ...settings,
    sources: {
      ...sources,
      robotaUa: sourceArray(sources, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa),
    },
  };
}
