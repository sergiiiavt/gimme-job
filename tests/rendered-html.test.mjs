import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { shortCircuit: true, url: cloudflareWorkersModule };
    }
    return nextResolve(specifier, context);
  },
});

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("requires Bearer auth for the Grafana health endpoint", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("grafana-health-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const context = { waitUntil() {}, passThroughOnException() {} };
  const token = "grafana-read-token";

  const okResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/health", {
      headers: { authorization: `Bearer ${token}` },
    }),
    { APP_PASSWORD: "0123456789abcdef", GRAFANA_READ_TOKEN: token, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(okResponse.status, 200);
  assert.deepEqual(await okResponse.json(), {
    status: "ok",
    service: "gimmejob",
    environment: "production",
  });
  assert.equal(okResponse.headers.get("cache-control"), "no-store");

  const missingAuth = await worker.fetch(new Request("https://gimmejob.example/api/observability/health"),
    { APP_PASSWORD: "0123456789abcdef", GRAFANA_READ_TOKEN: token, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(missingAuth.status, 401);
  assert.deepEqual(await missingAuth.json(), { error: "Authentication required." });
  assert.equal(missingAuth.headers.get("www-authenticate"), "Bearer");

  const wrongAuth = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/health", {
      headers: { authorization: "Bearer wrong-token" },
    }),
    { APP_PASSWORD: "0123456789abcdef", GRAFANA_READ_TOKEN: token, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(wrongAuth.status, 401);
  assert.deepEqual(await wrongAuth.json(), { error: "Authentication required." });

  const missingSecret = await worker.fetch(new Request("https://gimmejob.example/api/observability/health"),
    { APP_PASSWORD: "0123456789abcdef", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(missingSecret.status, 503);
  assert.deepEqual(await missingSecret.json(), { error: "Grafana access is not configured." });

  const methodNotAllowed = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/health", { method: "POST" }),
    { APP_PASSWORD: "0123456789abcdef", GRAFANA_READ_TOKEN: token, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(methodNotAllowed.status, 405);
  assert.equal(methodNotAllowed.headers.get("allow"), "GET, HEAD");
});

function fakeObservabilityDb({ fail = false } = {}) {
  return {
    prepare(sql) {
      if (fail) {
        return {
          bind() { return this; },
          async first() { throw new Error("fake summary failure"); },
          async all() { throw new Error("fake summary failure"); },
        };
      }

      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes("FROM observability_events")) {
            return {
              operations: 5,
              failures: 1,
              degraded: 2,
              errors: 4,
              avg_duration_ms: 123.5,
              last_error_at: "2026-08-14T10:00:00.000Z",
              last_successful_sync_at: "2026-08-15T00:00:00.000Z",
            };
          }

          if (sql.includes("FROM observability_snapshots") && sql.includes("ORDER BY occurred_at DESC")) {
            return {
              occurred_at: "2026-08-15T00:00:00.000Z",
              total_jobs: 350,
              remote_jobs: 240,
              reservation_jobs: 20,
              analyzed_jobs: 300,
              strong_jobs: 80,
              possible_jobs: 100,
              weak_jobs: 70,
              rejected_jobs: 50,
            };
          }

          return null;
        },
        async all() {
          if (sql.includes("event <> 'job_source_sync'")) {
            return {
              results: [
                { day: "2026-08-14", event: "job_sync", status: "success", operations: 2, error_count: 0, avg_duration_ms: 1200.5, items_processed: 240 },
              ],
            };
          }

          if (sql.includes("event = 'job_source_sync'")) {
            return {
              results: [
                { day: "2026-08-14", source: "workua:workua-qa", status: "success", operations: 2, error_count: 0, avg_duration_ms: 4100, items_processed: 54 },
              ],
            };
          }

          if (sql.includes("FROM observability_snapshots s")) {
            return {
              results: [
                {
                  occurred_at: "2026-08-14T20:30:00.000Z",
                  total_jobs: 349,
                  remote_jobs: 239,
                  reservation_jobs: 19,
                  analyzed_jobs: 299,
                  strong_jobs: 79,
                  possible_jobs: 99,
                  weak_jobs: 71,
                  rejected_jobs: 50,
                },
                {
                  occurred_at: "2026-08-15T00:00:00.000Z",
                  total_jobs: 350,
                  remote_jobs: 240,
                  reservation_jobs: 20,
                  analyzed_jobs: 300,
                  strong_jobs: 80,
                  possible_jobs: 100,
                  weak_jobs: 70,
                  rejected_jobs: 50,
                },
              ],
            };
          }

          if (sql.includes("FROM jobs")) {
            return {
              results: [
                { source: "rss:dou-qa", count: 120 },
                { source: "rss:djinni-qa", count: 90 },
              ],
            };
          }

          return { results: [] };
        },
      };

      return statement;
    },
  };
}

