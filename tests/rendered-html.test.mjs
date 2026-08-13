import assert from "node:assert/strict";
import test from "node:test";

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
