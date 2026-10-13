import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-responsive-stats.css", import.meta.url), "utf8");

test("personal vacancy counters use an intrinsic-height grid on mobile", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.vacancy-workspace-personal \.stat-line\s*\{[^}]*display:\s*grid/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line\s*\{[^}]*height:\s*auto/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line\s*\{[^}]*width:\s*100%/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});

test("public view has no dead mobile counter styling", () => {
  assert.doesNotMatch(styles, /vacancy-workspace-public/);
});

test("mobile personal counter cells can shrink instead of overflowing", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line > div\s*\{[^}]*min-width:\s*0/);
});
