import assert from "node:assert/strict";
import test from "node:test";
import { createLocalVacancySyncState } from "../agent/src/vacancy-sync-state.ts";

test("local vacancy sync state mirrors the cloud marker lifecycle", () => {
  const marker = createLocalVacancySyncState();

  assert.deepEqual(marker.read(), {
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
  });

  marker.started("manual", new Date("2026-09-20T10:00:00.000Z"));
  assert.deepEqual(marker.read(), {
    status: "RUNNING",
    trigger: "manual",
    startedAt: "2026-09-20T10:00:00.000Z",
    completedAt: null,
    seen: 0,
    inserted: 0,
    updated: 0,
    error: null,
    sources: [],
    catalogVersion: null,
  });

  marker.succeeded(
    "manual",
    {
      seen: 12,
      inserted: 2,
      updated: 10,
      sources: [{ source: "manual:test", status: "SUCCESS", jobs: 12, error: null }],
    },
    new Date("2026-09-20T10:01:00.000Z"),
  );
  assert.deepEqual(marker.read(), {
    status: "SUCCESS",
    trigger: "manual",
    startedAt: "2026-09-20T10:00:00.000Z",
    completedAt: "2026-09-20T10:01:00.000Z",
    seen: 12,
    inserted: 2,
    updated: 10,
    error: null,
    sources: [{ source: "manual:test", status: "SUCCESS", jobs: 12, error: null }],
    catalogVersion: "2026-09-20T10:01:00.000Z",
  });

  marker.started("manual", new Date("2026-09-20T10:02:00.000Z"));
  marker.succeeded(
    "manual",
    { seen: 0, inserted: 0, updated: 0 },
    new Date("2026-09-20T10:03:00.000Z"),
  );
  assert.equal(marker.read().catalogVersion, "2026-09-20T10:01:00.000Z");
  assert.equal(marker.read().completedAt, "2026-09-20T10:03:00.000Z");
});

test("local vacancy sync failures preserve the last catalogue version", () => {
  const marker = createLocalVacancySyncState();
  marker.started("manual", new Date("2026-09-20T10:00:00.000Z"));
  marker.succeeded(
    "manual",
    { seen: 1, inserted: 1, updated: 0 },
    new Date("2026-09-20T10:01:00.000Z"),
  );

  marker.started("manual", new Date("2026-09-20T10:02:00.000Z"));
  marker.failed("manual", new Error("source failed"), new Date("2026-09-20T10:03:00.000Z"));

  const failed = marker.read();
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.error, "source failed");
  assert.equal(failed.completedAt, "2026-09-20T10:03:00.000Z");
  assert.equal(failed.catalogVersion, "2026-09-20T10:01:00.000Z");
});
