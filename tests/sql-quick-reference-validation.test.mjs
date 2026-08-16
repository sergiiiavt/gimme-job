import test from "node:test";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

test("SQL quick reference catalog validates", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-sql-quick-reference.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
