import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("HTTP status codes are methodic inline material instead of reference accordions", async () => {
  const [english, ukrainian] = await Promise.all([
    readFile(projectFile("content/api-integration/http-foundations.md"), "utf8"),
    readFile(projectFile("content/api-integration/http-foundations.uk.md"), "utf8"),
  ]);

  for (const markdown of [english, ukrainian]) {
    assert.match(markdown, /## HTTP status codes/);
    assert.doesNotMatch(markdown, /:::details/);
    assert.doesNotMatch(markdown, /<!-- flush-table -->/);

    const groups = ["1xx", "2xx", "3xx", "4xx", "5xx"];
    for (const group of groups) {
      assert.match(markdown, new RegExp(`### ${group}`), `Missing inline ${group} status-code section`);
    }

    assert.match(markdown, /\| Code \|/);
    assert.match(markdown, /200 OK/);
    assert.match(markdown, /201 Created/);
    assert.match(markdown, /304 Not Modified/);
    assert.match(markdown, /401 Unauthorized/);
    assert.match(markdown, /403 Forbidden/);
    assert.match(markdown, /409 Conflict/);
    assert.match(markdown, /422 Unprocessable Content/);
    assert.match(markdown, /429 Too Many Requests/);
    assert.match(markdown, /500 Internal Server Error/);
    assert.match(markdown, /502 Bad Gateway/);
    assert.match(markdown, /503 Service Unavailable/);
    assert.match(markdown, /504 Gateway Timeout/);
    assert.match(markdown, /### Important status-code distinctions|### Важливі відмінності status codes/);
  }
});
