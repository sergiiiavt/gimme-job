import assert from "node:assert/strict";
import test from "node:test";
import {
  createMultiUserBoundary,
  isPrivateRequest,
  privateNextPath,
  sanitizeIdentityHeaders,
} from "../worker/multi-user-boundary.ts";

type FakeEnv = { APP_PASSWORD?: string; MULTI_USER_ENABLED?: string; DB?: D1Database };
type CapturedCall = { request: Request; env: FakeEnv };

function fakeCore() {
  const calls: CapturedCall[] = [];
  return {
    calls,
    worker: {
      async fetch(request: Request, env: FakeEnv): Promise<Response> {
        calls.push({ request, env });
        return Response.json({ core: true });
      },
    },
  };
}

function fakeSessionDb(authenticated = true) {
  const state = { deletes: 0 };
  const db = {
    prepare(sql: string) {
      const text = sql.replace(/\s+/g, " ").trim();
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; return statement; },
        async first() {
          if (authenticated && text.includes("FROM user_sessions s") && text.includes("INNER JOIN users u")) {
            return {
              user_id: "user-a",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
              google_sub: "local:user-a",
              email: "a@example.com",
              name: null,
              picture_url: null,
            };
          }
          return null;
        },
        async run() {
          if (text.startsWith("DELETE FROM user_sessions WHERE token_hash")) state.deletes += 1;
          return { success: true };
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, state };
}

test("routing helpers accept only internal workspace return paths", () => {
  assert.equal(privateNextPath(new URL("https://example.com/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview")), "/workspace/learn?section=interview");
  assert.equal(privateNextPath(new URL("https://example.com/workspace/login?next=https%3A%2F%2Fevil.example")), "/workspace");
  assert.equal(privateNextPath(new URL("https://example.com/workspace/login?next=%2F%2Fevil.example")), "/workspace");
  assert.equal(isPrivateRequest(new Request("https://example.com/workspace"), new URL("https://example.com/workspace")), false);
  assert.equal(isPrivateRequest(new Request("https://example.com/workspace/login"), new URL("https://example.com/workspace/login")), false);
  assert.equal(isPrivateRequest(new Request("https://example.com/workspace/register"), new URL("https://example.com/workspace/register")), false);
  assert.equal(isPrivateRequest(new Request("https://example.com/workspace/learn"), new URL("https://example.com/workspace/learn")), true);
  assert.equal(isPrivateRequest(new Request("https://example.com/api/dashboard"), new URL("https://example.com/api/dashboard")), false);
  assert.equal(isPrivateRequest(new Request("https://example.com/api/jobs/1", { method: "PATCH" }), new URL("https://example.com/api/jobs/1")), true);
});

test("identity headers are always removed before the legacy core sees a request", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const request = new Request("https://example.com/", { headers: {
    "x-gimmejob-auth-mode": "multi-user",
    "x-gimmejob-authenticated": "1",
    "x-gimmejob-user-id": "victim",
    "x-normal-header": "keep-me",
  } });
  const sanitized = sanitizeIdentityHeaders(request);
  assert.equal(sanitized.headers.get("x-gimmejob-user-id"), null);
  assert.equal(sanitized.headers.get("x-normal-header"), "keep-me");
  const response = await boundary.fetch(request, { MULTI_USER_ENABLED: "false" }, undefined);
  assert.equal(response.status, 200);
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-user-id"), null);
});

test("multi-user login and registration render local account forms", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const env: FakeEnv = { MULTI_USER_ENABLED: "true", DB: fakeSessionDb(false).db };
  const login = await boundary.fetch(new Request("https://example.com/workspace/login?next=%2Fworkspace%2Flearn"), env, undefined);
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Sign in/);
  const register = await boundary.fetch(new Request("https://example.com/workspace/register?next=%2Fworkspace"), env, undefined);
  assert.equal(register.status, 200);
  assert.match(await register.text(), /Create account/);
  const method = await boundary.fetch(new Request("https://example.com/workspace/login", { method: "DELETE" }), env, undefined);
  assert.equal(method.status, 405);
  assert.equal(calls.length, 0);
});

test("private routes reject spoofed tenant identity without a session", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const env: FakeEnv = { MULTI_USER_ENABLED: "true", DB: fakeSessionDb(false).db };
  const api = await boundary.fetch(new Request("https://example.com/api/interview-progress", { headers: {
    "x-gimmejob-authenticated": "1", "x-gimmejob-user-id": "victim",
  } }), env, undefined);
  assert.equal(api.status, 401);
  const workspace = await boundary.fetch(new Request("https://example.com/workspace/learn?section=interview"), env, undefined);
  assert.equal(workspace.status, 303);
  assert.equal(workspace.headers.get("location"), "/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview");
  assert.equal(calls.length, 0);
});

test("legacy private About URL redirects to the public About page before auth", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const env: FakeEnv = { MULTI_USER_ENABLED: "true", DB: fakeSessionDb(false).db };
  const response = await boundary.fetch(new Request("https://example.com/workspace/learn?section=about"), env, undefined);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "/");
  assert.equal(calls.length, 0);
});

test("a D1 session replaces attacker headers with trusted tenant identity", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const env: FakeEnv = { MULTI_USER_ENABLED: "true", DB: fakeSessionDb(true).db, APP_PASSWORD: "legacy-secret" };
  const response = await boundary.fetch(new Request("https://example.com/api/interview-progress", { headers: {
    cookie: "gimmejob_user_session=valid-session",
    authorization: "Basic attacker-value",
    "x-gimmejob-user-id": "attacker-user",
  } }), env, undefined);
  assert.equal(response.status, 200);
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-user-id"), "user-a");
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-authenticated"), "1");
  assert.notEqual(calls[0]!.env.APP_PASSWORD, "legacy-secret");
});

test("public multi-user requests reach core without client Authorization", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const env: FakeEnv = { MULTI_USER_ENABLED: "true", DB: fakeSessionDb(false).db };
  const response = await boundary.fetch(new Request("https://example.com/", { headers: { authorization: "Basic client-value" } }), env, undefined);
  assert.equal(response.status, 200);
  assert.equal(calls[0]!.request.headers.get("authorization"), null);
  assert.equal(calls[0]!.request.headers.get("x-gimmejob-authenticated"), "0");
});

test("logout is POST-only and invalidates the D1 session", async () => {
  const { worker: core, calls } = fakeCore();
  const boundary = createMultiUserBoundary(core);
  const { db, state } = fakeSessionDb(true);
  const env: FakeEnv = { MULTI_USER_ENABLED: "true", DB: db };
  const headers = { cookie: "gimmejob_user_session=valid-session" };
  const getLogout = await boundary.fetch(new Request("https://example.com/workspace/logout", { headers }), env, undefined);
  assert.equal(getLogout.status, 405);
  const logout = await boundary.fetch(new Request("https://example.com/workspace/logout", { method: "POST", headers }), env, undefined);
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get("location"), "/");
  assert.equal(state.deletes, 1);
  assert.match(logout.headers.get("set-cookie") ?? "", /^gimmejob_user_session=;/);
  assert.equal(calls.length, 0);
});