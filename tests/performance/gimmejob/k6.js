/* global __ENV */

import http from "k6/http";
import exec from "k6/execution";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";

const LOCAL_HOST = "http://127.0.0.1:4173";
const PRODUCTION_HOSTS = new Set(["gimme-job.com", "www.gimme-job.com"]);
const PRODUCTION_ACKNOWLEDGEMENT = "gimme-job.com";
const DEFAULT_PRODUCTION_SELECTOR = "vacancies-ui";
const DEFAULT_LOCAL_SELECTOR = "full-readonly";
const DEFAULT_MAX_USERS = 10;
const DEFAULT_MAX_RUN_SECONDS = 600;
const DEFAULT_MAX_FAILURE_RATIO = 0.01;
const DEFAULT_MAX_P95_MS = 10000;
const WAIT_MIN_SECONDS = 2;
const WAIT_MAX_SECONDS = 5;

const requestFailureRate = new Rate("gimmejob_request_failed");
const expected401 = http.expectedStatuses(401);

function positiveInt(name, rawValue, fallback) {
  const raw = rawValue ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}.`);
  }
  return value;
}

function positiveNumber(name, rawValue, fallback) {
  const raw = rawValue ?? String(fallback);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than zero, got ${JSON.stringify(raw)}.`);
  }
  return value;
}

