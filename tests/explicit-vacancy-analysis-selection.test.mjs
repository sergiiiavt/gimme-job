import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/vacancies-workspace.tsx", "utf8");

test("vacancy analysis requires an explicit board selection or active vacancy tab", () => {
  assert.match(source, /const targetIds = vacancyAnalysisTargets\(selected\?\.id \?\? null, selectedIds\);/);
  assert.doesNotMatch(source, /jobs\.filter\(\(job\) => !job\.analysis\)\.slice\(0, 25\)/);
  assert.match(source, /const analysisTargetCount = selected \? 1 : selectedIds\.size;/);
  assert.match(source, /disabled=\{busy !== null \|\| analysisTargetCount === 0\}/);
});
