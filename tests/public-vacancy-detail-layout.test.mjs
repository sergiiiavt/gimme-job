import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");

test("public vacancy detail is a centered borderless reading surface", () => {
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab\s*\{[\s\S]*margin:\s*18px auto 0/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab\s*\{[\s\S]*max-width:\s*1040px/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab \.job-detail\s*\{[\s\S]*background:\s*transparent/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab \.job-detail\s*\{[\s\S]*border:\s*0/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab \.job-detail\s*\{[\s\S]*box-shadow:\s*none/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab \.job-detail\s*\{[\s\S]*padding:\s*18px 0 0/);
});
