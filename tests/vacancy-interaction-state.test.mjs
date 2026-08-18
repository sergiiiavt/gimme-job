import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const scrollState = readFileSync(new URL("../app/vacancy-scroll-state.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancy-interaction-state.css", import.meta.url), "utf8");

test("vacancy interaction enhancer is mounted globally", () => {
  assert.match(layout, /import VacancyScrollState from "\.\/vacancy-scroll-state"/);
  assert.match(layout, /import "\.\/vacancy-interaction-state\.css"/);
  assert.match(layout, /<VacancyScrollState\/>/);
});

test("analysis progress disappears when analysis is no longer running", () => {
  assert.match(styles, /vacancy-workspace-personal:not\(:has\(\.stop-button\)\) > \.analyze-progress:not\(\.vacancy-load-progress\)/);
  assert.match(styles, /display:\s*none/);
});

test("status changes expose immediate database saving feedback", () => {
  assert.match(styles, /tracking-box:has\(select:disabled\)::before/);
  assert.match(styles, /vacancy-status-saving/);
  assert.match(styles, /Saving status to database/);
});

test("private dashboard and vacancy detail use isolated desktop scroll panes", () => {
  assert.match(styles, /@media \(min-width: 981px\)/);
  assert.match(styles, /\.vacancy-workspace-personal\s*\{[\s\S]*display:\s*flex[\s\S]*height:\s*100dvh[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.vacancy-workspace-personal > \.vacancy-list-view,[\s\S]*\.vacancy-workspace-personal > \.vacancy-detail-tab[\s\S]*overflow-y:\s*auto !important/);
  assert.match(styles, /overscroll-behavior-y:\s*contain/);
});

test("dashboard and each vacancy keep independent session scroll positions", () => {
  assert.match(scrollState, /gimmejob:vacancy-scroll-state:v1/);
  assert.match(scrollState, /board:\s*number/);
  assert.match(scrollState, /details:\s*Record<string, number>/);
  assert.match(scrollState, /snapshot\.board = target\.scrollTop/);
  assert.match(scrollState, /snapshot\.details\[id\] = target\.scrollTop/);
  assert.match(scrollState, /detail\.scrollTop = snapshot\.details\[id\] \?\? 0/);
  assert.match(scrollState, /board\.scrollTop = snapshot\.board/);
  assert.match(scrollState, /attributeFilter: \["aria-labelledby"\]/);
});

test("manual sync resets remembered vacancy scroll state", () => {
  assert.match(scrollState, /button\.textContent\?\.includes\("Sync jobs"\)/);
  assert.match(scrollState, /snapshot\.board = 0/);
  assert.match(scrollState, /snapshot\.details = \{\}/);
});
