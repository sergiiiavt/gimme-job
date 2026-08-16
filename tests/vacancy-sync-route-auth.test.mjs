import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "tsx/esm/api";

register();
const { POST } = await import("../app/api/[...route]/route.ts");

const route = readFileSync(new URL("../app/api/[...route]/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

function syncRequest(headers = {}) {
  return new Request("https://gimmejob.example/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: "{}",
  });
}

const syncContext = { params: { route: ["sync"] } };

test("unauthenticated multi-user vacancy sync is rejected by the real API route", async () => {
  const response = await POST(
    syncRequest({ "x-gimmejob-auth-mode": "multi-user" }),
    syncContext,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "Authentication required." });
});

test("authenticated multi-user vacancy sync passes the tenant authorization guard", async () => {
  const response = await POST(
    syncRequest({
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "test-user",
    }),
    syncContext,
  );

  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
});

test("single-user vacancy sync also passes the tenant authorization guard", async () => {
  const response = await POST(syncRequest(), syncContext);
  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
});

test("sync reuses the standard tenant authentication guard instead of the admin block", () => {
  const syncRoute = route.match(/if \(route\[0\] === "sync"\) \{([\s\S]*?)\n    \}/)?.[1] ?? "";
  assert.match(syncRoute, /const syncTenant = tenantUser\(request\)/);
  assert.match(syncRoute, /if \(syncTenant instanceof Response\) return syncTenant/);
  assert.match(syncRoute, /const result = await syncVacancySources\(\)/);
  assert.doesNotMatch(syncRoute, /multiUserAdminBlocked/);
});

test("vacancies workspace still targets the authenticated sync API", () => {
  assert.match(workspace, /api<\{ dashboard: DashboardData \}>\("\/sync", "POST", \{\}\)/);
});