function nonNegativeNumber(name, rawValue, fallback) {
  const raw = rawValue ?? String(fallback);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must not be negative, got ${JSON.stringify(raw)}.`);
  }
  return value;
}

function durationSeconds(name, rawValue, fallback) {
  const raw = String(rawValue ?? fallback).trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`${name} must use a k6 duration such as 30s, 10m, or 1h; got ${JSON.stringify(raw)}.`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "ms" ? 0.001 : unit === "s" ? 1 : unit === "m" ? 60 : 3600;
  const seconds = amount * multiplier;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`${name} must be greater than zero.`);
  }
  return seconds;
}

function durationLiteral(seconds) {
  return `${seconds}s`;
}

function normalizeHost(value) {
  return value.trim().replace(/\/+$/, "");
}

function parsedHost(host) {
  const match = host.match(/^(https?):\/\/([^/:?#]+)(?::\d+)?(?:[/?#]|$)/i);
  if (!match) {
    throw new Error(`GIMMEJOB_HOST must be an absolute http(s) URL, got ${JSON.stringify(host)}.`);
  }
  return { scheme: match[1].toLowerCase(), hostname: match[2].toLowerCase() };
}

function canonicalSelector(rawSelector) {
  const selector = rawSelector.trim().toLowerCase();
  if (selector === "smoke" || selector === "health") return "health";
  if (selector === "jobs-api" || selector === "infra") return "jobs-api";
  if (["full-readonly", "vacancies-ui", "home", "reference", "dashboard"].includes(selector)) {
    return selector;
  }
  throw new Error(
    `GIMMEJOB_SCENARIO must be one of full-readonly, vacancies-ui, health, home, reference, jobs-api, or dashboard; got ${JSON.stringify(rawSelector)}.`,
  );
}

const HOST = normalizeHost(__ENV.GIMMEJOB_HOST || LOCAL_HOST);
const HOST_INFO = parsedHost(HOST);
const IS_PRODUCTION = PRODUCTION_HOSTS.has(HOST_INFO.hostname);
const rawSelector = __ENV.GIMMEJOB_SCENARIO || "";
const SELECTOR = canonicalSelector(
  rawSelector || (IS_PRODUCTION ? DEFAULT_PRODUCTION_SELECTOR : DEFAULT_LOCAL_SELECTOR),
);
const USERS = positiveInt("GIMMEJOB_USERS", __ENV.GIMMEJOB_USERS, IS_PRODUCTION ? 10 : 1);
const SPAWN_RATE = positiveNumber("GIMMEJOB_SPAWN_RATE", __ENV.GIMMEJOB_SPAWN_RATE, 1);
const RUN_SECONDS = durationSeconds(
  "GIMMEJOB_DURATION",
  __ENV.GIMMEJOB_DURATION,
  IS_PRODUCTION ? "10m" : "30s",
);
const RAMP_SECONDS = Math.max(1, Math.ceil(USERS / SPAWN_RATE));

if (RAMP_SECONDS > RUN_SECONDS) {
  throw new Error(
    `The configured ramp (${RAMP_SECONDS}s) exceeds GIMMEJOB_DURATION (${RUN_SECONDS}s). Increase duration or spawn rate.`,
  );
}

const stages = [{ duration: durationLiteral(RAMP_SECONDS), target: USERS }];
if (RUN_SECONDS > RAMP_SECONDS) {
  stages.push({ duration: durationLiteral(RUN_SECONDS - RAMP_SECONDS), target: USERS });
}

export const options = {
  scenarios: {
    gimmejob: {
      executor: "ramping-vus",
      startVUs: 0,
      stages,
      gracefulRampDown: "0s",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)", "count"],
};

function maxConfiguredVus(testOptions) {
  const scenarios = Object.values(testOptions?.scenarios || {});
  let maximum = 0;
  for (const scenario of scenarios) {
    const candidates = [
      scenario?.vus,
      scenario?.preAllocatedVUs,
      scenario?.maxVUs,
      scenario?.startVUs,
      ...(scenario?.stages || []).map((stage) => stage?.target),
    ];
    for (const candidate of candidates) {
      if (Number.isFinite(candidate)) maximum = Math.max(maximum, Number(candidate));
    }
  }
  return maximum;
}

function configuredScenarioSeconds(scenario) {
  if (Array.isArray(scenario?.stages) && scenario.stages.length > 0) {
    return scenario.stages.reduce(
      (total, stage) => total + durationSeconds("scenario stage duration", stage.duration, "1s"),
      0,
    );
  }
  if (scenario?.duration) {
    return durationSeconds("scenario duration", scenario.duration, "1s");
  }
  return null;
}

function maxConfiguredRunSeconds(testOptions) {
  const scenarios = Object.values(testOptions?.scenarios || {});
  if (scenarios.length === 0) return null;

  let maximum = 0;
  for (const scenario of scenarios) {
    const seconds = configuredScenarioSeconds(scenario);
    if (seconds === null) return null;
    maximum = Math.max(maximum, seconds);
  }
  return maximum;
}

function abortRun(reason) {
  exec.test.abort(`GimmeJob k6 safety guard stopped the run: ${reason}`);
}

export function setup() {
  if (!IS_PRODUCTION) return { selector: SELECTOR };

  if (HOST_INFO.scheme !== "https") {
    abortRun("production tests require an https:// host");
  }
  if (__ENV.GIMMEJOB_PRODUCTION_ACK !== PRODUCTION_ACKNOWLEDGEMENT) {
    abortRun("set GIMMEJOB_PRODUCTION_ACK=gimme-job.com before targeting production");
  }

  const maxUsers = positiveInt("GIMMEJOB_MAX_USERS", __ENV.GIMMEJOB_MAX_USERS, DEFAULT_MAX_USERS);
  const configuredUsers = maxConfiguredVus(exec.test.options);
  if (configuredUsers < 1) {
    abortRun("could not determine the configured virtual-user count");
  }
  if (configuredUsers > maxUsers) {
    abortRun(`configured users (${configuredUsers}) exceed GIMMEJOB_MAX_USERS (${maxUsers})`);
  }

  const maxRunSeconds = positiveInt(
    "GIMMEJOB_MAX_RUN_SECONDS",
    __ENV.GIMMEJOB_MAX_RUN_SECONDS,
    DEFAULT_MAX_RUN_SECONDS,
  );
  const configuredRunSeconds = maxConfiguredRunSeconds(exec.test.options);
  if (configuredRunSeconds === null) {
    abortRun("production tests require an explicit bounded scenario duration");
  }
  if (configuredRunSeconds > maxRunSeconds) {
    abortRun(
      `configured duration (${configuredRunSeconds}s) exceeds GIMMEJOB_MAX_RUN_SECONDS (${maxRunSeconds}s)`,
    );
  }

  if (!rawSelector) {
    console.warn(
      `No GIMMEJOB_SCENARIO supplied for production; defaulting to ${DEFAULT_PRODUCTION_SELECTOR}.`,
    );
  }

  return { selector: SELECTOR };
}

function requestParams(name, overrides = {}) {
  return {
    headers: {
      accept: "application/json, text/html;q=0.9",
      "user-agent": "GimmeJob-authorized-k6/1.0",
    },
    tags: { name },
    ...overrides,
  };
}

function recordContract(response, name, valid) {
  requestFailureRate.add(!valid, { name });
  check(response, { [`${name}: contract valid`]: () => valid }, { name });
}

function expectHtml(path, marker, name) {
  const response = http.get(`${HOST}${path}`, requestParams(name));
  const contentType = String(response.headers["Content-Type"] || response.headers["content-type"] || "");
  const valid =
    response.status === 200 &&
    contentType.includes("text/html") &&
    (!marker || String(response.body || "").includes(marker));
  recordContract(response, name, valid);
}

function expectPublicAuthState() {
  const name = "GET /api/auth-state [vacancies UI]";
  const response = http.get(
    `${HOST}/api/auth-state`,
    requestParams(name, { responseCallback: expected401 }),
  );
  recordContract(response, name, response.status === 401);
}

function jsonPayload(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function expectDashboard(name) {
  const response = http.get(`${HOST}/api/dashboard`, requestParams(name));
  const payload = response.status === 200 ? jsonPayload(response) : null;
  const valid =
    response.status === 200 &&
    payload !== null &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Array.isArray(payload.jobs);
  recordContract(response, name, valid);
}

function vacanciesUi() {
  group("vacancies-ui", () => {
    expectHtml("/vacancies", null, "GET /vacancies [UI page]");
    expectPublicAuthState();
    expectDashboard("GET /api/dashboard [vacancies UI]");
  });
}

function health() {
  const name = "GET /api/health";
  const response = http.get(`${HOST}/api/health`, requestParams(name));
  const payload = response.status === 200 ? jsonPayload(response) : null;
  const valid =
    response.status === 200 &&
    payload !== null &&
    typeof payload === "object" &&
    payload.ok === true &&
    payload.service === "jobpilot-cloud";
  recordContract(response, name, valid);
}

function homePage() {
  expectHtml("/", "Why I created this site", "GET / [public home]");
}

function referencePage() {
  expectHtml(
    "/reference/qa-fundamentals",
    "Core QA distinctions",
    "GET /reference/qa-fundamentals [uncached]",
  );
}

function publicJobs() {
  const name = "GET /api/public/jobs [infra D1]";
  const response = http.get(`${HOST}/api/public/jobs`, requestParams(name));
  const payload = response.status === 200 ? jsonPayload(response) : null;
  const valid =
    response.status === 200 &&
    payload !== null &&
    typeof payload === "object" &&
    Array.isArray(payload.jobs) &&
    Boolean(payload.generatedAt);
  recordContract(response, name, valid);
}

function publicDashboard() {
  expectDashboard("GET /api/dashboard [diagnostic D1 heavy]");
}

const fullReadonlyTasks = [
  { name: "vacancies-ui", weight: 6, run: vacanciesUi },
  { name: "health", weight: 1, run: health },
  { name: "home", weight: 1, run: homePage },
  { name: "reference", weight: 1, run: referencePage },
  { name: "jobs-api", weight: 1, run: publicJobs },
  { name: "dashboard", weight: 1, run: publicDashboard },
];
const totalWeight = fullReadonlyTasks.reduce((sum, task) => sum + task.weight, 0);

function runWeightedFullReadonlyTask() {
  let position = Math.random() * totalWeight;
  for (const task of fullReadonlyTasks) {
    position -= task.weight;
    if (position < 0) {
      group(task.name, task.run);
      return;
    }
  }
  fullReadonlyTasks.at(-1).run();
}

function runSelectedScenario() {
  if (SELECTOR === "full-readonly") return runWeightedFullReadonlyTask();
  if (SELECTOR === "vacancies-ui") return vacanciesUi();
  if (SELECTOR === "health") return health();
  if (SELECTOR === "home") return homePage();
  if (SELECTOR === "reference") return referencePage();
  if (SELECTOR === "jobs-api") return publicJobs();
  return publicDashboard();
}

export default function () {
  runSelectedScenario();
  sleep(WAIT_MIN_SECONDS + Math.random() * (WAIT_MAX_SECONDS - WAIT_MIN_SECONDS));
}

function metricValue(data, metricName, valueName, fallback = 0) {
  const value = data.metrics?.[metricName]?.values?.[valueName];
  return Number.isFinite(value) ? Number(value) : fallback;
}

function fixed(value, digits = 2) {
  return Number(value).toFixed(digits);
}

export function handleSummary(data) {
  const requests = metricValue(data, "http_reqs", "count");
  const rps = metricValue(data, "http_reqs", "rate");
  const failureRatio = metricValue(data, "gimmejob_request_failed", "rate");
  const p50 = metricValue(data, "http_req_duration", "med");
  const p90 = metricValue(data, "http_req_duration", "p(90)");
  const p95 = metricValue(data, "http_req_duration", "p(95)");
  const p99 = metricValue(data, "http_req_duration", "p(99)");
  const maxFailureRatio = nonNegativeNumber(
    "GIMMEJOB_MAX_FAILURE_RATIO",
    __ENV.GIMMEJOB_MAX_FAILURE_RATIO,
    DEFAULT_MAX_FAILURE_RATIO,
  );
  const maxP95Ms = nonNegativeNumber(
    "GIMMEJOB_MAX_P95_MS",
    __ENV.GIMMEJOB_MAX_P95_MS,
    DEFAULT_MAX_P95_MS,
  );

  const findings = [];
  if (requests === 0) findings.push("no HTTP requests completed");
  if (failureRatio > maxFailureRatio) {
    findings.push(
      `failure ratio ${fixed(failureRatio * 100)}% exceeded ${fixed(maxFailureRatio * 100)}%`,
    );
  }
  if (p95 > maxP95Ms) findings.push(`p95 ${fixed(p95, 0)} ms exceeded ${fixed(maxP95Ms, 0)} ms`);

  const status = findings.length > 0 ? `WARNING: ${findings.join("; ")}` : "OK: reporting thresholds met";
  return {
    stdout: [
      "\nGimmeJob k6 result",
      `scenario: ${SELECTOR}`,
      `requests: ${requests} (${fixed(rps)} req/s)`,
      `request failure ratio: ${fixed(failureRatio * 100)}%`,
      `response time: p50=${fixed(p50, 0)} ms p90=${fixed(p90, 0)} ms p95=${fixed(p95, 0)} ms p99=${fixed(p99, 0)} ms`,
      status,
      "Performance findings do not change the k6 exit code; configuration/runtime safety failures do.",
      "",
    ].join("\n"),
  };
}
