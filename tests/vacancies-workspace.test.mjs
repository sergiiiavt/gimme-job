import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/vacancies-workspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancies-workspace.css", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");

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
  assert.match(styles, /\.vacancy-search\s*\{[\s\S]*width: 250px/);
  assert.match(styles, /\.vacancy-date-filter/);
  assert.match(styles, /\.vacancy-multifilter/);
});

test("public detail score and tracking are gated by authentication", () => {
  assert.match(source, /authenticated && typeof job\.analysis\?\.score === "number"/);
  assert.match(source, /\{authenticated && <section className="tracking-box">/);
});

test("vacancy-specific stylesheet does not replace global typography", () => {
  assert.doesNotMatch(styles, /font-family\s*:/);
  assert.doesNotMatch(styles, /(^|\n)body\s*\{/);
  assert.match(styles, /min-height: 54px/);
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
});
