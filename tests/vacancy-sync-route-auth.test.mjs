import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/[...route]/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("authenticated multi-user sessions can use the vacancy sync endpoint", () => {
  const syncRoute = route.match(/if \(route\[0\] === "sync"\) \{([\s\S]*?)\n    \}/)?.[1] ?? "";
  assert.match(syncRoute, /tenant\.multiUser && !userId/);
  assert.match(syncRoute, /status: 401/);
  assert.match(syncRoute, /const result = await syncVacancySources\(\)/);
  assert.doesNotMatch(syncRoute, /multiUserAdminBlocked/);
});

test("vacancies workspace still targets the authenticated sync API", () => {
  assert.match(workspace, /api<\{ dashboard: DashboardData \}>\("\/sync", "POST", \{\}\)/);
});
