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

test("signInHref preserves the intended private destination", () => {
  assert.equal(
    signInHref("/workspace/learn?section=interview"),
    "/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview",
  );
});

test("Gmail account actions preserve the intended private destination", () => {
  const destination = "/workspace/learn?section=interview";
  assert.equal(
    gmailConnectHref(destination),
    "/auth/google/start?mode=gmail&next=%2Fworkspace%2Flearn%3Fsection%3Dinterview",
  );
  assert.equal(
    gmailDisconnectHref(destination),
    "/auth/gmail/disconnect?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview",
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

test("public routes normalize to the private equivalent only when authenticated", () => {
  assert.equal(shouldNormalizeToPersonal("public", true, "/workspace", "https://gimme-job.com/workspace"), false);
  assert.equal(shouldNormalizeToPersonal("public", true, "/workspace/learn?section=about", "https://gimme-job.com/"), true);
  assert.equal(shouldNormalizeToPersonal("public", false, "/workspace/learn?section=about", "https://gimme-job.com/"), false);
  assert.equal(shouldNormalizeToPersonal("personal", true, "/workspace/learn?section=about", "https://gimme-job.com/"), false);
});

test("auth sync enables personal view and redirects a logged-in public route", async () => {
  const states: boolean[] = [];
  const redirects: string[] = [];
  startAuthSync({
    mode: "public",
    personalHref: "/workspace/learn?section=interview",
    onAuthenticatedChange: (value) => states.push(value),
    probe: async () => ({ ok: true }),
    currentHref: () => "https://gimme-job.com/#interview",
    replace: (href) => redirects.push(href),
  });
  await tick();
  assert.deepEqual(states, [true]);
  assert.deepEqual(redirects, ["/workspace/learn?section=interview"]);
});

test("auth sync keeps the vacancies URL stable when it is already the personal target", async () => {
  const redirects: string[] = [];
  startAuthSync({
    mode: "public",
    personalHref: "/workspace",
    onAuthenticatedChange: () => {},
    probe: async () => ({ ok: true }),
    currentHref: () => "https://gimme-job.com/workspace",
    replace: (href) => redirects.push(href),
  });
  await tick();
  assert.deepEqual(redirects, []);
});

test("expired personal access returns to sign in", async () => {
  const states: boolean[] = [];
  const redirects: string[] = [];
  startAuthSync({
    mode: "personal",
    personalHref: "/workspace/learn?section=interview",
    onAuthenticatedChange: (value) => states.push(value),
    probe: async () => ({ ok: false }),
    currentHref: () => "https://gimme-job.com/workspace/learn?section=interview",
    replace: (href) => redirects.push(href),
  });
  await tick();
  assert.deepEqual(states, [false]);
  assert.deepEqual(redirects, ["/workspace/login?next=%2Fworkspace%2Flearn%3Fsection%3Dinterview"]);
});

test("auth sync falls back to the route mode on probe failure and supports cancellation", async () => {
  const fallbackStates: boolean[] = [];
  startAuthSync({
    mode: "personal",
    personalHref: "/workspace",
    onAuthenticatedChange: (value) => fallbackStates.push(value),
    probe: async () => { throw new Error("offline"); },
    currentHref: () => "https://gimme-job.com/workspace",
    replace: () => {},
  });
  await tick();
  assert.deepEqual(fallbackStates, [true]);

  const cancelledStates: boolean[] = [];
  let resolveProbe!: (value: { ok: boolean }) => void;
  const cleanup = startAuthSync({
    mode: "public",
    personalHref: "/workspace",
    onAuthenticatedChange: (value) => cancelledStates.push(value),
    probe: () => new Promise((resolve) => { resolveProbe = resolve; }),
    currentHref: () => "https://gimme-job.com/",
    replace: () => {},
  });
  cleanup();
  resolveProbe({ ok: true });
  await tick();
  assert.deepEqual(cancelledStates, []);
});

test("auth control renders one explicit auth action instead of a view switcher", () => {
  const publicMarkup = renderToStaticMarkup(createElement(AuthStatusControl, { mode: "public", personalHref: "/workspace" }));
  assert.match(publicMarkup, /Public view/);
  assert.match(publicMarkup, />Sign in<\/a>/);
  assert.doesNotMatch(publicMarkup, /Personal<\/a>/);

  const personalMarkup = renderToStaticMarkup(createElement(AuthStatusControl, { mode: "personal", personalHref: "/workspace" }));
  assert.match(personalMarkup, /Signed in/);
  assert.match(personalMarkup, /Personal workspace/);
  assert.match(personalMarkup, /Log out/);
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
