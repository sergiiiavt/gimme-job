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
  assert.match(locustfile, /@tag\("vacancies-ui", "real-ui", "d1"\)/);
  assert.match(locustfile, /GET \/vacancies \[UI page\]/);
  assert.match(locustfile, /GET \/api\/auth-state \[vacancies UI\]/);
  assert.match(locustfile, /GET \/api\/dashboard \[vacancies UI\]/);
  assert.match(locustfile, /response\.status_code != 401/);
  assert.match(locustfile, /payload\.get\("authenticated"\) is not False/);
  assert.match(readme, /LOCUST_TAGS` \| `vacancies-ui`/);
  assert.match(readme, /10\/50\/100-user benchmark/);
  assert.match(readme, /Mark the 10-user run as the baseline/);
});

test("public jobs stays available only as an infrastructure diagnostic", () => {
  assert.match(locustfile, /@tag\("jobs-api", "infra", "d1", "api"\)/);
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
  assert.match(readme, /40-VUH monthly resource limit/);
});

test("GimmeJob Locust documentation separates client-side and Cloudflare observability", () => {
  assert.match(readme, /Azure Load Testing: client\/load-generator view/);
  assert.match(readme, /Cloudflare: server\/platform view/);
  assert.match(readme, /Workers & Pages -> gimmejob/);
  assert.match(readme, /gimmejob-db/);
  assert.match(readme, /https:\/\/developers\.cloudflare\.com\/workers\/observability\/metrics-and-analytics\//);
  assert.match(readme, /https:\/\/developers\.cloudflare\.com\/d1\/observability\/metrics-analytics\//);
});
