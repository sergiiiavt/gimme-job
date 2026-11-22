import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { EMAIL_AUTOMATION_ENABLED } from "../app/email-automation.ts";
import { N8N_INTEGRATION_ENABLED } from "../app/n8n-integration.ts";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobMultiUserCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobMultiUserCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

function fakeSessionDb({ failSessionDelete = false } = {}) {
  const state = { deletedSessions: 0, progressUserIds: [], starUserIds: [] };
  const db = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, " ").trim();
      const statement = {
        params: [],
        bind(...values) { statement.params = values; return statement; },
        async first() {
          if (text.includes("FROM user_sessions s") && text.includes("INNER JOIN users u")) {
            return {
              user_id: "user-a",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
              google_sub: "local:user-a",
              email: "a@example.com",
              name: "User A",
              picture_url: null,
            };
          }
          return null;
        },
        async all() {
          if (text.includes("FROM user_interview_progress")) {
            state.progressUserIds.push(String(statement.params[0]));
            return { results: [{ question_id: "api-testing", status: "LEARNING", updated_at: "2026-08-15T10:00:00.000Z" }] };
          }
          if (text.includes("FROM user_interview_stars")) {
            state.starUserIds.push(String(statement.params[0]));
            return { results: [{ question_id: "api-testing", created_at: "2026-08-15T10:00:00.000Z" }] };
          }
          return { results: [] };
        },
        async run() {
          if (text.startsWith("DELETE FROM user_sessions WHERE token_hash")) {
            if (failSessionDelete) throw new Error("simulated D1 session delete failure");
            state.deletedSessions += 1;
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
  return { db, state };
}

function envFor(db) {
  return {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "legacy-password-must-not-authorize-multi-user-mode",
    N8N_INGEST_TOKEN: "n8n-service-token",
    DB: db,
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

const context = { waitUntil() {}, passThroughOnException() {} };

test("multi-user Worker serves canonical password login and collapses legacy query routes", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-spoof-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db } = fakeSessionDb();
  const env = envFor(db);

  const login = await worker.fetch(new Request("https://gimmejob.example/login", {
    headers: { referer: "https://gimmejob.example/interview" },
  }), env, context);
  assert.equal(login.status, 200);
  const loginHtml = await login.text();
  assert.match(loginHtml, /Sign in/);
  assert.match(loginHtml, /action="\/login"/);
  assert.doesNotMatch(loginHtml, /\?next=/);

  const legacyLogin = await worker.fetch(new Request("https://gimmejob.example/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview"), env, context);
  assert.equal(legacyLogin.status, 308);
  assert.equal(legacyLogin.headers.get("location"), "/login");

  const spoofedApi = await worker.fetch(new Request("https://gimmejob.example/api/interview-progress", {
    headers: { "x-gimmejob-auth-mode": "multi-user", "x-gimmejob-authenticated": "1", "x-gimmejob-user-id": "victim-user" },
  }), env, context);
  assert.equal(spoofedApi.status, 401);
  assert.deepEqual(await spoofedApi.json(), { error: "Authentication required." });

  const spoofedStarsApi = await worker.fetch(new Request("https://gimmejob.example/api/interview-stars", {
    headers: { "x-gimmejob-auth-mode": "multi-user", "x-gimmejob-authenticated": "1", "x-gimmejob-user-id": "victim-user" },
  }), env, context);
  assert.equal(spoofedStarsApi.status, 401);
  assert.deepEqual(await spoofedStarsApi.json(), { error: "Authentication required." });

  const legacyWorkspace = await worker.fetch(new Request("https://gimmejob.example/workspace/learn?section=interview", {
    headers: { "x-gimmejob-auth-mode": "multi-user", "x-gimmejob-authenticated": "1", "x-gimmejob-user-id": "victim-user" },
  }), env, context);
  assert.equal(legacyWorkspace.status, 308);
  assert.equal(legacyWorkspace.headers.get("location"), "/interview");
});

test("multi-user Worker injects only the user id resolved from the server session", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-session-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db, state } = fakeSessionDb();
  const env = envFor(db);
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";

  const response = await worker.fetch(new Request("https://gimmejob.example/api/interview-progress", {
    headers: {
      cookie: "gimmejob_user_session=server-session-token",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "attacker-controlled-user",
    },
  }), env, context);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.progress[0].questionId, "api-testing");
  assert.deepEqual(state.progressUserIds, ["user-a"]);

  const starsResponse = await worker.fetch(new Request("https://gimmejob.example/api/interview-stars", {
    headers: {
      cookie: "gimmejob_user_session=server-session-token",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "attacker-controlled-user",
    },
  }), env, context);
  assert.equal(starsResponse.status, 200);
  const starsPayload = await starsResponse.json();
  assert.deepEqual(starsPayload.starredQuestionIds, ["api-testing"]);
  assert.deepEqual(state.starUserIds, ["user-a"]);
});

