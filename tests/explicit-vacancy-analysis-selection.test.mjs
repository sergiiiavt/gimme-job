import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/vacancies-workspace.tsx", "utf8");

test("vacancy analysis has no implicit unselected fallback", () => {
  assert.match(source, /const targetIds = \[...selectedIds\];/);
  assert.doesNotMatch(source, /jobs\.filter\(\(job\) => !job\.analysis\)\.slice\(0, 25\)/);
  assert.match(source, /disabled=\{busy !== null \|\| selectedIds\.size === 0\}/);
});
