import type { JobInput } from "../../agent/src/domain.js";
import {
  VacancyDuplicateIndex,
  canonicalCompany,
  canonicalUrl,
  deduplicateVacancies,
  filterRelevantVacancies,
  mergeDuplicateVacancies,
  type IntakeJob,
} from "../../agent/src/job-intake.js";
import { AshbySource, GreenhouseSource, LeverSource } from "../../agent/src/sources/ats.js";
import { DjinniListingSource } from "../../agent/src/sources/djinni.js";
import { LobbyXSource } from "../../agent/src/sources/lobbyx.js";
import { RobotaUaSource } from "../../agent/src/sources/robotaua.js";
import { RssJobSource } from "../../agent/src/sources/rss.js";
import { collectAllSources, type JobSource } from "../../agent/src/sources/types.js";
import { normalizeVacancyDescription } from "../../agent/src/vacancy-content.js";
import {
  markVacancySyncFailed,
  markVacancySyncStarted,
  markVacancySyncSucceeded,
  readVacancySyncState,
  vacancySyncFreshness,
  type VacancySourceHealth,
  type VacancySyncState,
} from "./_vacancy-sync-state";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

export interface D1BoundStatementLike {
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): D1BoundStatementLike;
    first<T = Row>(): Promise<T | null>;
    all<T = Row>(): Promise<{ results: T[] }>;
  };
  /** Present on D1 itself; absent on the minimal shapes tests supply. */
  batch?(statements: D1BoundStatementLike[]): Promise<unknown>;
}

export interface VacancySourceError {
  source: string;
  error: string;
}

export interface VacancySourceSkip {
  source: string;
  reason: string;
}

/** Raised when configured sources produced no vacancies, whether by errors or empty parser results. */
export class VacancySyncFailure extends Error {
  readonly errors: VacancySourceError[];
  readonly sources: VacancySourceHealth[];

  constructor(errors: VacancySourceError[], sources: VacancySourceHealth[] = []) {
    const detail = errors.map((entry) => `${entry.source}: ${entry.error}`).join("; ");
    super(`Vacancy sync collected nothing. ${detail}`);
    this.name = "VacancySyncFailure";
    this.errors = errors;
    this.sources = sources;
  }
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
    { name: "dou-qa", url: "https://jobs.dou.ua/vacancies/?category=QA" },
  ],
  // Djinni separates manual QA and automation into different catalogues.
  djinni: [
    { name: "djinni-qa", query: "QA" },
    { name: "djinni-qa-automation", query: "QA Automation" },
  ],
  greenhouse: [] as Json[],
  lever: [] as Json[],
  ashby: [] as Json[],
  // Work.ua answers every automated request with HTTP 403, from cloud runners
  // and from residential networks alike. It stays out of the default set until
  // partner access exists; configuring it explicitly still reports it skipped.
  workUa: [] as Json[],
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

/** Upgrade the one-query default written by #466 without overriding deliberate custom Djinni arrays. */
function djinniSourceArray(config: Json): Json[] {
  const configured = sourceArray(config, "djinni", DEFAULT_VACANCY_SOURCES.djinni);
  const legacyDefault = configured.length === 1
    && cleanText(configured[0]?.name) === "djinni-qa"
    && cleanText(configured[0]?.query) === "QA";
  return legacyDefault ? DEFAULT_VACANCY_SOURCES.djinni : configured;
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
    djinni: djinniSourceArray(configured),
    greenhouse: sourceArray(configured, "greenhouse", DEFAULT_VACANCY_SOURCES.greenhouse),
    lever: sourceArray(configured, "lever", DEFAULT_VACANCY_SOURCES.lever),
    ashby: sourceArray(configured, "ashby", DEFAULT_VACANCY_SOURCES.ashby),
    workUa: sourceArray(configured, "workUa", DEFAULT_VACANCY_SOURCES.workUa),
    robotaUa: sourceArray(configured, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa),
    lobbyX: sourceArray(configured, "lobbyX", DEFAULT_VACANCY_SOURCES.lobbyX),
  };
}

type BoardSource = new (name: string, board: string) => JobSource;
type QuerySource = new (name: string, query: string) => JobSource;

