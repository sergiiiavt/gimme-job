import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../app/vacancy-detail-layout.css", import.meta.url), "utf8");

test("public vacancy detail is centered and inherits the standard private card surface", () => {
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab\s*\{[\s\S]*margin:\s*18px auto 0/);
  assert.match(styles, /\.vacancy-workspace-public \.vacancy-detail-tab\s*\{[\s\S]*max-width:\s*1040px/);

  const publicDetailRule = styles.match(/\.vacancy-workspace-public \.vacancy-detail-tab \.job-detail\s*\{([^}]*)\}/s)?.[1] ?? "";
  assert.match(publicDetailRule, /margin:\s*0/);
  assert.match(publicDetailRule, /width:\s*100%/);
  assert.doesNotMatch(publicDetailRule, /background\s*:/);
  assert.doesNotMatch(publicDetailRule, /border\s*:/);
  assert.doesNotMatch(publicDetailRule, /border-radius\s*:/);
  assert.doesNotMatch(publicDetailRule, /box-shadow\s*:/);
  assert.doesNotMatch(publicDetailRule, /padding\s*:/);
});
