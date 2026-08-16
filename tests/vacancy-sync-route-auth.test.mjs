import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "tsx/esm/api";

register();
const { POST } = await import("../app/api/[...route]/route.ts");

const route = readFileSync(new URL("../app/api/[...route]/route.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("unauthenticated multi-user vacancy sync is rejected by the real API route", async () => {
  const response = await POST(
    new Request("https://gimmejob.example/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gimmejob-auth-mode": "multi-user",
      },
      body: "{}",
    }),
    { params: { route: ["sync"] } },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "Authentication required." });
});

test("authenticated multi-user sessions are not blocked from vacancy sync", () => {
  const syncRoute = route.match(/if \(route\[0\] === "sync"\) \{([\s\S]*?)\n    \}/)?.[1] ?? "";
  assert.match(syncRoute, /tenant\.multiUser && !userId/);
  assert.match(syncRoute, /const result = await syncVacancySources\(\)/);
  assert.doesNotMatch(syncRoute, /multiUserAdminBlocked/);
});

test("vacancies workspace still targets the authenticated sync API", () => {
  assert.match(workspace, /api<\{ dashboard: DashboardData \}>\("\/sync", "POST", \{\}\)/);
});
