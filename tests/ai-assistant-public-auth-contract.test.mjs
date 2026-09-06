import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workerEntry, authBoundary] = await Promise.all([
  readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/multi-user-boundary.ts", import.meta.url), "utf8"),
]);

test("AI Assistant requests are promoted to public ephemeral sessions before auth", () => {
  assert.match(workerEntry, /pathname\.startsWith\("\/api\/ai\/"\)/);
  assert.match(workerEntry, /headers\.set\("x-gimmejob-session-scope", "ephemeral"\)/);
  assert.match(workerEntry, /const routedRequest = withPublicAiSessionScope\(request\);/);
});

test("the public auth boundary includes the Learning Advisor live stream", () => {
  assert.match(authBoundary, /\/api\/ai\/learning-path\/stream/);
});