/** An ATS board is only usable when both the company label and the board slug are configured. */
function boardSources(config: Json, key: string, Source: BoardSource): JobSource[] {
  return sourceArray(config, key, []).flatMap((source) => {
    const name = cleanText(source.name);
    const board = cleanText(source.board);
    return name && board ? [new Source(name, board)] : [];
  });
}

function querySources(config: Json, key: string, fallback: Json[], Source: QuerySource, defaults: { name: string; query: string }): JobSource[] {
  return sourceArray(config, key, fallback)
    .map((source) => new Source(cleanText(source.name, defaults.name), cleanText(source.query, defaults.query)));
}

export function buildVacancySources(config: Json): JobSource[] {
  const rss = sourceArray(config, "rss", DEFAULT_VACANCY_SOURCES.rss)
    .map((source) => new RssJobSource(cleanText(source.name, "rss"), publicHttpsUrl(source.url), { detailBudget: 0 }));
  const djinni = djinniSourceArray(config)
    .map((source) => new DjinniListingSource(cleanText(source.name, "djinni-qa"), cleanText(source.query, "QA")));

  return [
    ...rss,
    ...djinni,
    ...boardSources(config, "greenhouse", GreenhouseSource),
    ...boardSources(config, "lever", LeverSource),
    ...boardSources(config, "ashby", AshbySource),
    ...querySources(config, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa, RobotaUaSource, { name: "robotaua-qa", query: "QA Engineer" }),
    ...querySources(config, "lobbyX", DEFAULT_VACANCY_SOURCES.lobbyX, LobbyXSource, { name: "lobbyx-qa", query: "QA Engineer" }),
  ];
}

function isDouSource(source: Json): boolean {
  const rawUrl = cleanText(source.url);
  if (!rawUrl) return false;
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === "dou.ua" || hostname.endsWith(".dou.ua");
  } catch {
    return false;
  }
}

/**
 * DOU rejects requests from the Cloudflare Worker with HTTP 403. It already has
 * a dedicated GitHub-hosted hourly collector that imports the fully enriched
 * catalogue, so retrying DOU inside the Worker only creates a false degraded
 * sync. Keep arbitrary non-DOU RSS sources in the Worker path.
 */
export function buildCloudVacancySources(config: Json): JobSource[] {
  const douSourceNames = new Set(
    sourceArray(config, "rss", DEFAULT_VACANCY_SOURCES.rss)
      .filter(isDouSource)
      .map((source) => `rss:${cleanText(source.name, "rss")}`),
  );
  return buildVacancySources(config).filter((source) => !douSourceNames.has(source.name));
}

