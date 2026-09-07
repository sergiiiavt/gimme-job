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
const azureConfig = readFileSync(
  new URL("./performance/gimmejob/azure-loadtest.yaml", import.meta.url),
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

test("untagged production Locust runs safely default to the Vacancies scenario", () => {
  assert.match(locustfile, /DEFAULT_PRODUCTION_TAG = "vacancies-ui"/);
  assert.match(locustfile, /@events\.init\.add_listener/);
  assert.match(locustfile, /setattr\(environment, "tags", \[DEFAULT_PRODUCTION_TAG\]\)/);
  assert.match(locustfile, /No task selector supplied for production/);
  assert.doesNotMatch(locustfile, /production tests require LOCUST_TAGS/);
  assert.match(readme, /defaults to `vacancies-ui`/);
});

test("Azure Locust baseline selects the complete read-only workload without performance failure criteria", () => {
  assert.match(azureConfig, /testType:\s*Locust/);
  assert.match(azureConfig, /name:\s*LOCUST_TAGS\s*\n\s*value:\s*full-readonly/);
  assert.match(azureConfig, /name:\s*GIMMEJOB_PRODUCTION_ACK\s*\n\s*value:\s*gimme-job\.com/);
  assert.match(azureConfig, /name:\s*LOCUST_USERS\s*\n\s*value:\s*"10"/);
  assert.match(azureConfig, /name:\s*LOCUST_RUN_TIME\s*\n\s*value:\s*"600"/);
  assert.match(azureConfig, /name:\s*GIMMEJOB_MAX_FAILURE_RATIO\s*\n\s*value:\s*"0\.01"/);
  assert.match(azureConfig, /name:\s*GIMMEJOB_MAX_P95_MS\s*\n\s*value:\s*"10000"/);
  assert.doesNotMatch(azureConfig, /failureCriteria:/);
  assert.doesNotMatch(azureConfig, /percentage\(error\)/);
  assert.doesNotMatch(azureConfig, /p95\(response_time_ms\)/);
  assert.match(readme, /primary Azure baseline runs every defined read-only Locust task with 10 total virtual users/i);
});

test("performance findings do not turn a completed load run into an execution failure", () => {
  assert.match(locustfile, /def report_exploratory_thresholds/);
  assert.match(locustfile, /performance thresholds exceeded; execution completed successfully/);
  assert.match(locustfile, /LOGGER\.warning/);
  assert.equal(
    (locustfile.match(/process_exit_code/g) ?? []).length,
    1,
    "Only the no-requests execution failure may set process_exit_code",
  );
  assert.match(locustfile, /No requests completed during the GimmeJob load test/);
  assert.match(readme, /Performance numbers do not decide whether the load test executed successfully/);
});

test("full-readonly tag covers every defined read-only Locust task", () => {
  for (const decorator of [
    '@tag("vacancies-ui", "full-readonly", "real-ui", "d1")',
    '@tag("health", "smoke", "full-readonly", "api", "worker")',
    '@tag("home", "full-readonly", "diagnostic", "edge", "html")',
    '@tag("reference", "full-readonly", "diagnostic", "worker", "html")',
    '@tag("jobs-api", "infra", "full-readonly", "d1", "api")',
    '@tag("dashboard", "full-readonly", "diagnostic", "d1", "api", "heavy")',
  ]) {
    assert.ok(locustfile.includes(decorator), `Missing full-readonly coverage: ${decorator}`);
  }
  assert.match(readme, /`full-readonly` \| Vacancies UI flow/);
  assert.match(readme, /10 total virtual users, not 10 users per endpoint/);
});

test("GimmeJob Locust workload remains read-only and avoids cost-generating routes", () => {
  assert.doesNotMatch(locustfile, /self\.client\.(?:post|put|patch|delete)\(/);
  assert.doesNotMatch(locustfile, /\/api\/ai\//);
  assert.doesNotMatch(locustfile, /\/api\/(?:sync|analyze|run|import)/);
  assert.doesNotMatch(locustfile, /\/api\/observability\//);

  for (const route of [
    "/vacancies",
    "/api/auth-state",
    "/api/health",
    "/api/public/jobs",
    "/api/dashboard",
  ]) {
    assert.match(locustfile, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("GimmeJob Locust exposes a real anonymous Vacancies UI benchmark", () => {
  assert.match(locustfile, /@tag\("vacancies-ui", "full-readonly", "real-ui", "d1"\)/);
  assert.match(locustfile, /GET \/vacancies \[UI page\]/);
  assert.match(locustfile, /GET \/api\/auth-state \[vacancies UI\]/);
  assert.match(locustfile, /GET \/api\/dashboard \[vacancies UI\]/);
  assert.match(locustfile, /response\.status_code != 401/);
  assert.match(locustfile, /response\.success\(\)/);
  assert.doesNotMatch(locustfile, /payload\.get\("authenticated"\) is not False/);
  assert.match(readme, /LOCUST_TAGS` \| `full-readonly`/);
  assert.match(readme, /fresh 10-user `full-readonly` baseline/);
});

test("public jobs stays available only as an infrastructure diagnostic", () => {
  assert.match(locustfile, /@tag\("jobs-api", "infra", "full-readonly", "d1", "api"\)/);
  assert.match(locustfile, /GET \/api\/public\/jobs \[infra D1\]/);
  assert.match(readme, /not a current frontend consumer/);
  assert.doesNotMatch(readme, /`public-read`/);
});

test("GimmeJob Locust version is pinned for reproducible local and Azure runs", () => {
  assert.match(requirements, /^locust==\d+\.\d+\.\d+\s*$/);
});

test("GimmeJob Locust documentation states benchmark VUH and bounded monthly limit", () => {
  assert.match(readme, /1\.67/);
  assert.match(readme, /8\.33/);
  assert.match(readme, /16\.67/);
  assert.match(readme, /approximately USD 4\.00/);
  assert.match(readme, /about 45\.2 VUH/);
  assert.match(readme, /50 VUH/);
});

test("GimmeJob Locust documentation separates client-side and Cloudflare observability", () => {
  assert.match(readme, /Azure Load Testing: client\/load-generator view/);
  assert.match(readme, /Cloudflare: server\/platform view/);
  assert.match(readme, /Workers & Pages -> gimmejob/);
  assert.match(readme, /gimmejob-db/);
  assert.match(readme, /https:\/\/developers\.cloudflare\.com\/workers\/observability\/metrics-and-analytics\//);
  assert.match(readme, /https:\/\/developers\.cloudflare\.com\/d1\/observability\/metrics-analytics\//);
});
