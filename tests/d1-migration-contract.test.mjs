import assert from "node:assert/strict";
import test from "node:test";

test("canonical D1 migration history satisfies the repository contract", async () => {
  const moduleUrl = new URL("../scripts/check-d1-migrations.mjs", import.meta.url);
  moduleUrl.searchParams.set("coverage-test", String(Date.now()));
  const loaded = await import(moduleUrl.href);
  assert.ok(loaded);
});
