import test from "node:test";
import assert from "node:assert/strict";
import { handleVacancySync } from "../app/api/_vacancy-sync-route.ts";

const request = new Request("https://gimmejob.example/api/sync", { method: "POST" });

function deps() {
  let syncCalls = 0;
  let dashboardCalls = 0;
  return {
    sync: async () => {
      syncCalls += 1;
      return { inserted: 2, updated: 1 };
    },
    dashboard: async (received: Request) => {
      dashboardCalls += 1;
      assert.equal(received, request);
      return { authenticated: true, jobs: [{ id: "job-1" }] };
    },
    calls: () => ({ syncCalls, dashboardCalls }),
  };
}

test("unauthenticated multi-user sync returns 401 without running shared sync", async () => {
  const fake = deps();
  const response = await handleVacancySync(
    request,
    { multiUser: true, authenticated: false, userId: null },
    fake.sync,
    fake.dashboard,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "Authentication required." });
  assert.deepEqual(fake.calls(), { syncCalls: 0, dashboardCalls: 0 });
});

test("multi-user sync also rejects a missing trusted user id", async () => {
  const fake = deps();
  const response = await handleVacancySync(
    request,
    { multiUser: true, authenticated: true, userId: null },
    fake.sync,
    fake.dashboard,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(fake.calls(), { syncCalls: 0, dashboardCalls: 0 });
});

test("authenticated multi-user sync runs shared ingestion and returns refreshed dashboard", async () => {
  const fake = deps();
  const response = await handleVacancySync(
    request,
    { multiUser: true, authenticated: true, userId: "user-1" },
    fake.sync,
    fake.dashboard,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    result: { inserted: 2, updated: 1 },
    dashboard: { authenticated: true, jobs: [{ id: "job-1" }] },
  });
  assert.deepEqual(fake.calls(), { syncCalls: 1, dashboardCalls: 1 });
});

test("legacy single-user mode remains allowed", async () => {
  const fake = deps();
  const response = await handleVacancySync(
    request,
    { multiUser: false, authenticated: false, userId: null },
    fake.sync,
    fake.dashboard,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(fake.calls(), { syncCalls: 1, dashboardCalls: 1 });
});
