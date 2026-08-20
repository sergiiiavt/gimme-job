import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const scrollState = readFileSync(new URL("../app/vacancy-scroll-state.tsx", import.meta.url), "utf8");
const popoverLayer = readFileSync(new URL("../app/vacancy-popover-layer.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/vacancy-interaction-state.css", import.meta.url), "utf8");
const generalStyles = readFileSync(new URL("../app/general-ui-fixes.css", import.meta.url), "utf8");

test("vacancy interaction enhancers are mounted globally", () => {
  assert.match(layout, /import VacancyScrollState from "\.\/vacancy-scroll-state"/);
  assert.match(layout, /import VacancyPopoverLayer from "\.\/vacancy-popover-layer"/);
  assert.match(layout, /import "\.\/vacancy-interaction-state\.css"/);
  assert.match(layout, /import "\.\/general-ui-fixes\.css"/);
  assert.match(layout, /<VacancyScrollState\/>/);
  assert.match(layout, /<VacancyPopoverLayer\/>/);
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

test("dashboard keeps its position while every vacancy opens from the top", () => {
  assert.match(scrollState, /gimmejob:vacancy-scroll-state:v1/);
  assert.match(scrollState, /board:\s*number/);
  assert.doesNotMatch(scrollState, /details:\s*Record<string, number>/);
  assert.match(scrollState, /snapshot\.board = target\.scrollTop/);
  assert.match(scrollState, /snapshot\.board = Math\.max\(0, window\.scrollY\)/);
  assert.match(scrollState, /board\.scrollTop = snapshot\.board/);
  assert.match(scrollState, /window\.scrollTo\(\{ top: snapshot\.board, behavior: "auto" \}\)/);
  assert.match(scrollState, /detail\.scrollTop = 0/);
  assert.match(scrollState, /window\.scrollTo\(\{ top: 0, behavior: "auto" \}\)/);
  assert.doesNotMatch(scrollState, /snapshot\.details/);
});

test("manual sync resets remembered dashboard scroll state", () => {
  assert.match(scrollState, /button\.textContent\?\.includes\("Sync jobs"\)/);
  assert.match(scrollState, /snapshot\.board = 0/);
});

test("vacancy filter menus use the browser top layer and follow their anchors", () => {
  assert.match(popoverLayer, /setAttribute\("popover", "manual"\)/);
  assert.match(popoverLayer, /showPopover\?\.\(\)/);
  assert.match(popoverLayer, /position:\s*"fixed"/);
  assert.match(popoverLayer, /document\.addEventListener\("scroll", scheduleSync, true\)/);
  assert.match(popoverLayer, /window\.addEventListener\("resize", scheduleSync\)/);
  assert.match(generalStyles, /\.vacancy-filter-menu\[popover\]/);
  assert.match(generalStyles, /\.vacancy-calendar-menu\[popover\]/);
});

test("long learning TOCs scroll internally without a visible scrollbar", () => {
  assert.match(generalStyles, /max-height:\s*calc\(100dvh - 36px\)/);
  assert.match(generalStyles, /overflow-y:\s*auto/);
  assert.match(generalStyles, /overscroll-behavior-y:\s*contain/);
  assert.match(generalStyles, /scrollbar-width:\s*none/);
  assert.match(generalStyles, /::-webkit-scrollbar/);
  assert.match(generalStyles, /-webkit-line-clamp:\s*2/);
  assert.match(generalStyles, /grid-template-columns:\s*minmax\(0, 1fr\) 228px/);
});