test("serves the Grafana observability summary endpoint", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("grafana-summary-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const context = { waitUntil() {}, passThroughOnException() {} };
  const token = "grafana-read-token";
  const env = { GRAFANA_READ_TOKEN: token, DB: fakeObservabilityDb(), ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };

  const okResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/summary?days=30", {
      headers: { authorization: `Bearer ${token}` },
    }),
    env,
    context,
  );
  assert.equal(okResponse.status, 200);
  assert.equal(okResponse.headers.get("cache-control"), "no-store");
  const summary = await okResponse.json();
  assert.equal(summary.service, "gimmejob");
  assert.equal(summary.environment, "production");
  assert.equal(summary.rangeDays, 30);
  assert.ok(summary.overview);
  assert.ok(summary.current);
  assert.ok(Array.isArray(summary.operations));
  assert.ok(Array.isArray(summary.sources));
  assert.ok(Array.isArray(summary.snapshots));
  assert.ok(Array.isArray(summary.jobsBySource));
  assert.equal(summary.overview.lastSuccessfulSyncAt, "2026-08-15T00:00:00.000Z");
  assert.equal(summary.current.totalJobs, 350);
  assert.equal(summary.sources[0].source, "workua:workua-qa");
  assert.equal(summary.jobsBySource[0].source, "rss:dou-qa");

  const missingAuth = await worker.fetch(new Request("https://gimmejob.example/api/observability/summary"), env, context);
  assert.equal(missingAuth.status, 401);
  assert.deepEqual(await missingAuth.json(), { error: "Authentication required." });
  assert.equal(missingAuth.headers.get("www-authenticate"), "Bearer");

  const wrongAuth = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/summary", {
      headers: { authorization: "Bearer wrong-token" },
    }),
    env,
    context,
  );
  assert.equal(wrongAuth.status, 401);
  assert.deepEqual(await wrongAuth.json(), { error: "Authentication required." });

  const missingSecret = await worker.fetch(new Request("https://gimmejob.example/api/observability/summary"), { DB: fakeObservabilityDb(), ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, context);
  assert.equal(missingSecret.status, 503);
  assert.deepEqual(await missingSecret.json(), { error: "Grafana access is not configured." });

  const methodNotAllowed = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/summary", { method: "POST" }),
    env,
    context,
  );
  assert.equal(methodNotAllowed.status, 405);
  assert.equal(methodNotAllowed.headers.get("allow"), "GET, HEAD");

  const headResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/summary", {
      method: "HEAD",
      headers: { authorization: `Bearer ${token}` },
    }),
    { GRAFANA_READ_TOKEN: token, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(headResponse.status, 200);
  assert.equal(await headResponse.text(), "");
  assert.equal(headResponse.headers.get("cache-control"), "no-store");

  for (const invalidDays of ["0", "abc", "3651"]) {
    const invalidResponse = await worker.fetch(
      new Request(`https://gimmejob.example/api/observability/summary?days=${invalidDays}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      env,
      context,
    );
    assert.equal(invalidResponse.status, 400);
    assert.deepEqual(await invalidResponse.json(), { error: "days must be an integer between 1 and 3650." });
  }

  const defaultDaysResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/summary", {
      headers: { authorization: `Bearer ${token}` },
    }),
    env,
    context,
  );
  assert.equal(defaultDaysResponse.status, 200);
  assert.equal((await defaultDaysResponse.json()).rangeDays, 30);

  const failingResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/observability/summary", {
      headers: { authorization: `Bearer ${token}` },
    }),
    { GRAFANA_READ_TOKEN: token, DB: fakeObservabilityDb({ fail: true }), ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(failingResponse.status, 500);
  assert.deepEqual(await failingResponse.json(), { error: "Observability data unavailable." });
});

test("keeps the public site open and protects the private workspace", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("access-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    APP_PASSWORD: "0123456789abcdef",
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const context = { waitUntil() {}, passThroughOnException() {} };

  const publicResponse = await worker.fetch(new Request("https://gimmejob.example/"), env, context);
  assert.equal(publicResponse.status, 200);

  // The vacancy workspace itself is viewable without a password (analysis/resume are public);
  // only status tracking and write actions stay gated. It still keeps noindex/no-store though,
  // since it's never meant for search engines or shared caches.
  const anonWorkspaceResponse = await worker.fetch(new Request("https://gimmejob.example/workspace"), env, context);
  assert.equal(anonWorkspaceResponse.status, 200);
  assert.equal(anonWorkspaceResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(anonWorkspaceResponse.headers.get("cache-control"), "no-store");

  const loginPage = await worker.fetch(new Request("https://gimmejob.example/workspace/login"), env, context);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Enter the password to open your personal jobs and interview-learning progress\./);

  const personalLearningResponse = await worker.fetch(new Request("https://gimmejob.example/workspace/learn?section=interview"), env, context);
  assert.equal(personalLearningResponse.status, 303);
  assert.equal(personalLearningResponse.headers.get("location"), "/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview");

  const wrongLogin = await worker.fetch(
    new Request("https://gimmejob.example/workspace/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "incorrect" }),
    }),
    env,
    context,
  );
  assert.equal(wrongLogin.status, 401);

  const loginResponse = await worker.fetch(
    new Request("https://gimmejob.example/workspace/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: env.APP_PASSWORD }),
    }),
    env,
    context,
  );
  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get("location"), "/workspace");
  const sessionCookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.match(sessionCookie ?? "", /^gimmejob_session=/);

  const learningLoginResponse = await worker.fetch(
    new Request("https://gimmejob.example/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: env.APP_PASSWORD }),
    }),
    env,
    context,
  );
  assert.equal(learningLoginResponse.status, 303);
  assert.equal(learningLoginResponse.headers.get("location"), "/workspace/learn?section=interview");

  const sessionResponse = await worker.fetch(
    new Request("https://gimmejob.example/workspace", { headers: { cookie: sessionCookie } }),
    env,
    context,
  );
  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");

  const authorization = `Basic ${Buffer.from("gimmejob:0123456789abcdef").toString("base64")}`;
  const authorizedResponse = await worker.fetch(
    new Request("https://gimmejob.example/workspace", { headers: { authorization } }),
    env,
    context,
  );
  assert.equal(authorizedResponse.status, 200);
  assert.equal(authorizedResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");

  // GET /api/dashboard is now public (the vacancy analysis it returns should be visible without
  // logging in); it reaches the handler instead of being blocked at the auth gate. This test env
  // has no D1 binding, so the handler itself fails past the gate — the point here is only that
  // it's no longer the auth gate's 401, which is asserted precisely.
  const publicApiResponse = await worker.fetch(new Request("https://gimmejob.example/api/dashboard"), env, context);
  assert.notEqual(publicApiResponse.status, 401);
  const publicApiBody = await publicApiResponse.json();
  assert.notDeepEqual(publicApiBody, { error: "Authentication required." });

  // Write/cost actions (sync, analyze, status edits) stay gated even though viewing is public.
  const anonSyncResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/sync", { method: "POST" }),
    env,
    context,
  );
  assert.equal(anonSyncResponse.status, 401);
  assert.deepEqual(await anonSyncResponse.json(), { error: "Authentication required." });

  const progressApiResponse = await worker.fetch(new Request("https://gimmejob.example/api/interview-progress"), env, context);
  assert.equal(progressApiResponse.status, 401);

  const robotsResponse = await worker.fetch(new Request("https://gimmejob.example/robots.txt"), env, context);
  assert.equal(robotsResponse.status, 200);
  assert.match(await robotsResponse.text(), /Disallow: \/workspace/);
});

function fakeImportObservabilityDb({ failUpsert = false, failDashboard = false } = {}) {
  const state = {
    dashboardQueries: 0,
    events: [],
    jobCount: 0,
    snapshots: 0,
  };

  return {
    db: {
      prepare(sql) {
        const text = String(sql);
        const statement = {
          params: [],
          bind(...args) {
            statement.params = args;
            return statement;
          },
          async run() {
            if (text.includes("INSERT INTO jobs (")) {
              if (failUpsert) throw new Error("fake upsert failure");
              state.jobCount += 1;
            }

            if (text.includes("INSERT INTO observability_events")) {
              const [event, status, , , , , itemsSeen, itemsProcessed, errorCount] = statement.params;
              state.events.push({ event, status, itemsSeen, itemsProcessed, errorCount });
            }

            if (text.includes("INSERT INTO observability_snapshots")) {
              state.snapshots += 1;
            }

            return { success: true };
          },
          async first() {
            if (text.includes("SELECT COUNT(*) AS count FROM jobs")) {
              return { count: state.jobCount };
            }

            if (text.includes("AS total_jobs") && text.includes("FROM jobs")) {
              return {
                total_jobs: state.jobCount,
                remote_jobs: 0,
                reservation_jobs: 0,
              };
            }

            if (text.includes("AS analyzed_jobs") && text.includes("FROM analyses")) {
              return {
                analyzed_jobs: 0,
                strong_jobs: 0,
                possible_jobs: 0,
                weak_jobs: 0,
                rejected_jobs: 0,
              };
            }

            if (failDashboard && text.includes("SELECT * FROM jobs ORDER BY COALESCE(posted_at, discovered_at) DESC")) {
              state.dashboardQueries += 1;
              throw new Error("fake dashboard failure");
            }

            return null;
          },
          async all() {
            if (failDashboard && text.includes("SELECT * FROM jobs ORDER BY COALESCE(posted_at, discovered_at) DESC")) {
              state.dashboardQueries += 1;
              throw new Error("fake dashboard failure");
            }

            return { results: [] };
          },
        };

        return statement;
      },
    },
    state,
  };
}

test("records only job_import success when dashboard fails after import", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("import-observability-success-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const context = { waitUntil() {}, passThroughOnException() {} };
  const { db, state } = fakeImportObservabilityDb({ failDashboard: true });
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  const authorization = `Basic ${Buffer.from("gimmejob:0123456789abcdef").toString("base64")}`;

  const response = await worker.fetch(
    new Request("https://gimmejob.example/api/import", {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jobs: [{ title: "QA Engineer", company: "Acme" }],
      }),
    }),
    {
      APP_PASSWORD: "0123456789abcdef",
      DB: db,
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    context,
  );

  assert.equal(response.status, 500);
  assert.match((await response.json()).error ?? "", /fake dashboard failure/i);

  const importEvents = state.events.filter((entry) => entry.event === "job_import");
  assert.equal(importEvents.length, 1);
  assert.equal(importEvents[0].status, "success");
  assert.equal(importEvents[0].itemsSeen, 1);
  assert.equal(importEvents[0].itemsProcessed, 1);
  assert.equal(importEvents[0].errorCount, 0);
  assert.equal(importEvents.some((entry) => entry.status === "failure"), false);
  assert.equal(state.snapshots, 1);
  assert.equal(state.dashboardQueries, 1);
});

test("records only job_import failure when upsert fails", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("import-observability-failure-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const context = { waitUntil() {}, passThroughOnException() {} };
  const { db, state } = fakeImportObservabilityDb({ failUpsert: true });
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  const authorization = `Basic ${Buffer.from("gimmejob:0123456789abcdef").toString("base64")}`;

  const response = await worker.fetch(
    new Request("https://gimmejob.example/api/import", {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jobs: [{ title: "QA Engineer", company: "Acme" }],
      }),
    }),
    {
      APP_PASSWORD: "0123456789abcdef",
      DB: db,
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    context,
  );

  assert.equal(response.status, 500);
  assert.match((await response.json()).error ?? "", /fake upsert failure/i);

  const importEvents = state.events.filter((entry) => entry.event === "job_import");
  assert.equal(importEvents.length, 1);
  assert.equal(importEvents[0].status, "failure");
  assert.equal(importEvents[0].itemsSeen, 1);
  assert.equal(importEvents[0].itemsProcessed, null);
  assert.equal(importEvents[0].errorCount, 1);
  assert.equal(importEvents.some((entry) => entry.status === "success"), false);
  assert.equal(state.snapshots, 0);
  assert.equal(state.dashboardQueries, 0);
});
