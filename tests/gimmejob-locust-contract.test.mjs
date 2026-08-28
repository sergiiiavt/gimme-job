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

test("GimmeJob Locust version is pinned for reproducible local and Azure runs", () => {
  assert.match(requirements, /^locust==\d+\.\d+\.\d+\s*$/);
});

test("GimmeJob Locust documentation states Azure's per-run billing minimum", () => {
  const readme = readFileSync(
    new URL("./performance/gimmejob/README.md", import.meta.url),
    "utf8",
  );

  assert.match(readme, /minimum billable usage of 1\.67 VUH/);
  assert.match(readme, /budgets notify and do not stop/);
});