export function skippedCloudSources(config: Json): VacancySourceSkip[] {
  const dou = sourceArray(config, "rss", DEFAULT_VACANCY_SOURCES.rss)
    .filter(isDouSource)
    .map((source) => ({
      source: `rss:${cleanText(source.name, "rss")}`,
      reason: "DOU blocks Cloudflare Worker requests (HTTP 403); DOU is refreshed by the dedicated hourly off-platform importer.",
    }));
  const workUa = sourceArray(config, "workUa", DEFAULT_VACANCY_SOURCES.workUa).map((source) => ({
    source: `workua:${cleanText(source.name, "workua-qa")}`,
    reason: "Direct Work.ua HTML access is blocked from cloud-hosted runners (HTTP 403); the adapter remains available for local sync only.",
  }));
  return [...dou, ...workUa];
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

function mapStoredJob(row: Row): IntakeJob {
  return {
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
  };
}

function mapExisting(row: Row): IntakeJob & { id: string; fingerprint: string; status?: string } {
  return {
    ...mapStoredJob(row),
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    status: row.status ? String(row.status) : undefined,
  };
}

function mapPublicStoredJob(row: Row): IntakeJob & { id: string; discoveredAt: string } {
  const job = mapStoredJob(row);
  return {
    ...job,
    source: row.display_source ? String(row.display_source) : displaySource(job.source),
    id: String(row.id),
    discoveredAt: String(row.discovered_at),
    raw: {},
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * D1 charges a network round trip per statement, so a sync that wrote each of
 * its few hundred vacancies separately spent most of its time waiting.
 *
 * Each batch is atomic, but a sync spanning several batches is not: a failure
 * partway through leaves the earlier batches committed. That matches the
 * previous statement-at-a-time behaviour and is safe here because every write
 * is an idempotent upsert the next run repeats.
 */
const UPSERT_BATCH_SIZE = 50;

async function runStatements(db: D1DatabaseLike, statements: D1BoundStatementLike[]): Promise<void> {
  if (statements.length === 0) return;
  if (typeof db.batch !== "function") {
    for (const statement of statements) await statement.run();
    return;
  }
  for (let index = 0; index < statements.length; index += UPSERT_BATCH_SIZE) {
    await db.batch(statements.slice(index, index + UPSERT_BATCH_SIZE));
  }
}

const DUPLICATE_LOOKUP_BATCH_SIZE = 25;

function vacancyStorageMetadata(job: IntakeJob) {
  return {
    displaySource: displaySource(job.source),
    dedupeUrl: canonicalUrl(job.url) || null,
    dedupeCompany: canonicalCompany(job.company) || null,
  };
}

/**
 * Rows created before migration 0020 deliberately default to relevant so a
 * deployment cannot hide the existing catalogue. The next scheduled write
 * reclassifies those legacy rows once and stores the same exact blocker keys
 * used by the in-memory duplicate detector.
 */
async function backfillVacancyStorageMetadata(db: D1DatabaseLike): Promise<void> {
  const legacy = await db.prepare(`SELECT
    id, source, external_id, title, company, location, remote, url, apply_url, description,
    salary_text, posted_at, contact_email, raw_json
    FROM jobs
    WHERE display_source IS NULL`).all<Row>();
  if (legacy.results.length === 0) return;

  const statements = legacy.results.map((row) => {
    const job = mapStoredJob(row);
    const relevant = filterRelevantVacancies([job]).jobs.length === 1;
    const metadata = vacancyStorageMetadata(job);
    return db.prepare(`UPDATE jobs
      SET relevant = ?, display_source = ?, dedupe_url = ?, dedupe_company = ?
      WHERE id = ?`)
      .bind(relevant ? 1 : 0, metadata.displaySource, metadata.dedupeUrl, metadata.dedupeCompany, String(row.id));
  });
  await runStatements(db, statements);
}

type PreparedVacancy = {
  job: IntakeJob;
  fingerprint: string;
  dedupeUrl: string | null;
  dedupeCompany: string | null;
};

async function prepareVacancies(jobs: IntakeJob[]): Promise<PreparedVacancy[]> {
  return Promise.all(jobs.map(async (job) => ({
    job,
    fingerprint: await sha256(`${job.source}|${job.externalId || job.url}`),
    dedupeUrl: canonicalUrl(job.url) || null,
    dedupeCompany: canonicalCompany(job.company) || null,
  })));
}

/**
 * Duplicate confidence can only become non-zero when the canonical URL or
 * canonical company matches. Persisting those exact blockers lets D1 return
 * only possible matches instead of loading an arbitrary recent-row window.
 */
async function duplicateCandidates(
  db: D1DatabaseLike,
  incoming: PreparedVacancy[],
): Promise<Array<IntakeJob & { id: string; fingerprint: string; status?: string }>> {
  const rows = new Map<string, Row>();

  for (let offset = 0; offset < incoming.length; offset += DUPLICATE_LOOKUP_BATCH_SIZE) {
    const batch = incoming.slice(offset, offset + DUPLICATE_LOOKUP_BATCH_SIZE);
    const fingerprints = [...new Set(batch.map((entry) => entry.fingerprint))];
    const urls = [...new Set(batch.flatMap((entry) => entry.dedupeUrl ? [entry.dedupeUrl] : []))];
    const companies = [...new Set(batch.flatMap((entry) => entry.dedupeCompany ? [entry.dedupeCompany] : []))];
    const clauses: string[] = [];
    const values: string[] = [];
    const inClause = (column: string, entries: string[]) => {
      if (entries.length === 0) return;
      clauses.push(`${column} IN (${entries.map(() => "?").join(", ")})`);
      values.push(...entries);
    };

    inClause("fingerprint", fingerprints);
    inClause("dedupe_url", urls);
    inClause("dedupe_company", companies);
    if (clauses.length === 0) continue;

    const result = await db.prepare(`SELECT *
      FROM jobs
      WHERE ${clauses.join(" OR ")}`)
      .bind(...values)
      .all<Row>();
    for (const row of result.results) rows.set(String(row.id), row);
  }

  return [...rows.values()]
    .sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")))
    .map(mapExisting);
}

export async function upsertVacancies(
  values: IntakeJob[],
  databaseOverride?: D1DatabaseLike,
): Promise<Omit<VacancySyncResult, "errors" | "skipped">> {
  const normalized = values.map(normalizedJob).filter((job) => job.title && job.company && job.url);
  const relevance = filterRelevantVacancies(normalized);
  const incoming = deduplicateVacancies(relevance.jobs);
  const db = await database(databaseOverride);

  await backfillVacancyStorageMetadata(db);
  const prepared = await prepareVacancies(incoming.jobs);
  const existing = await duplicateCandidates(db, prepared);
  const duplicates = new VacancyDuplicateIndex();
  const fingerprints = new Map<string, number>();
  existing.forEach((job, index) => {
    duplicates.register(index, job);
    fingerprints.set(job.fingerprint, index);
  });

  const statements: D1BoundStatementLike[] = [];
  let inserted = 0;
  let updated = 0;
  const timestamp = new Date().toISOString();

  for (const entry of prepared) {
    const { job, fingerprint } = entry;
    const duplicateIndex = fingerprints.get(fingerprint) ?? duplicates.findDuplicateIndex(existing, job);
    if (duplicateIndex >= 0) {
      const duplicate = existing[duplicateIndex];
      const merged = mergeDuplicateVacancies(duplicate, job);
      const metadata = vacancyStorageMetadata(merged);
      statements.push(db.prepare(`UPDATE jobs SET
        source = ?, external_id = COALESCE(?, external_id), title = ?, company = ?, location = ?, remote = ?,
        url = ?, apply_url = ?, description = ?, salary_text = COALESCE(?, salary_text),
        posted_at = COALESCE(?, posted_at), contact_email = COALESCE(?, contact_email), updated_at = ?, raw_json = ?,
        relevant = 1, display_source = ?, dedupe_url = ?, dedupe_company = ?
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
          metadata.displaySource,
          metadata.dedupeUrl,
          metadata.dedupeCompany,
          duplicate.id,
        ));
      Object.assign(duplicate, merged, { fingerprint });
      fingerprints.set(fingerprint, duplicateIndex);
      // A merge can move the record under new duplicate keys.
      duplicates.register(duplicateIndex, duplicate);
      updated += 1;
      continue;
    }

    const id = `job_${fingerprint.slice(0, 20)}`;
    const metadata = vacancyStorageMetadata(job);
    statements.push(db.prepare(`INSERT INTO jobs (
      id, fingerprint, source, external_id, title, company, location, remote, url, apply_url, description,
      salary_text, posted_at, contact_email, discovered_at, updated_at, status, raw_json,
      relevant, display_source, dedupe_url, dedupe_company
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, 1, ?, ?, ?)
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
      raw_json = excluded.raw_json,
      relevant = 1,
      display_source = excluded.display_source,
      dedupe_url = excluded.dedupe_url,
      dedupe_company = excluded.dedupe_company`)
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
        metadata.displaySource,
        metadata.dedupeUrl,
        metadata.dedupeCompany,
      ));
    existing.push({ ...job, id, fingerprint });
    const index = existing.length - 1;
    duplicates.register(index, existing[index]);
    fingerprints.set(fingerprint, index);
    inserted += 1;
  }

  await runStatements(db, statements);

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

export interface VacancySyncOptions {
  /** Recorded on the catalogue marker so a slow run can be attributed. */
  trigger?: string;
}

export async function syncVacancySources(
  databaseOverride?: D1DatabaseLike,
  options: VacancySyncOptions = {},
): Promise<VacancySyncResult> {
  const db = await database(databaseOverride);
  const trigger = options.trigger ?? "manual";
  await markVacancySyncStarted(db, trigger);
  try {
    return await collectAndStoreVacancies(db, trigger);
  } catch (error) {
    await markVacancySyncFailed(
      db,
      trigger,
      error instanceof Error ? error.message : String(error),
      new Date(),
      error instanceof VacancySyncFailure ? error.sources : undefined,
    );
    throw error;
  }
}

async function collectAndStoreVacancies(db: D1DatabaseLike, trigger: string): Promise<VacancySyncResult> {
  const config = await sourceConfig(db);
  const attempted = buildCloudVacancySources(config);
  const results = await collectAllSources(attempted);
  const intake = results.find((result) => result.source === "intake");
  const errors = results
    .filter((result) => result.error)
    .map((result) => ({ source: result.source, error: result.error ?? "Unknown source failure" }));
  const jobs = intake?.jobs ?? [];
  const seen = intake?.seen ?? jobs.length;
  const skipped = skippedCloudSources(config);
  let sourceHealth: VacancySourceHealth[] = intake?.sourceHealth?.map((entry) => ({
    source: entry.source,
    status: entry.status,
    jobs: entry.jobs,
    error: entry.error,
  })) ?? errors.map((entry) => ({
    source: entry.source,
    status: "FAILED" as const,
    jobs: 0,
    error: entry.error,
  }));
  sourceHealth = [
    ...sourceHealth,
    ...skipped.map((entry) => ({
      source: entry.source,
      status: "SKIPPED" as const,
      jobs: 0,
      error: entry.reason,
    })),
  ];

  // HTTP 200 with a changed page shape can make a parser return [] without
  // throwing. That is just as much a failed refresh as every source throwing.
  if (attempted.length > 0 && seen === 0) {
    const zeroMessage = "Configured sources returned zero parseable vacancies.";
    const failureErrors = errors.length === attempted.length
      ? errors
      : [...errors, { source: "intake", error: zeroMessage }];
    sourceHealth = sourceHealth.map((entry) => entry.status === "SUCCESS" && entry.jobs === 0
      ? { ...entry, status: "FAILED" as const, error: zeroMessage }
      : entry);
    console.error({
      schemaVersion: 1,
      service: "gimmejob",
      event: "vacancy_sync_collected_nothing",
      outcome: "failure",
      attempted: attempted.length,
      errors: failureErrors,
    });
    throw new VacancySyncFailure(failureErrors, sourceHealth);
  }

  const stored = await upsertVacancies(jobs, db);
  await markVacancySyncSucceeded(db, trigger, {
    seen,
    inserted: stored.inserted,
    updated: stored.updated,
    sources: sourceHealth,
  });

  if (errors.length > 0) {
    console.warn({
      schemaVersion: 1,
      service: "gimmejob",
      event: "vacancy_sync_source_degraded",
      outcome: "degraded",
      attempted: attempted.length,
      errors,
    });
  }

  return {
    ...stored,
    seen,
    relevant: jobs.length,
    rejected: intake?.rejected ?? 0,
    duplicates: intake?.duplicates ?? stored.duplicates,
    errors,
    skipped,
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

const DASHBOARD_DESCRIPTION_PREVIEW_LIMIT = 360;

export function compactDashboardPayload<T extends { jobs?: unknown }>(payload: T): T {
  if (!Array.isArray(payload.jobs)) return payload;

  return {
    ...payload,
    jobs: payload.jobs.map((job) => {
      if (!job || typeof job !== "object") return job;
      const record = job as Record<string, unknown>;
      const { raw: _raw, ...lightweight } = record;
      const description = typeof record.description === "string" ? record.description : "";
      if (!description) return lightweight;
      const truncate = description.length > DASHBOARD_DESCRIPTION_PREVIEW_LIMIT;
      // SQL summaries are already shortened. Preserve their completeness and
      // full-description reservation flag so the client still fetches details.
      const descriptionComplete = record.descriptionComplete !== false && !truncate;
      return {
        ...lightweight,
        reservation: typeof record.reservation === "boolean" ? record.reservation : /бронюванн/i.test(description),
        description: truncate
          ? `${description.slice(0, DASHBOARD_DESCRIPTION_PREVIEW_LIMIT).trimEnd()}…`
          : description,
        descriptionComplete,
      };
    }),
  } as T;
}

export async function publicVacancyById(
  jobId: string,
  databaseOverride?: D1DatabaseLike,
): Promise<(IntakeJob & { id: string; discoveredAt: string }) | null> {
  const db = await database(databaseOverride);
  const row = await db.prepare(`SELECT
    id, fingerprint, source, display_source, external_id, title, company, location, remote, url, apply_url, description,
    salary_text, posted_at, contact_email, discovered_at, raw_json, relevant
    FROM jobs
    WHERE id = ?
    LIMIT 1`)
    .bind(jobId)
    .first<Row>();
  if (!row) return null;

  if (Number(row.relevant ?? 1) !== 1) return null;
  const job = mapPublicStoredJob(row);
  const { raw: _raw, ...detail } = job;
  return detail;
}

export async function publicVacancySummaries(databaseOverride?: D1DatabaseLike): Promise<{
  jobs: Array<IntakeJob & {
    id: string;
    discoveredAt: string;
    descriptionComplete: boolean;
    reservation: boolean;
  }>;
  generatedAt: string;
}> {
  const db = await database(databaseOverride);
  const result = await db.prepare(`SELECT
    id, source, display_source, external_id, title, company, location, remote, url, apply_url,
    substr(description, 1, ${DASHBOARD_DESCRIPTION_PREVIEW_LIMIT}) AS description,
    CASE WHEN length(description) <= ${DASHBOARD_DESCRIPTION_PREVIEW_LIMIT} THEN 1 ELSE 0 END AS description_complete,
    CASE WHEN instr(lower(description), 'бронюван') > 0 THEN 1 ELSE 0 END AS reservation,
    salary_text, posted_at, contact_email, discovered_at
    FROM jobs
    WHERE relevant = 1
    ORDER BY COALESCE(posted_at, discovered_at) DESC, discovered_at DESC
    LIMIT 500`).all<Row>();

  const jobs = result.results.map((row) => ({
    ...mapPublicStoredJob(row),
    description: normalizeVacancyDescription(String(row.description ?? "")),
    descriptionComplete: Number(row.description_complete) === 1,
    reservation: Number(row.reservation) === 1,
  }));

  return { jobs, generatedAt: new Date().toISOString() };
}

export async function publicVacancies(databaseOverride?: D1DatabaseLike): Promise<{
  jobs: Array<IntakeJob & { id: string; discoveredAt: string }>;
  generatedAt: string;
}> {
  const db = await database(databaseOverride);
  const result = await db.prepare(`SELECT
    id, source, display_source, external_id, title, company, location, remote, url, apply_url, description,
    salary_text, posted_at, contact_email, discovered_at
    FROM jobs
    WHERE relevant = 1
    ORDER BY COALESCE(posted_at, discovered_at) DESC, discovered_at DESC
    LIMIT 500`).all<Row>();
  return {
    jobs: result.results.map(mapPublicStoredJob),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Bootstraps an empty catalogue only. Routine refreshes belong to the scheduled
 * runner, so a page load never pays for a crawl once vacancies exist.
 */
export async function ensureVacancyCatalog(databaseOverride?: D1DatabaseLike): Promise<void> {
  const db = await database(databaseOverride);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM jobs").first<Row>();
  if (Number(row?.count ?? 0) > 0) return;
  // Without this guard every concurrent request against an empty catalogue
  // starts its own crawl. One bootstrap runs; the rest serve what exists and
  // pick the result up on their next read.
  if (vacancySyncFreshness(await readVacancySyncState(db)).running) return;
  await syncVacancySources(db, { trigger: "catalog-bootstrap" });
}

/** The catalogue freshness marker, for routes that report or gate on it. */
export async function vacancySyncState(databaseOverride?: D1DatabaseLike): Promise<VacancySyncState> {
  return readVacancySyncState(await database(databaseOverride));
}

/** The runtime catalogue database, for callers that record their own marker. */
export async function vacancyDatabase(databaseOverride?: D1DatabaseLike): Promise<D1DatabaseLike> {
  return database(databaseOverride);
}

export function mergeVacancySourceDefaults(value: unknown): Json {
  const settings = value && typeof value === "object" ? value as Json : {};
  const sources = settings.sources && typeof settings.sources === "object" ? settings.sources as Json : {};
  return {
    ...settings,
    sources: {
      ...sources,
      djinni: djinniSourceArray(sources),
      robotaUa: sourceArray(sources, "robotaUa", DEFAULT_VACANCY_SOURCES.robotaUa),
    },
  };
}
