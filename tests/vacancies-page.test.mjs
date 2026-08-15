import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/vacancies-page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancies-page.css", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");

test("workspace uses the dedicated vacancies page", () => {
  assert.match(route, /import VacanciesPage from "\.\.\/vacancies-page"/);
  assert.match(route, /<VacanciesPage\/>/);
});

test("vacancies list has separate public and personal layouts", () => {
  assert.match(source, /const mode = authenticated \? "personal" : "public"/);
  assert.match(source, /className={`vacancy-column-head vacancy-column-head-\$\{mode\}`}/);
  assert.match(source, /className={`vacancy-row vacancy-row-\$\{mode\}`}/);
  assert.match(styles, /\.vacancy-column-head-personal/);
  assert.match(styles, /\.vacancy-column-head-public/);
  assert.match(styles, /\.vacancy-row-personal/);
  assert.match(styles, /\.vacancy-row-public/);
  assert.match(source, /Sign in for personal tools/);
  assert.match(source, /Match/);
  assert.match(source, /Posted/);
  assert.match(source, /Status/);
  assert.match(source, /authenticated && <div className={`vacancy-match/);
  assert.match(source, /authenticated && <span className={`status/);
});

test("public vacancy detail does not render personal analysis and resume panels", () => {
  assert.match(source, /authenticated && <article className="job-analysis-resume">/);
  assert.match(source, /authenticated && typeof job\.analysis\?\.score/);
  assert.match(source, /authenticated && job\.feedback === "RELEVANT"/);
});

test("vacancy rows use compact dedicated layout rules", () => {
  assert.match(styles, /\.vacancy-row-personal/);
  assert.match(styles, /grid-template-columns: 18px minmax\(260px, 1fr\) 100px 84px 92px/);
  assert.match(styles, /min-height: 76px/);
  assert.match(styles, /\.vacancy-row-public/);
});
