import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobMultiUserCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobMultiUserCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

function fakeSessionDb() {
  const state = { deletedSessions: 0, progressUserIds: [] };
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
          return { results: [] };
        },
        async run() {
          if (text.startsWith("DELETE FROM user_sessions WHERE token_hash")) state.deletedSessions += 1;
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
    DB: db,
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

const context = { waitUntil() {}, passThroughOnException() {} };

test("multi-user Worker serves password login and ignores spoofed identity headers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-spoof-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db } = fakeSessionDb();
  const env = envFor(db);

  const login = await worker.fetch(new Request("https://gimmejob.example/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview"), env, context);
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Sign in/);

  const spoofedApi = await worker.fetch(new Request("https://gimmejob.example/api/interview-progress", {
    headers: { "x-gimmejob-auth-mode": "multi-user", "x-gimmejob-authenticated": "1", "x-gimmejob-user-id": "victim-user" },
  }), env, context);
  assert.equal(spoofedApi.status, 401);
  assert.deepEqual(await spoofedApi.json(), { error: "Authentication required." });

  const spoofedWorkspace = await worker.fetch(new Request("https://gimmejob.example/workspace/learn?section=interview", {
    headers: { "x-gimmejob-auth-mode": "multi-user", "x-gimmejob-authenticated": "1", "x-gimmejob-user-id": "victim-user" },
  }), env, context);
  assert.equal(spoofedWorkspace.status, 303);
  assert.equal(spoofedWorkspace.headers.get("location"), "/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview");
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
});

test("multi-user logout invalidates the D1 session and clears only the user-session cookie", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("multi-user-logout-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const { db, state } = fakeSessionDb();
  const env = envFor(db);
  const response = await worker.fetch(new Request("https://gimmejob.example/workspace/logout", {
    method: "POST",
    headers: { cookie: "gimmejob_user_session=server-session-token" },
  }), env, context);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  assert.equal(state.deletedSessions, 1);
  assert.match(response.headers.get("set-cookie") ?? "", /^gimmejob_user_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(response.headers.get("set-cookie") ?? "", /Secure/);
});
