import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");
const routeResolver = readFileSync(new URL("../app/vacancy-workspace-route.tsx", import.meta.url), "utf8");
const publicRoute = readFileSync(new URL("../app/vacancies/page.tsx", import.meta.url), "utf8");
const privateRoute = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");

test("vacancy dashboard cache uses 10 minute freshness and 1 hour GC", () => {
  assert.match(source, /const VACANCY_STALE_MS = 10 \* 60 \* 1000;/);
  assert.match(source, /const VACANCY_GC_MS = 60 \* 60 \* 1000;/);
  assert.match(source, /Date\.now\(\) - cached\.dataUpdatedAt < VACANCY_STALE_MS/);
  assert.match(source, /now - snapshot\.lastAccessedAt >= VACANCY_GC_MS/);
});

test("a stale cache revalidates against the sync marker before refetching the catalogue", () => {
  const revalidateBlock = source.match(/const revalidate = async \(\) => \{[\s\S]*?\n {4}\};/u)?.[0] ?? "";
  assert.match(revalidateBlock, /api<VacancySyncMarker>\("\/vacancy-sync"\)/);
  assert.match(revalidateBlock, /version === cached\.catalogVersion/);
  assert.match(revalidateBlock, /refreshVacancyCacheValidity\(marker\)/);
  assert.match(revalidateBlock, /return loadDashboard\(\);/);
});

test("vacancy data cache survives route changes and refreshes within the same view", () => {
  assert.match(source, /const VACANCY_CACHE_KEY = "gimmejob:vacancies-cache:v6";/);
  assert.match(source, /window\.sessionStorage\.getItem\(VACANCY_CACHE_KEY\)/);
  assert.match(source, /window\.sessionStorage\.setItem\(VACANCY_CACHE_KEY, JSON\.stringify\(snapshot\)\)/);
  assert.match(source, /const memoryCache = readClientVacancyCache\(\)/);
  assert.match(source, /const \[jobs, setJobs\] = useState<Job\[]>\(\(\) => memoryCache\?\.jobs \?\? \[\]\)/);
  assert.match(source, /void revalidate\(\);/);
});

test("a snapshot without a catalogue version is discarded rather than trusted", () => {
  const readBlock = source.match(/function readVacancyCache\(\)[\s\S]*?\n\}/u)?.[0] ?? "";
  assert.match(readBlock, /snapshot\.catalogVersion === undefined \|\| snapshot\.catalogUpdatedAt === undefined/);
  assert.match(readBlock, /removeVacancyCache\(\);/);
});

test("vacancy route resolves public or personal view from current auth without changing the canonical URL", () => {
  assert.match(routeResolver, /fetch\("\/api\/auth-state"/);
  assert.match(routeResolver, /cache: "no-store"/);
  assert.match(routeResolver, /if \(response\.ok\) return "personal";/);
  assert.match(routeResolver, /if \(response\.status === 401\) return "public";/);
  assert.match(routeResolver, /throw new Error\(`Auth state request failed:/);
  assert.doesNotMatch(routeResolver, /currentVacancyView/);
  assert.match(routeResolver, /useState<VacancyViewMode \| null>\(null\)/);
  assert.match(routeResolver, /\.catch\(\(\) => \{[\s\S]*setMode\("public"\)/);
  assert.match(routeResolver, /<VacanciesWorkspace key=\{mode\} mode=\{mode\}\/>/);
  assert.match(publicRoute, /<VacancyWorkspaceRoute\/>/);
  assert.match(privateRoute, /<VacancyWorkspaceRoute\/>/);
});

test("switching public private view clears vacancy data and workspace caches", () => {
  assert.match(source, /const VACANCY_VIEW_KEY = "gimmejob:vacancy-view:v1";/);
  const prepareBlock = source.match(/function prepareVacancyView\(viewMode: VacancyViewMode\) \{[\s\S]*?\n\}/u)?.[0] ?? "";
  assert.match(prepareBlock, /const previousView = window\.sessionStorage\.getItem\(VACANCY_VIEW_KEY\);/);
  assert.match(prepareBlock, /if \(previousView === viewMode\) return;/);
  assert.match(prepareBlock, /removeVacancyCache\(\);/);
  assert.match(prepareBlock, /clearVacancyWorkspace\(\);/);
  assert.match(prepareBlock, /window\.sessionStorage\.setItem\(VACANCY_VIEW_KEY, viewMode\);/);
  assert.match(source, /prepareVacancyView\(mode\);/);
});

test("public view cannot become personal from a cached authenticated flag alone", () => {
  assert.match(source, /const isPersonal = mode === "personal" && authenticated === true;/);
});

test("open vacancy tabs persist for route navigation and F5 within the same view", () => {
  assert.match(source, /const VACANCY_WORKSPACE_KEY = "gimmejob:vacancy-workspace:v1";/);
  assert.match(source, /window\.sessionStorage\.getItem\(VACANCY_WORKSPACE_KEY\)/);
  assert.match(source, /writeVacancyWorkspace\(\{ openTabIds, selectedId \}\)/);
  assert.match(source, /setOpenTabIds\(workspace\.openTabIds\)/);
  assert.match(source, /setSelectedId\(workspace\.selectedId\)/);
});

test("manual sync closes all opened vacancy tabs", () => {
  const syncBlock = source.match(/const sync = async \(force = false\) => \{[\s\S]*?\n  \};/u)?.[0] ?? "";
  assert.match(syncBlock, /setOpenTabIds\(\[\]\);/);
  assert.match(syncBlock, /setSelectedId\(null\);/);
  assert.match(syncBlock, /clearVacancyWorkspace\(\);/);
  assert.match(syncBlock, /api<\{[\s\S]*?\}>\("\/sync", "POST", force \? \{ force: true \} : \{\}\)/);
});

test("a sync the schedule already covered is reported instead of silently doing nothing", () => {
  const syncBlock = source.match(/const sync = async \(force = false\) => \{[\s\S]*?\n  \};/u)?.[0] ?? "";
  assert.match(syncBlock, /result\.skipped === "running"/);
  assert.match(syncBlock, /result\.skipped === "fresh"/);
  assert.match(syncBlock, /syncFreshnessLabel\(/);
});

test("background refresh keeps tabs while only manual sync clears them", () => {
  const loadBlock = source.match(/const loadDashboard = \(attempt = 0\)[\s\S]*?const revalidate/u)?.[0] ?? "";
  assert.doesNotMatch(loadBlock, /clearVacancyWorkspace\(\)/);
  assert.doesNotMatch(loadBlock, /setOpenTabIds\(\[\]\)/);
});


test("vacancy freshness stays grouped underneath the stat line", () => {
  const summaryStart = source.indexOf('<div className="vacancy-catalog-summary">');
  const introEnd = source.indexOf("</section>", summaryStart);
  const summaryBlock = summaryStart >= 0 && introEnd > summaryStart ? source.slice(summaryStart, introEnd) : "";
  assert.match(summaryBlock, /className="stat-line"/);
  assert.match(summaryBlock, /className="vacancy-catalog-freshness"/);
  assert.ok(summaryBlock.indexOf("stat-line") < summaryBlock.indexOf("vacancy-catalog-freshness"));
});
