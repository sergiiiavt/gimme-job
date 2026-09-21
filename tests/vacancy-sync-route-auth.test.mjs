import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/[...route]/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("sync route delegates to the authenticated vacancy sync handler", () => {
  assert.match(route, /if \(route\[0\] === "sync"\) \{/);
  assert.match(route, /return handleVacancySync\(request, tenant, syncVacancySources, currentDashboard, \{/);
  const syncBlock = route.match(/if \(route\[0\] === "sync"\) \{[\s\S]*?\n {4}\}/)?.[0] ?? "";
  assert.doesNotMatch(syncBlock, /multiUserAdminBlocked/);
});

test("sync route gates a redundant crawl on the catalogue freshness marker", () => {
  const syncBlock = route.match(/if \(route\[0\] === "sync"\) \{[\s\S]*?\n {4}\}/)?.[0] ?? "";
  assert.match(syncBlock, /readState: \(\) => vacancySyncState\(\)/);
  assert.match(syncBlock, /force: payload\.force === true/);
});

test("vacancies workspace still targets the authenticated sync API", () => {
  assert.match(workspace, /api<\{[\s\S]*?\}>\("\/sync", "POST", force \? \{ force: true \} : \{\}\)/);
});
