import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { N8N_INTEGRATION_ENABLED, n8nIntegrationPausedResponse } = await import("../app/n8n-integration.ts");

const request = (path, method = "GET") => new Request(`https://gimme-job.com${path}`, { method });

test("paused n8n integration answers every n8n-only route with 503", async () => {
  for (const [path, method] of [
    ["/internal/n8n/vacancies-sync?startUtc=2026-11-21T22:00:00.000Z&endUtc=2026-11-22T22:00:00.000Z", "GET"],
    ["/internal/n8n/vacancies-sync", "HEAD"],
    ["/internal/n8n/email-events", "GET"],
    ["/internal/n8n/email-classify", "POST"],
    ["/internal/n8n/email-resolve", "POST"],
    ["/internal/n8n/email-stats", "GET"],
    ["/internal/n8n/not-a-route", "POST"],
  ]) {
    const response = n8nIntegrationPausedResponse(request(path, method), false);
    assert.equal(response?.status, 503, `${method} ${path}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "The n8n integration is paused.", code: "n8n_integration_paused" });
  }
});

test("paused n8n integration leaves the GitHub Actions vacancy sync and non-n8n routes alone", () => {
  for (const [path, method] of [
    ["/internal/n8n/vacancies-sync", "POST"],
    ["/internal/rag/search", "POST"],
    ["/internal/n8nx", "GET"],
    ["/api/dashboard", "GET"],
    ["/api/email-events/unresolved", "GET"],
  ]) {
    assert.equal(n8nIntegrationPausedResponse(request(path, method), false), null, `${method} ${path}`);
  }
});

test("enabled n8n integration passes n8n routes through", () => {
  assert.equal(n8nIntegrationPausedResponse(request("/internal/n8n/vacancies-sync?startUtc=x&endUtc=y"), true), null);
  assert.equal(n8nIntegrationPausedResponse(request("/internal/n8n/email-classify", "POST"), true), null);
});

// No YAML parser is a dependency, and the workflow file is itself the contract: read the
// trigger names declared directly under the top-level `on:` block.
async function workflowTriggers(file) {
  const source = await readFile(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8");
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  assert.notEqual(start, -1, `${file} declares a block-style on:`);
  const triggers = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = /^ {2}([A-Za-z_]+):/.exec(line);
    if (match) triggers.push(match[1]);
  }
  return triggers;
}

test("Hetzner n8n runtime workflows run only on manual dispatch while n8n is paused", { skip: N8N_INTEGRATION_ENABLED && "n8n integration is enabled" }, async () => {
  for (const file of ["hetzner-n8n.yml", "hetzner-n8n-repair.yml"]) {
    assert.deepEqual(await workflowTriggers(file), ["workflow_dispatch"], file);
  }
});
