import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { handleVacancySync } = await import("../app/api/_vacancy-sync-route.ts");
const { IDLE_VACANCY_SYNC_STATE } = await import("../app/api/_vacancy-sync-state.ts");

const NOW = Date.parse("2026-09-20T12:00:00.000Z");
const openTenant = { multiUser: false, authenticated: false, userId: null };

function request() {
  return new Request("https://gimmejob.example/api/sync", { method: "POST" });
}

function successState(completedAt: string) {
  return { ...IDLE_VACANCY_SYNC_STATE, status: "SUCCESS" as const, completedAt, catalogVersion: completedAt };
}

test("a catalogue a scheduled run already refreshed is served without another crawl", async () => {
  let crawls = 0;
  const response = await handleVacancySync(
    request(),
    openTenant,
    async () => { crawls += 1; return {}; },
    async () => ({ jobs: [{ id: "job_1" }] }),
    { readState: async () => successState(new Date(NOW - 5 * 60_000).toISOString()), now: NOW },
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as { ok: boolean; skipped: string; dashboard: unknown };
  assert.equal(payload.ok, true);
  assert.equal(payload.skipped, "fresh");
  assert.deepEqual(payload.dashboard, { jobs: [{ id: "job_1" }] });
  assert.equal(crawls, 0, "a fresh catalogue must not start a collection run");
});

test("an explicit force request still collects from a fresh catalogue", async () => {
  let crawls = 0;
  const response = await handleVacancySync(
    request(),
    openTenant,
    async () => { crawls += 1; return { accepted: 4 }; },
    async () => ({ jobs: [] }),
    { readState: async () => successState(new Date(NOW - 5 * 60_000).toISOString()), force: true, now: NOW },
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as { ok: boolean; skipped?: string; result: { accepted: number } };
  assert.equal(payload.skipped, undefined);
  assert.equal(payload.result.accepted, 4);
  assert.equal(crawls, 1);
});

test("a stale catalogue collects again", async () => {
  let crawls = 0;
  const response = await handleVacancySync(
    request(),
    openTenant,
    async () => { crawls += 1; return { accepted: 9 }; },
    async () => ({ jobs: [] }),
    { readState: async () => successState(new Date(NOW - 4 * 60 * 60_000).toISOString()), now: NOW },
  );

  assert.equal(response.status, 200);
  assert.equal(crawls, 1);
});

test("a run already in flight is reported rather than started a second time", async () => {
  let crawls = 0;
  const response = await handleVacancySync(
    request(),
    openTenant,
    async () => { crawls += 1; return {}; },
    async () => ({ jobs: [] }),
    {
      readState: async () => ({
        ...IDLE_VACANCY_SYNC_STATE,
        status: "RUNNING" as const,
        startedAt: new Date(NOW - 60_000).toISOString(),
      }),
      now: NOW,
    },
  );

  assert.equal(response.status, 202);
  const payload = await response.json() as { skipped: string };
  assert.equal(payload.skipped, "running");
  assert.equal(crawls, 0);
});

test("freshness gating never runs before multi-user authentication", async () => {
  let stateReads = 0;
  const response = await handleVacancySync(
    request(),
    { multiUser: true, authenticated: false, userId: null },
    async () => ({}),
    async () => ({}),
    { readState: async () => { stateReads += 1; return IDLE_VACANCY_SYNC_STATE; }, now: NOW },
  );

  assert.equal(response.status, 401);
  assert.equal(stateReads, 0);
});

test("a gated sync reports the refreshed marker alongside the dashboard", async () => {
  const states = [
    IDLE_VACANCY_SYNC_STATE,
    successState(new Date(NOW).toISOString()),
  ];
  let read = 0;
  const response = await handleVacancySync(
    request(),
    openTenant,
    async () => ({ accepted: 2 }),
    async () => ({ jobs: [] }),
    { readState: async () => states[Math.min(read++, states.length - 1)]!, now: NOW },
  );

  const payload = await response.json() as { sync: { catalogVersion: string | null } };
  assert.equal(payload.sync.catalogVersion, new Date(NOW).toISOString());
});

test("a sync failure is still reported as a failure when gating is wired", async () => {
  const response = await handleVacancySync(
    request(),
    openTenant,
    async () => { throw new Error("Vacancy sync collected nothing. djinni:qa: 403 Forbidden"); },
    async () => ({ jobs: [] }),
    { readState: async () => IDLE_VACANCY_SYNC_STATE, now: NOW },
  );

  assert.equal(response.status, 502);
  const payload = await response.json() as { ok: boolean; error: string };
  assert.equal(payload.ok, false);
  assert.match(payload.error, /403 Forbidden/);
});
