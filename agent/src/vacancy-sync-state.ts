export type LocalVacancySyncStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";

export interface LocalVacancySyncState {
  status: LocalVacancySyncStatus;
  trigger: string | null;
  startedAt: string | null;
  completedAt: string | null;
  seen: number;
  inserted: number;
  updated: number;
  error: string | null;
  catalogVersion: string | null;
}

export interface LocalVacancySyncCounts {
  seen: number;
  inserted: number;
  updated: number;
}

const IDLE_LOCAL_VACANCY_SYNC_STATE: LocalVacancySyncState = {
  status: "IDLE",
  trigger: null,
  startedAt: null,
  completedAt: null,
  seen: 0,
  inserted: 0,
  updated: 0,
  error: null,
  catalogVersion: null,
};

/**
 * The local agent has no scheduled catalogue or D1 marker. Keep the marker for
 * this agent process only: it is enough to make the browser contract honest
 * without inventing a local-only database migration just for dev diagnostics.
 */
export function createLocalVacancySyncState() {
  let state: LocalVacancySyncState = { ...IDLE_LOCAL_VACANCY_SYNC_STATE };

  const read = (): LocalVacancySyncState => ({ ...state });

  return {
    read,
    started(trigger: string, now = new Date()): LocalVacancySyncState {
      state = {
        ...state,
        status: "RUNNING",
        trigger,
        startedAt: now.toISOString(),
        error: null,
      };
      return read();
    },
    succeeded(trigger: string, counts: LocalVacancySyncCounts, now = new Date()): LocalVacancySyncState {
      const completedAt = now.toISOString();
      const wrote = counts.inserted > 0 || counts.updated > 0;
      state = {
        status: "SUCCESS",
        trigger,
        startedAt: state.startedAt,
        completedAt,
        seen: counts.seen,
        inserted: counts.inserted,
        updated: counts.updated,
        error: null,
        catalogVersion: wrote ? completedAt : state.catalogVersion ?? completedAt,
      };
      return read();
    },
    failed(trigger: string, error: unknown, now = new Date()): LocalVacancySyncState {
      state = {
        ...state,
        status: "FAILED",
        trigger,
        completedAt: now.toISOString(),
        error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      };
      return read();
    },
  };
}
