import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const locustfile = readFileSync(
  new URL("./performance/gimmejob/locustfile.py", import.meta.url),
  "utf8",
);
const requirements = readFileSync(
  new URL("./performance/gimmejob/requirements.txt", import.meta.url),
  "utf8",
);
const readme = readFileSync(
  new URL("./performance/gimmejob/README.md", import.meta.url),
  "utf8",
);

test("GimmeJob Locust workload remains production-acknowledged and bounded", () => {
  assert.doesNotMatch(
    locustfile,
    /from\s+__future__\s+import/,
    "Azure Load Testing prepends generated code, so future imports are not valid in the uploaded script",
  );
  assert.match(locustfile, /GIMMEJOB_PRODUCTION_ACK/);
  assert.match(locustfile, /GIMMEJOB_MAX_USERS/);
  assert.match(locustfile, /GIMMEJOB_MAX_RUN_SECONDS/);
  assert.match(locustfile, /production tests require an explicit --run-time/);
  assert.match(locustfile, /production tests require an https:\/\/ host/);
  assert.match(locustfile, /between\(2, 5\)/);
});

test("GimmeJob Locust workload remains read-only and avoids cost-generating routes", () => {
  assert.doesNotMatch(locustfile, /self\.client\.(?:post|put|patch|delete)\(/);
  assert.doesNotMatch(locustfile, /\/api\/ai\//);
  assert.doesNotMatch(locustfile, /\/api\/(?:sync|analyze|run|import)/);
  assert.doesNotMatch(locustfile, /\/api\/observability\//);

  for (const route of [
    "/api/health",
    "/api/public/jobs",
    "/api/dashboard",
    "/reference/qa-fundamentals",
  ]) {
    assert.match(locustfile, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("GimmeJob Locust exposes the non-health public workload as one selectable scenario", () => {
  for (const selector of ["home", "reference", "jobs", "dashboard"]) {
    assert.match(locustfile, new RegExp(`@tag\\([^\\n]*"${selector}"`));
  }
  assert.equal((locustfile.match(/"public-read"/g) ?? []).length, 4);
  assert.match(locustfile, /@tag\("health", "smoke", "api", "worker"\)/);
  assert.match(readme, /LOCUST_TAGS=public-read/);
  assert.match(readme, /Azure Load Testing engine/);
  assert.match(readme, /Worker: gimmejob/);
  assert.match(readme, /D1: gimmejob-db/);
});

test("GimmeJob Locust version is pinned for reproducible local and Azure runs", () => {
  assert.match(requirements, /^locust==\d+\.\d+\.\d+\s*$/);
});

test("GimmeJob Locust documentation states Azure's per-run billing minimum", () => {
  assert.match(readme, /minimum billable usage of 1\.67 VUH/);
  assert.match(readme, /budgets notify and do not stop/);
});

test("GimmeJob Locust documentation separates client-side and Cloudflare observability", () => {
  assert.match(readme, /Azure Load Testing: client\/load-generator view/);
  assert.match(readme, /Cloudflare: server\/platform view/);
  assert.match(readme, /Workers & Pages -> gimmejob/);
  assert.match(readme, /gimmejob-db/);
  assert.match(readme, /Cloudflare Workers metrics and analytics/);
  assert.match(readme, /Cloudflare D1 metrics and analytics/);
});
