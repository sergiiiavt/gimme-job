import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  IDLE_VACANCY_SYNC_STATE,
  VACANCY_SYNC_FRESH_MS,
  VACANCY_SYNC_STALE_RUNNING_MS,
  markVacancySyncFailed,
  markVacancySyncStarted,
  markVacancySyncSucceeded,
  readVacancySyncState,
  vacancySyncFreshness,
} = await import("../app/api/_vacancy-sync-state.ts");

type Row = Record<string, unknown>;

/** Enough of D1 to store the single-row catalogue marker. */
class FakeMarkerDb {
  row: Row | null = null;
  reads = 0;
  writes = 0;
  failWrites = false;

  prepare(query: string) {
    const normalized = query.replace(/\s+/g, " ").trim().toLowerCase();
    const execute = (values: unknown[]) => ({
      first: async <T>() => {
        if (normalized.includes("from vacancy_sync_state")) {
          this.reads += 1;
          return this.row as T | null;
        }
        return null;
      },
      all: async <T>() => ({ results: [] as T[] }),
      run: async () => {
        if (normalized.startsWith("insert into vacancy_sync_state")) {
          if (this.failWrites) throw new Error("no such table: vacancy_sync_state");
          this.writes += 1;
          const [, status, trigger, startedAt, completedAt, seen, inserted, updated, error, sourcesJson, catalogVersion] = values;
          this.row = {
            status, trigger, started_at: startedAt, completed_at: completedAt,
            seen, inserted, updated, error, sources_json: sourcesJson, catalog_version: catalogVersion,
          };
        }
        return {};
      },
    });
    return {
      bind: (...values: unknown[]) => execute(values),
      first: async <T>() => execute([]).first<T>(),
      all: async <T>() => execute([]).all<T>(),
    };
  }
}

test("a catalogue with no recorded run reads as idle", async () => {
  const db = new FakeMarkerDb();
  assert.deepEqual(await readVacancySyncState(db), IDLE_VACANCY_SYNC_STATE);
});

test("a database without the marker table still serves an idle state", async () => {
  const db = new FakeMarkerDb();
  db.failWrites = true;
  await markVacancySyncStarted(db, "scheduled");
  assert.deepEqual(await readVacancySyncState(db), IDLE_VACANCY_SYNC_STATE);
});

test("a completed run records its counts and becomes the catalogue version", async () => {
  const db = new FakeMarkerDb();
  const startedAt = new Date("2026-09-20T10:00:00.000Z");
  const completedAt = new Date("2026-09-20T10:02:00.000Z");

  await markVacancySyncStarted(db, "scheduled", startedAt);
  const running = await readVacancySyncState(db);
  assert.equal(running.status, "RUNNING");
  assert.equal(running.startedAt, startedAt.toISOString());

  await markVacancySyncSucceeded(db, "scheduled", { seen: 310, inserted: 12, updated: 40 }, completedAt);
  const done = await readVacancySyncState(db);
  assert.equal(done.status, "SUCCESS");
  assert.equal(done.completedAt, completedAt.toISOString());
  assert.equal(done.inserted, 12);
  assert.equal(done.updated, 40);
  assert.equal(done.catalogVersion, completedAt.toISOString());
  assert.equal(done.error, null);
});

test("a run that changed nothing keeps the previous catalogue version", async () => {
  const db = new FakeMarkerDb();
  const first = new Date("2026-09-20T10:00:00.000Z");
  const second = new Date("2026-09-20T11:00:00.000Z");

  await markVacancySyncStarted(db, "scheduled", first);
  await markVacancySyncSucceeded(db, "scheduled", { seen: 300, inserted: 5, updated: 2 }, first);
  await markVacancySyncStarted(db, "scheduled", second);
  await markVacancySyncSucceeded(db, "scheduled", { seen: 300, inserted: 0, updated: 0 }, second);

  const state = await readVacancySyncState(db);
  assert.equal(state.completedAt, second.toISOString(), "the run still completed");
  assert.equal(state.catalogVersion, first.toISOString(), "but cached readers must not be invalidated");
});

test("a failed run keeps the last good catalogue version and reports the reason", async () => {
  const db = new FakeMarkerDb();
  const good = new Date("2026-09-20T10:00:00.000Z");

  await markVacancySyncStarted(db, "scheduled", good);
  await markVacancySyncSucceeded(db, "scheduled", { seen: 300, inserted: 3, updated: 1 }, good);
  await markVacancySyncFailed(db, "manual", "Vacancy sync collected nothing. rss:dou-qa: 403 Forbidden");

  const state = await readVacancySyncState(db);
  assert.equal(state.status, "FAILED");
  assert.match(state.error ?? "", /403 Forbidden/);
  assert.equal(state.catalogVersion, good.toISOString());
});

test("freshness treats a recent success as fresh and an old one as stale", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");
  const recent = {
    ...IDLE_VACANCY_SYNC_STATE,
    status: "SUCCESS" as const,
    completedAt: new Date(now - VACANCY_SYNC_FRESH_MS + 60_000).toISOString(),
  };
  const old = {
    ...IDLE_VACANCY_SYNC_STATE,
    status: "SUCCESS" as const,
    completedAt: new Date(now - VACANCY_SYNC_FRESH_MS - 60_000).toISOString(),
  };

  assert.equal(vacancySyncFreshness(recent, { now }).fresh, true);
  assert.equal(vacancySyncFreshness(old, { now }).fresh, false);
  assert.equal(vacancySyncFreshness(IDLE_VACANCY_SYNC_STATE, { now }).fresh, false);
});

test("a failed run is never fresh, so the next request may retry", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");
  const failed = {
    ...IDLE_VACANCY_SYNC_STATE,
    status: "FAILED" as const,
    completedAt: new Date(now - 60_000).toISOString(),
  };
  assert.equal(vacancySyncFreshness(failed, { now }).fresh, false);
});

test("an abandoned run stops holding the lock once it is too old to believe", () => {
  const now = Date.parse("2026-09-20T12:00:00.000Z");
  const live = {
    ...IDLE_VACANCY_SYNC_STATE,
    status: "RUNNING" as const,
    startedAt: new Date(now - 60_000).toISOString(),
  };
  const abandoned = {
    ...IDLE_VACANCY_SYNC_STATE,
    status: "RUNNING" as const,
    startedAt: new Date(now - VACANCY_SYNC_STALE_RUNNING_MS - 60_000).toISOString(),
  };

  assert.equal(vacancySyncFreshness(live, { now }).running, true);
  assert.equal(vacancySyncFreshness(abandoned, { now }).running, false);
});


test("a completed run persists per-source health", async () => {
  const db = new FakeMarkerDb();
  await markVacancySyncStarted(db, "scheduled");
  await markVacancySyncSucceeded(db, "scheduled", {
    seen: 12,
    inserted: 2,
    updated: 3,
    sources: [
      { source: "djinni:qa", status: "FAILED", jobs: 0, error: "403 Forbidden" },
      { source: "robotaua:qa", status: "SUCCESS", jobs: 12, error: null },
    ],
  });

  const state = await readVacancySyncState(db);
  assert.deepEqual(state.sources, [
    { source: "djinni:qa", status: "FAILED", jobs: 0, error: "403 Forbidden" },
    { source: "robotaua:qa", status: "SUCCESS", jobs: 12, error: null },
  ]);
});
