import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancies-workspace.css", import.meta.url), "utf8");
const filterEnhancer = readFileSync(new URL("../app/vacancy-filter-enhancer.tsx", import.meta.url), "utf8");
const filterStyles = readFileSync(new URL("../app/vacancy-filter-enhancer.css", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
const publicRoute = readFileSync(new URL("../app/vacancies/page.tsx", import.meta.url), "utf8");

test("workspace uses the approved vacancies workspace", () => {
  assert.match(route, /import VacanciesWorkspace from "\.\.\/vacancies-workspace"/);
  assert.match(route, /<VacanciesWorkspace\/>/);
});

test("desktop vacancy table uses strict data columns", () => {
  for (const label of ["Vacancy", "Company", "Location", "Source", "Conditions", "Salary", "Posted"]) {
    assert.match(source, new RegExp(`>${label}<`));
  }
  assert.match(source, />Match</);
  assert.match(source, />Status</);
  assert.match(styles, /\.vacancy-table-head-personal/);
  assert.match(styles, /\.vacancy-table-row-personal/);
  assert.match(styles, /\.vacancy-table-head-public/);
  assert.match(styles, /\.vacancy-table-row-public/);
});

test("public state fails closed and private actions remain gated", () => {
  assert.match(source, /const isPersonal = authenticated === true/);
  assert.match(source, /setAuthenticated\(false\);/);
  assert.match(source, /if \(!isPersonal\) return;/);
  assert.match(source, /\{isPersonal \? <div className="page-actions">/);
  assert.match(source, /\{isPersonal && <input/);
  assert.match(source, /\{isPersonal && <div className={`vacancy-cell vacancy-match/);
  assert.match(source, /\{isPersonal && <div className="vacancy-cell vacancy-status-cell"/);
  assert.match(source, /\{isPersonal && <article className="job-analysis-resume">/);
});

test("public and private vacancy lists share compact search and filters", () => {
  assert.match(source, /className="search vacancy-search"/);
  assert.match(source, /type="date" aria-label="Filter vacancies by posted date"/);
  assert.match(source, /label="Status"[\s\S]*options=\{STATUS_OPTIONS\}/);
  assert.match(source, /label="Conditions"[\s\S]*options=\{CONDITION_OPTIONS\}/);
  assert.match(source, /const \[statusFilters, setStatusFilters\] = useState<JobStatus\[]>\(\[\]\)/);
  assert.match(source, /const \[conditionFilters, setConditionFilters\] = useState<JobCondition\[]>\(\[\]\)/);
  assert.match(source, /statusFilters\.length === 0 \|\| statusFilters\.includes\(job\.status\)/);
  assert.match(source, /conditionFilters\.length === 0 \|\| conditionFilters\.some/);
  assert.match(styles, /\.vacancy-date-filter/);
  assert.match(styles, /\.vacancy-multifilter/);
});

test("vacancy toolbar keeps filters right and lets search consume remaining width", () => {
  assert.match(filterStyles, /\.vacancy-search\s*\{[\s\S]*flex:\s*1 1 320px !important/);
  assert.match(filterStyles, /\.vacancy-search\s*\{[\s\S]*width:\s*auto !important/);
  assert.match(filterStyles, /\.vacancy-enhanced-date-filter\s*\{[\s\S]*margin-left:\s*auto/);
  assert.match(filterStyles, /\.vacancy-clear-filters\s*\{[\s\S]*margin-left:\s*0 !important/);
  assert.match(filterStyles, /\.vacancy-multifilter \.vacancy-filter-menu\s*\{[\s\S]*right:\s*0/);
});

test("vacancy date filter uses the enhanced calendar in public and personal routes", () => {
  assert.match(route, /import \{ VacancyFilterEnhancer \} from "\.\.\/vacancy-filter-enhancer"/);
  assert.match(publicRoute, /import \{ VacancyFilterEnhancer \} from "\.\.\/vacancy-filter-enhancer"/);
  assert.match(route, /<VacancyFilterEnhancer\/>/);
  assert.match(publicRoute, /<VacancyFilterEnhancer\/>/);
  assert.match(filterStyles, /\.vacancy-date-filter\s*\{[\s\S]*display:\s*none !important/);
  assert.match(filterEnhancer, /formatSelectedDate/);
  assert.match(filterEnhancer, /day:\s*"numeric", month:\s*"short", year:\s*"numeric"/);
  assert.match(filterEnhancer, /className="vacancy-calendar-menu"/);
  assert.match(filterEnhancer, />Today</);
  assert.match(filterEnhancer, />Clear date</);
});

test("vacancy calendar disables future dates and highlights today", () => {
  assert.match(filterEnhancer, /if \(input\) input\.max = todayKey/);
  assert.match(filterEnhancer, /const future = key > todayKey/);
  assert.match(filterEnhancer, /disabled=\{future\}/);
  assert.match(filterEnhancer, /const canGoNext = !sameMonth/);
  assert.match(filterEnhancer, /disabled=\{!canGoNext\}/);
  assert.match(filterEnhancer, /isToday \? " is-today"/);
  assert.match(filterEnhancer, /aria-current=\{isToday \? "date" : undefined\}/);
  assert.match(filterStyles, /\.vacancy-calendar-day\.is-today:not\(\.is-selected\)/);
  assert.match(filterStyles, /\.vacancy-calendar-day\.is-selected\.is-today/);
});

test("vacancy filter popovers behave as one exclusive group", () => {
  assert.match(filterEnhancer, /const FILTER_GROUP = "vacancy-toolbar-filter"/);
  assert.match(filterEnhancer, /details\.name = FILTER_GROUP/);
  assert.match(filterEnhancer, /name=\{FILTER_GROUP\}/);
  assert.match(filterEnhancer, /closeFilterPopovers\(details\)/);
  assert.match(filterEnhancer, /document\.addEventListener\("toggle", onToggle, true\)/);
  assert.match(filterEnhancer, /document\.addEventListener\("pointerdown", onPointerDown\)/);
});

test("public detail score and tracking are gated by authentication", () => {
  assert.match(source, /authenticated && typeof job\.analysis\?\.score === "number"/);
  assert.match(source, /\{authenticated && <section className="tracking-box">/);
});

test("vacancy-specific stylesheet does not replace global typography", () => {
  assert.doesNotMatch(styles, /font-family\s*:/);
  assert.doesNotMatch(filterStyles, /font-family\s*:/);
  assert.doesNotMatch(styles, /(^|\n)body\s*\{/);
  assert.doesNotMatch(filterStyles, /(^|\n)body\s*\{/);
  assert.match(styles, /min-height: 54px/);
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(filterStyles, /@media \(max-width: 980px\)/);
  assert.match(filterStyles, /@media \(max-width: 700px\)/);
});
