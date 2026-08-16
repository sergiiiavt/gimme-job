import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AuthStatusControl, {
  accountInitial,
  gmailConnectHref,
  gmailDisconnectHref,
  loadAuthSession,
  shouldNormalizeToPersonal,
  signInHref,
  startAuthSync,
} from "../app/auth-status-control.ts";
import { GET as authState } from "../app/api/auth-state/route.ts";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("signInHref uses the canonical query-free login route", () => {
  assert.equal(signInHref("/interview"), "/login");
});

test("Gmail account actions preserve the intended private destination", () => {
  const destination = "/interview";
  assert.equal(
    gmailConnectHref(destination),
    "/auth/google/start?mode=gmail&next=%2Finterview",
  );
  assert.equal(
    gmailDisconnectHref(destination),
    "/auth/gmail/disconnect?next=%2Finterview",
  );
});

test("account initial prefers the Google profile name then email", () => {
  assert.equal(accountInitial(null), "G");
  assert.equal(accountInitial({ enabled: true, authenticated: true, user: { id: "1", email: "user@example.com", name: null, pictureUrl: null } }), "U");
  assert.equal(accountInitial({ enabled: true, authenticated: true, user: { id: "1", email: "user@example.com", name: "Sergii", pictureUrl: null } }), "S");
});

test("auth session loader uses the no-store account endpoint", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const result = await loadAuthSession(async (input, init) => {
    requests.push({ input: String(input), init });
    return Response.json({
      enabled: true,
      authenticated: true,
      user: { id: "usr-1", email: "user@example.com", name: "User", pictureUrl: null },
      gmail: { connected: false },
    });
  });
  assert.equal(requests[0]?.input, "/auth/session");
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.equal(result?.user?.email, "user@example.com");

  const missing = await loadAuthSession(async () => new Response(null, { status: 401 }));
  assert.equal(missing, null);
});

test("canonical routes stay stable across auth state", () => {
  assert.equal(shouldNormalizeToPersonal("public", true, "/vacancies", "https://gimme-job.com/vacancies"), false);
  assert.equal(shouldNormalizeToPersonal("public", true, "/about", "https://gimme-job.com/about"), false);
  assert.equal(shouldNormalizeToPersonal("public", false, "/about", "https://gimme-job.com/about"), false);
  assert.equal(shouldNormalizeToPersonal("personal", true, "/about", "https://gimme-job.com/about"), false);
});

test("auth sync enables personal view without changing an already canonical URL", async () => {
  const states: boolean[] = [];
  const redirects: string[] = [];
  startAuthSync({
    mode: "public",
    personalHref: "/interview",
    onAuthenticatedChange: (value) => states.push(value),
    probe: async () => ({ ok: true }),
    currentHref: () => "https://gimme-job.com/interview",
    replace: (href) => redirects.push(href),
  });
  await tick();
  assert.deepEqual(states, [true]);
  assert.deepEqual(redirects, []);
});

test("auth sync keeps the vacancies URL stable when it is already the personal target", async () => {
  const redirects: string[] = [];
  startAuthSync({
    mode: "public",
    personalHref: "/vacancies",
    onAuthenticatedChange: () => {},
    probe: async () => ({ ok: true }),
    currentHref: () => "https://gimme-job.com/vacancies",
    replace: (href) => redirects.push(href),
  });
  await tick();
  assert.deepEqual(redirects, []);
});

test("expired personal access returns to canonical sign in", async () => {
  const states: boolean[] = [];
  const redirects: string[] = [];
  startAuthSync({
    mode: "personal",
    personalHref: "/interview",
    onAuthenticatedChange: (value) => states.push(value),
    probe: async () => ({ ok: false }),
    currentHref: () => "https://gimme-job.com/interview",
    replace: (href) => redirects.push(href),
  });
  await tick();
  assert.deepEqual(states, [false]);
  assert.deepEqual(redirects, ["/login"]);
});

test("auth sync falls back to the route mode on probe failure and supports cancellation", async () => {
  const fallbackStates: boolean[] = [];
  startAuthSync({
    mode: "personal",
    personalHref: "/vacancies",
    onAuthenticatedChange: (value) => fallbackStates.push(value),
    probe: async () => { throw new Error("offline"); },
    currentHref: () => "https://gimme-job.com/vacancies",
    replace: () => {},
  });
  await tick();
  assert.deepEqual(fallbackStates, [true]);

  const cancelledStates: boolean[] = [];
  let resolveProbe!: (value: { ok: boolean }) => void;
  const cleanup = startAuthSync({
    mode: "public",
    personalHref: "/vacancies",
    onAuthenticatedChange: (value) => cancelledStates.push(value),
    probe: () => new Promise((resolve) => { resolveProbe = resolve; }),
    currentHref: () => "https://gimme-job.com/about",
    replace: () => {},
  });
  cleanup();
  resolveProbe({ ok: true });
  await tick();
  assert.deepEqual(cancelledStates, []);
});

test("auth control renders a compact sign-in action publicly and the account menu privately", () => {
  const publicMarkup = renderToStaticMarkup(createElement(AuthStatusControl, { mode: "public", personalHref: "/vacancies" }));
  assert.match(publicMarkup, />Sign in<\/a>/);
  assert.doesNotMatch(publicMarkup, /Public view/);
  assert.doesNotMatch(publicMarkup, /Personal<\/a>/);

  const personalMarkup = renderToStaticMarkup(createElement(AuthStatusControl, { mode: "personal", personalHref: "/vacancies" }));
  assert.match(personalMarkup, /Signed in/);
  assert.match(personalMarkup, /Personal workspace/);
  assert.match(personalMarkup, /Gmail forwarding/);
  assert.match(personalMarkup, /Sign out/);
  assert.match(personalMarkup, /method="post"/);
});

test("auth-state endpoint reports trusted identity and never caches", async () => {
  const response = await authState(new Request("https://gimme-job.com/api/auth-state", {
    headers: {
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-123",
    },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { authenticated: true, userId: "user-123" });

  const anonymous = await authState(new Request("https://gimme-job.com/api/auth-state"));
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await anonymous.json(), { authenticated: false, userId: null });

  const local = await authState(new Request("http://localhost/api/auth-state"));
  assert.equal(local.status, 200);
});