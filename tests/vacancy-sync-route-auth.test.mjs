import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/sync/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("authenticated multi-user sessions can use the vacancy sync endpoint", () => {
  assert.match(route, /tenantRequestContext\(request\)/);
  assert.match(route, /tenant\.multiUser && \(!tenant\.authenticated \|\| !tenant\.userId\)/);
  assert.match(route, /status: 401/);
  assert.match(route, /const result = await syncVacancySources\(\)/);
  assert.doesNotMatch(route, /multiUserAdminBlocked/);
});

test("vacancies workspace still targets the dedicated authenticated sync route", () => {
  assert.match(workspace, /api<\{ dashboard: DashboardData \}>\("\/sync", "POST", \{\}\)/);
});
