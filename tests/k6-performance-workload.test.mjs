import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptUrl = new URL("../tests/performance/gimmejob/k6.js", import.meta.url);
const scriptPath = fileURLToPath(scriptUrl);
const source = readFileSync(scriptUrl, "utf8");

test("k6 workload is syntactically valid JavaScript", () => {
  const result = spawnSync(process.execPath, ["--check", scriptPath], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("k6 workload covers the same read-only GimmeJob routes as Locust", () => {
  for (const marker of [
    "GET /vacancies [UI page]",
    "GET /api/auth-state [vacancies UI]",
    "GET /api/dashboard [vacancies UI]",
    "GET /api/health",
    "GET / [public home]",
    "GET /reference/qa-fundamentals [uncached]",
    "GET /api/public/jobs [infra D1]",
    "GET /api/dashboard [diagnostic D1 heavy]",
  ]) {
    assert.ok(source.includes(marker), `missing request marker: ${marker}`);
  }

  assert.match(source, /responseCallback: expected401/);
  assert.match(source, /response\.status === 401/);
});

test("k6 full-readonly model preserves the Locust task weights", () => {
  assert.match(source, /name: "vacancies-ui", weight: 6, run: vacanciesUi/);
  for (const task of ["health", "home", "reference", "jobs-api", "dashboard"]) {
    assert.match(source, new RegExp(`name: "${task}", weight: 1`));
  }
});

test("k6 production guard validates acknowledgement, users, duration, and consolidated options", () => {
  for (const marker of [
    "GIMMEJOB_PRODUCTION_ACK",
    "GIMMEJOB_MAX_USERS",
    "GIMMEJOB_MAX_RUN_SECONDS",
    "exec.test.options",
    "production tests require an https:// host",
    "DEFAULT_PRODUCTION_SELECTOR = \"vacancies-ui\"",
  ]) {
    assert.ok(source.includes(marker), `missing production safety marker: ${marker}`);
  }
});

test("k6 reports performance findings without threshold-driven execution failures", () => {
  assert.ok(source.includes("handleSummary"));
  assert.ok(source.includes("gimmejob_request_failed"));
  assert.ok(source.includes("GIMMEJOB_MAX_FAILURE_RATIO"));
  assert.ok(source.includes("GIMMEJOB_MAX_P95_MS"));
  assert.doesNotMatch(source, /\bthresholds\s*:/);
});