test("paused email automation answers n8n email routes with 503 even with a valid service token", { skip: EMAIL_AUTOMATION_ENABLED && "email automation is enabled" }, async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-email-paused-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db } = fakeSessionDb();
  const env = envFor(db);

  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";
  cloudflareEnv.N8N_INGEST_TOKEN = "n8n-service-token";

  for (const [path, method] of [["/internal/n8n/email-events?limit=1", "GET"], ["/internal/n8n/email-classify", "POST"]]) {
    const response = await worker.fetch(new Request(`https://gimmejob.example${path}`, {
      method,
      headers: { authorization: "Bearer n8n-service-token" },
    }), env, context);
    assert.equal(response.status, 503, `${method} ${path}`);
    assert.equal((await response.json()).code, "email_automation_paused");
  }
});

test("paused n8n integration answers n8n-only routes with 503 but keeps the vacancy-sync POST on its bearer auth", { skip: N8N_INTEGRATION_ENABLED && "n8n integration is enabled" }, async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-n8n-paused-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db } = fakeSessionDb();
  const env = envFor(db);

  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";
  cloudflareEnv.N8N_INGEST_TOKEN = "n8n-service-token";

  const activity = await worker.fetch(new Request("https://gimmejob.example/internal/n8n/vacancies-sync?startUtc=2026-11-21T22:00:00.000Z&endUtc=2026-11-22T22:00:00.000Z", {
    headers: { authorization: "Bearer n8n-service-token" },
  }), env, context);
  assert.equal(activity.status, 503);
  assert.equal((await activity.json()).code, "n8n_integration_paused");

  // The hourly GitHub Actions vacancy sync shares this route by POST; it must reach the route's own bearer check.
  const vacancySync = await worker.fetch(new Request("https://gimmejob.example/internal/n8n/vacancies-sync", { method: "POST" }), env, context);
  assert.equal(vacancySync.status, 401);
  assert.equal(vacancySync.headers.get("www-authenticate"), "Bearer");
});

test("multi-user Worker preserves n8n bearer auth only for scoped internal service routes", { skip: (!EMAIL_AUTOMATION_ENABLED || !N8N_INTEGRATION_ENABLED) && "email automation or the n8n integration is paused; their n8n routes answer 503 before auth" }, async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-n8n-service-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db } = fakeSessionDb();
  const env = envFor(db);

  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";
  cloudflareEnv.N8N_INGEST_TOKEN = "n8n-service-token";

  const authorized = await worker.fetch(new Request("https://gimmejob.example/internal/n8n/email-events?limit=1", {
    headers: {
      authorization: "Bearer n8n-service-token",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "attacker-controlled-user",
    },
  }), env, context);
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), { events: [] });

  const classifier = await worker.fetch(new Request("https://gimmejob.example/internal/n8n/email-classify", {
    method: "POST",
    headers: {
      authorization: "Bearer n8n-service-token",
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "attacker-controlled-user",
    },
    body: JSON.stringify({ id: "evt-missing", userId: "user-a" }),
  }), env, context);
  assert.equal(classifier.status, 404);
  assert.deepEqual(await classifier.json(), { error: "Email event was not found." });

  const rejected = await worker.fetch(new Request("https://gimmejob.example/internal/n8n/email-events?limit=1", {
    headers: { authorization: "Bearer wrong-token" },
  }), env, context);
  assert.equal(rejected.status, 401);
  assert.deepEqual(await rejected.json(), { error: "Authentication required." });

  const rejectedClassifier = await worker.fetch(new Request("https://gimmejob.example/internal/n8n/email-classify", {
    method: "POST",
    headers: { authorization: "Bearer wrong-token", "content-type": "application/json" },
    body: JSON.stringify({ id: "evt-missing", userId: "user-a" }),
  }), env, context);
  assert.equal(rejectedClassifier.status, 401);
  assert.deepEqual(await rejectedClassifier.json(), { error: "Authentication required." });
});

test("multi-user logout invalidates the D1 session and returns to the same canonical page", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-logout-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db, state } = fakeSessionDb();
  const env = envFor(db);
  const response = await worker.fetch(new Request("https://gimmejob.example/logout", {
    method: "POST",
    headers: {
      cookie: "gimmejob_user_session=server-session-token",
      referer: "https://gimmejob.example/interview",
    },
  }), env, context);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/interview");
  assert.equal(state.deletedSessions, 1);
  assert.match(response.headers.get("set-cookie") ?? "", /^gimmejob_user_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(response.headers.get("set-cookie") ?? "", /Secure/);
});

test("multi-user logout still clears the browser session when D1 deletion fails", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-logout-d1-failure-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db } = fakeSessionDb({ failSessionDelete: true });
  const env = envFor(db);
  const response = await worker.fetch(new Request("https://gimmejob.example/logout", {
    method: "POST",
    headers: {
      cookie: "gimmejob_user_session=server-session-token",
      referer: "https://gimmejob.example/",
    },
  }), env, context);

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/vacancies");
  assert.match(response.headers.get("set-cookie") ?? "", /^gimmejob_user_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});
