import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public AI bridge covers the complete AI Assistant API surface only", async () => {
  const source = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(source, /pathname\.startsWith\("\/api\/ai\/"\)/);
  assert.match(source, /x-gimmejob-session-scope/);
  assert.match(source, /authorization/);
  assert.doesNotMatch(source, /url\.pathname\.startsWith\("\/api\/"\)/);
});
