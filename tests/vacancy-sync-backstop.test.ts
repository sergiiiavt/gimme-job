import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const {
  VACANCY_BACKSTOP_FRESH_MS,
  runVacancyCatalogBackstop,
} = await import("../worker/vacancy-sync-backstop.ts");
const { IDLE_VACANCY_SYNC_STATE } = await import("../app/api/_vacancy-sync-state.ts");

const NOW = Date.parse("2026-09-20T12:00:00.000Z");
const database = {} as Parameters<typeof runVacancyCatalogBackstop>[0];

function successState(ageMs: number) {
  return {
    ...IDLE_VACANCY_SYNC_STATE,
    status: "SUCCESS" as const,
    completedAt: new Date(NOW - ageMs).toISOString(),
  };
}

test("Cloudflare backstop skips a catalogue refreshed by the primary scheduler", async () => {
  let runs = 0;
  const result = await runVacancyCatalogBackstop(database, {
    now: NOW,
    readState: async () => successState(60 * 60_000),
    sync: async () => { runs += 1; },
  });

  assert.deepEqual(result, { started: false, reason: "fresh" });
  assert.equal(runs, 0);
});

test("Cloudflare backstop refreshes after the three-hour safety window", async () => {
  let trigger = "";
  const result = await runVacancyCatalogBackstop(database, {
    now: NOW,
    readState: async () => successState(VACANCY_BACKSTOP_FRESH_MS + 1),
    sync: async (_db, options) => { trigger = options.trigger ?? ""; },
  });

  assert.deepEqual(result, { started: true, reason: "stale" });
  assert.equal(trigger, "cloudflare-cron-backstop");
});

test("Cloudflare backstop never competes with a live sync", async () => {
  let runs = 0;
  const result = await runVacancyCatalogBackstop(database, {
    now: NOW,
    readState: async () => ({
      ...IDLE_VACANCY_SYNC_STATE,
      status: "RUNNING" as const,
      startedAt: new Date(NOW - 60_000).toISOString(),
    }),
    sync: async () => { runs += 1; },
  });

  assert.deepEqual(result, { started: false, reason: "running" });
  assert.equal(runs, 0);
});
