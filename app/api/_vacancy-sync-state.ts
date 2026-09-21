import type { D1DatabaseLike } from "./_vacancy-intake";

/**
 * Vacancy discovery is a long, network-bound crawl. It belongs on a schedule,
 * not on a request a browser is waiting for, so the catalogue records when it
 * was last refreshed. Readers use that marker to revalidate instead of guessing
 * with a fixed timer, and POST /api/sync uses it to refuse a redundant crawl.
 */

export type VacancySyncStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";
export type VacancySourceHealthStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface VacancySourceHealth {
  source: string;
  status: VacancySourceHealthStatus;
  jobs: number;
  error: string | null;
}

export interface VacancySyncState {
  status: VacancySyncStatus;
  trigger: string | null;
  startedAt: string | null;
  completedAt: string | null;
  seen: number;
  inserted: number;
  updated: number;
  error: string | null;
  sources: VacancySourceHealth[];
  /** Changes only when a sync actually wrote rows, so it is a usable ETag. */
  catalogVersion: string | null;
}

export interface VacancySyncCounts {
  seen: number;
  inserted: number;
  updated: number;
  sources?: VacancySourceHealth[];
}

const STATE_ID = "catalog";

/** A catalogue refreshed inside this window is fresh enough to serve as-is. */
export const VACANCY_SYNC_FRESH_MS = 30 * 60 * 1000;

/**
 * A run that never reported an outcome — an evicted isolate, a timeout — must
 * not hold the lock forever. Past this age a "running" marker is abandoned.
 */
export const VACANCY_SYNC_STALE_RUNNING_MS = 15 * 60 * 1000;

export const IDLE_VACANCY_SYNC_STATE: VacancySyncState = {
  status: "IDLE",
  trigger: null,
  startedAt: null,
  completedAt: null,
  seen: 0,
  inserted: 0,
  updated: 0,
  error: null,
  sources: [],
  catalogVersion: null,
};

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function count(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function status(value: unknown): VacancySyncStatus {
  const candidate = String(value ?? "");
  return candidate === "RUNNING" || candidate === "SUCCESS" || candidate === "FAILED" ? candidate : "IDLE";
}

function sourceStatus(value: unknown): VacancySourceHealthStatus | null {
  const candidate = String(value ?? "");
  return candidate === "SUCCESS" || candidate === "FAILED" || candidate === "SKIPPED" ? candidate : null;
}

function sourceHealth(value: unknown): VacancySourceHealth[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); }
    catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const source = text(row.source);
    const healthStatus = sourceStatus(row.status);
    if (!source || !healthStatus) return [];
    return [{
      source,
      status: healthStatus,
      jobs: Math.max(0, count(row.jobs)),
      error: text(row.error),
    }];
  });
}

