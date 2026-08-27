import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-responsive-stats.css", import.meta.url), "utf8");

test("vacancy counters use an intrinsic-height grid on mobile", () => {
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.vacancy-workspace-personal \.stat-line,[\s\S]*\.vacancy-workspace-public \.stat-line\s*\{[\s\S]*display:\s*grid/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line,[\s\S]*\.vacancy-workspace-public \.stat-line\s*\{[\s\S]*height:\s*auto/);
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line,[\s\S]*\.vacancy-workspace-public \.stat-line\s*\{[\s\S]*width:\s*100%/);
});

test("personal and public vacancy counters keep one row with the right column count", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /\.vacancy-workspace-public \.stat-line\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("mobile counter cells can shrink instead of forcing wrapping or overflow", () => {
  assert.match(styles, /\.vacancy-workspace-personal \.stat-line > div,[\s\S]*\.vacancy-workspace-public \.stat-line > div\s*\{[\s\S]*min-width:\s*0/);
});
