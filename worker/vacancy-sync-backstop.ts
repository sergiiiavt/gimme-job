import type { D1DatabaseLike } from "../app/api/_vacancy-intake";
import {
  syncVacancySources,
  vacancySyncState,
  type VacancySyncOptions,
} from "../app/api/_vacancy-intake";
import {
  vacancySyncFreshness,
  type VacancySyncState,
} from "../app/api/_vacancy-sync-state";

export const VACANCY_BACKSTOP_FRESH_MS = 3 * 60 * 60 * 1000;

type VacancySyncRunner = (
  database: D1DatabaseLike,
  options: VacancySyncOptions,
) => Promise<unknown>;

export interface VacancyBackstopDependencies {
  readState?: (database: D1DatabaseLike) => Promise<VacancySyncState>;
  sync?: VacancySyncRunner;
  now?: number;
}

/**
 * GitHub Actions remains the primary hourly ingestion scheduler. This Worker
 * cron is only a backstop: it does nothing while the catalogue is younger than
 * three hours or another run is still live.
 */
export async function runVacancyCatalogBackstop(
  database: D1DatabaseLike,
  dependencies: VacancyBackstopDependencies = {},
): Promise<{ started: boolean; reason: "fresh" | "running" | "stale" }> {
  const readState = dependencies.readState ?? vacancySyncState;
  const sync = dependencies.sync ?? syncVacancySources;
  const state = await readState(database);
  const freshness = vacancySyncFreshness(state, {
    now: dependencies.now,
    freshMs: VACANCY_BACKSTOP_FRESH_MS,
  });

  if (freshness.running) return { started: false, reason: "running" };
  if (freshness.fresh) return { started: false, reason: "fresh" };

  await sync(database, { trigger: "cloudflare-cron-backstop" });
  return { started: true, reason: "stale" };
}