function instant(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapVacancySyncState(row: Record<string, unknown> | null): VacancySyncState {
  if (!row) return IDLE_VACANCY_SYNC_STATE;
  return {
    status: status(row.status),
    trigger: text(row.trigger),
    startedAt: text(row.started_at),
    completedAt: text(row.completed_at),
    seen: count(row.seen),
    inserted: count(row.inserted),
    updated: count(row.updated),
    error: text(row.error),
    sources: sourceHealth(row.sources_json),
    catalogVersion: text(row.catalog_version),
  };
}

export async function readVacancySyncState(db: D1DatabaseLike): Promise<VacancySyncState> {
  try {
    const row = await db.prepare(`SELECT status, trigger, started_at, completed_at, seen, inserted, updated, error, sources_json, catalog_version
      FROM vacancy_sync_state WHERE id = ? LIMIT 1`)
      .bind(STATE_ID)
      .first<Record<string, unknown>>();
    return mapVacancySyncState(row);
  } catch {
    // The marker is diagnostic metadata. A database that predates the table
    // must still be able to serve vacancies and run a sync.
    return IDLE_VACANCY_SYNC_STATE;
  }
}

async function writeVacancySyncState(db: D1DatabaseLike, state: VacancySyncState): Promise<void> {
  try {
    await db.prepare(`INSERT INTO vacancy_sync_state (
      id, status, trigger, started_at, completed_at, seen, inserted, updated, error, sources_json, catalog_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      trigger = excluded.trigger,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      seen = excluded.seen,
      inserted = excluded.inserted,
      updated = excluded.updated,
      error = excluded.error,
      sources_json = excluded.sources_json,
      catalog_version = excluded.catalog_version`)
      .bind(
        STATE_ID,
        state.status,
        state.trigger,
        state.startedAt,
        state.completedAt,
        state.seen,
        state.inserted,
        state.updated,
        state.error,
        JSON.stringify(state.sources),
        state.catalogVersion,
      )
      .run();
  } catch (error) {
    // Losing the marker degrades scheduling hints; it must never fail a sync
    // that collected real vacancies.
    console.warn({
      schemaVersion: 1,
      service: "gimmejob",
      event: "vacancy_sync_state_write",
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function markVacancySyncStarted(
  db: D1DatabaseLike,
  trigger: string,
  now = new Date(),
): Promise<VacancySyncState> {
  const previous = await readVacancySyncState(db);
  const state: VacancySyncState = {
    ...previous,
    status: "RUNNING",
    trigger,
    startedAt: now.toISOString(),
    error: null,
  };
  await writeVacancySyncState(db, state);
  return state;
}

export async function markVacancySyncSucceeded(
  db: D1DatabaseLike,
  trigger: string,
  counts: VacancySyncCounts,
  now = new Date(),
): Promise<VacancySyncState> {
  const previous = await readVacancySyncState(db);
  const completedAt = now.toISOString();
  const wrote = counts.inserted > 0 || counts.updated > 0;
  const state: VacancySyncState = {
    status: "SUCCESS",
    trigger,
    startedAt: previous.startedAt,
    completedAt,
    seen: counts.seen,
    inserted: counts.inserted,
    updated: counts.updated,
    error: null,
    sources: counts.sources ?? previous.sources,
    // An unchanged catalogue keeps its version so conditional readers stay on
    // their cached copy.
    catalogVersion: wrote ? completedAt : previous.catalogVersion ?? completedAt,
  };
  await writeVacancySyncState(db, state);
  return state;
}

export async function markVacancySyncFailed(
  db: D1DatabaseLike,
  trigger: string,
  message: string,
  now = new Date(),
  sources?: VacancySourceHealth[],
): Promise<VacancySyncState> {
  const previous = await readVacancySyncState(db);
  const state: VacancySyncState = {
    ...previous,
    status: "FAILED",
    trigger,
    completedAt: now.toISOString(),
    error: message.slice(0, 500),
    sources: sources ?? previous.sources,
  };
  await writeVacancySyncState(db, state);
  return state;
}

export interface VacancySyncFreshness {
  /** A sync is in flight and young enough to still be believed. */
  running: boolean;
  /** The catalogue was refreshed recently enough to skip a new crawl. */
  fresh: boolean;
  ageMs: number | null;
}

export function vacancySyncFreshness(
  state: VacancySyncState,
  options: { now?: number; freshMs?: number; staleRunningMs?: number } = {},
): VacancySyncFreshness {
  const now = options.now ?? Date.now();
  const freshMs = options.freshMs ?? VACANCY_SYNC_FRESH_MS;
  const staleRunningMs = options.staleRunningMs ?? VACANCY_SYNC_STALE_RUNNING_MS;

  const startedAt = instant(state.startedAt);
  const running = state.status === "RUNNING"
    && startedAt !== null
    && now - startedAt < staleRunningMs;

  const completedAt = state.status === "SUCCESS" ? instant(state.completedAt) : null;
  const ageMs = completedAt === null ? null : Math.max(0, now - completedAt);

  return { running, fresh: ageMs !== null && ageMs < freshMs, ageMs };
}
