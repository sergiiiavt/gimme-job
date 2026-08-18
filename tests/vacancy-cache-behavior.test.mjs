import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");

test("vacancy dashboard cache uses 10 minute freshness and 1 hour GC", () => {
  assert.match(source, /const VACANCY_STALE_MS = 10 \* 60 \* 1000;/);
  assert.match(source, /const VACANCY_GC_MS = 60 \* 60 \* 1000;/);
  assert.match(source, /Date\.now\(\) - cached\.dataUpdatedAt >= VACANCY_STALE_MS/);
  assert.match(source, /now - snapshot\.lastAccessedAt >= VACANCY_GC_MS/);
});

test("vacancy data cache survives route changes and refreshes within the browser session", () => {
  assert.match(source, /const VACANCY_CACHE_KEY = "gimmejob:vacancies-cache:v1";/);
  assert.match(source, /window\.sessionStorage\.getItem\(VACANCY_CACHE_KEY\)/);
  assert.match(source, /window\.sessionStorage\.setItem\(VACANCY_CACHE_KEY, JSON\.stringify\(snapshot\)\)/);
  assert.match(source, /const memoryCache = readClientVacancyCache\(\)/);
  assert.match(source, /const \[jobs, setJobs\] = useState<Job\[]>\(\(\) => memoryCache\?\.jobs \?\? \[\]\)/);
  assert.match(source, /if \(shouldRefresh\) void loadDashboard\(\);/);
});

test("open vacancy tabs persist for route navigation and F5", () => {
  assert.match(source, /const VACANCY_WORKSPACE_KEY = "gimmejob:vacancy-workspace:v1";/);
  assert.match(source, /window\.sessionStorage\.getItem\(VACANCY_WORKSPACE_KEY\)/);
  assert.match(source, /writeVacancyWorkspace\(\{ openTabIds, selectedId \}\)/);
  assert.match(source, /setOpenTabIds\(workspace\.openTabIds\)/);
  assert.match(source, /setSelectedId\(workspace\.selectedId\)/);
});

test("manual sync closes all opened vacancy tabs", () => {
  const syncBlock = source.match(/const sync = async \(\) => \{[\s\S]*?\n  \};/u)?.[0] ?? "";
  assert.match(syncBlock, /setOpenTabIds\(\[\]\);/);
  assert.match(syncBlock, /setSelectedId\(null\);/);
  assert.match(syncBlock, /clearVacancyWorkspace\(\);/);
  assert.match(syncBlock, /api<\{ dashboard: DashboardData \}>\("\/sync", "POST", \{\}\)/);
});

test("background refresh keeps tabs while only manual sync clears them", () => {
  const loadBlock = source.match(/const loadDashboard = \(attempt = 0\)[\s\S]*?const shouldRefresh/u)?.[0] ?? "";
  assert.doesNotMatch(loadBlock, /clearVacancyWorkspace\(\)/);
  assert.doesNotMatch(loadBlock, /setOpenTabIds\(\[\]\)/);
});
