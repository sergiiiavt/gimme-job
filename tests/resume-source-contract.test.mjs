import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app/resume-page.tsx", import.meta.url), "utf8");
const server = await readFile(new URL("../app/api/owner-resume/data.ts", import.meta.url), "utf8");

test("resume content is delivered from an owner-only API, not bundled into the public client", () => {
  assert.match(client, /fetch\\("\\/api\\/owner-resume"/);
  assert.match(client, /fetch\\("\\/api\\/settings"\\)/);
  assert.doesNotMatch(client, /PUBLIC RESUME|TIETO UKRAINE LTD|GlobalLogic|SERHII YAVTUSHKEVYCH/);
  assert.match(server, /Lead QA Engineer/);
  assert.match(server, /TIETO UKRAINE LTD/);
  assert.match(server, /National Technical University of Ukraine/);
  assert.doesNotMatch(server, /sergii\\.iavt@gmail\\.com/i);
});
