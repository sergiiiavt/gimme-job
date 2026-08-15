import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/auth-status-control.ts", import.meta.url), "utf8");

test("account menu exposes Gmail forwarding verification without a public/private switcher", () => {
  assert.match(source, /Verify Gmail forwarding/);
  assert.match(source, /confirmationCode/);
  assert.doesNotMatch(source, /Public\s*\/\s*Personal/);
});
