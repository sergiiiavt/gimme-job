import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/to-top-button.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/to-top-button.css", import.meta.url), "utf8");

test("to-top control covers vacancies, interview questions, and learning paths", () => {
  assert.match(source, /pathname === "\/vacancies"/);
  assert.match(source, /pathname === "\/workspace"/);
  assert.match(source, /pathname\.startsWith\("\/interview"\)/);
  assert.match(source, /pathname === "\/learn"/);
  assert.match(source, /pathname\.startsWith\("\/learn\/"\)/);
  assert.match(source, /pathname === "\/workspace\/learn"/);
  assert.match(source, /pathname\.startsWith\("\/workspace\/learn\/"\)/);
  assert.match(source, /window\.scrollTo\(\{ top: 0/);
  assert.match(source, />To top</);
});

test("to-top control follows the private vacancy scroll container", () => {
  assert.match(source, /\.vacancy-workspace-personal > \.vacancy-list-view/);
  assert.match(source, /\.vacancy-workspace-personal > \.vacancy-detail-tab/);
  assert.match(source, /document\.addEventListener\("scroll", scheduleVisibilityUpdate, true\)/);
  assert.match(source, /scrollElement\.scrollTo\(\{ top: 0, behavior \}\)/);
});

test("desktop layout keeps the vacancy table left-aligned with only a right control gutter", () => {
  assert.match(styles, /\.vacancy-workspace > \.vacancy-list-view[\s\S]*margin-left:\s*0/);
  assert.match(styles, /\.vacancy-workspace > \.vacancy-list-view[\s\S]*margin-right:\s*60px/);
  assert.match(styles, /\.vacancy-workspace > \.vacancy-list-view[\s\S]*max-width:\s*none/);
  assert.match(styles, /\.vacancy-workspace > \.vacancy-list-view[\s\S]*width:\s*auto/);
  assert.match(styles, /\.to-top-button-interview[\s\S]*right:\s*max\(2px, env\(safe-area-inset-right\)\)/);
});
