import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public AI bridge stays limited to explicit session-scoped endpoints", async () => {
  const source = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(source, /x-gimmejob-session-scope/);
  assert.match(source, /\/api\/ai\/learning-path/);
  assert.match(source, /\/api\/ai\/interviews/);
  assert.match(source, /authorization/);
  assert.doesNotMatch(source, /url\.pathname\.startsWith\("\/api\/"\)/);
});
