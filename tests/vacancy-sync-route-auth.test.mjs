import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/[...route]/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("sync route delegates to the authenticated vacancy sync handler", () => {
  assert.match(route, /if \(route\[0\] === "sync"\) return handleVacancySync\(request, tenant, syncVacancySources, currentDashboard\)/);
  const syncLine = route.match(/if \(route\[0\] === "sync"\)[^\n]*/)?.[0] ?? "";
  assert.doesNotMatch(syncLine, /multiUserAdminBlocked/);
});

test("vacancies workspace still targets the authenticated sync API", () => {
  assert.match(workspace, /api<\{ dashboard: DashboardData \}>\("\/sync", "POST", \{\}\)/);
});
