import assert from "node:assert/strict";
import test from "node:test";
import { isLoopbackHost, safeDownloadName } from "../agent/src/host-guard.ts";

test("the local agent accepts only loopback Host headers", () => {
  assert.equal(isLoopbackHost("127.0.0.1:4317"), true);
  assert.equal(isLoopbackHost("localhost:4318"), true);
  assert.equal(isLoopbackHost("LOCALHOST"), true);
  assert.equal(isLoopbackHost("terminal.local:4317"), true);

  // DNS-rebinding hostnames resolve to 127.0.0.1 but keep the attacker's name.
  assert.equal(isLoopbackHost("rebind.attacker.example:4317"), false);
  assert.equal(isLoopbackHost("127.0.0.1.attacker.example"), false);
  assert.equal(isLoopbackHost("localhost.attacker.example:4317"), false);
  assert.equal(isLoopbackHost(undefined), false);
  assert.equal(isLoopbackHost(""), false);
  assert.equal(isLoopbackHost("bad host"), false);
});

test("download names cannot break out of the Content-Disposition parameter", () => {
  assert.equal(safeDownloadName("job_abc-123.v2"), "job_abc-123.v2");
  assert.equal(safeDownloadName('evil"; filename=x.exe'), "evil___filename_x.exe");
  assert.equal(safeDownloadName("a\r\nSet-Cookie: x"), "a__Set-Cookie__x");
});
