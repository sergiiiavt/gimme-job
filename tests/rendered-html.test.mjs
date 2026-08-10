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

  const privateResponse = await worker.fetch(new Request("https://gimmejob.example/workspace"), env, context);
  assert.equal(privateResponse.status, 303);
  assert.equal(privateResponse.headers.get("location"), "/workspace/login");

  const loginPage = await worker.fetch(new Request("https://gimmejob.example/workspace/login"), env, context);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Enter the password to manage vacancy statuses and feedback\./);

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

  const privateApiResponse = await worker.fetch(new Request("https://gimmejob.example/api/dashboard"), env, context);
  assert.equal(privateApiResponse.status, 401);
  assert.deepEqual(await privateApiResponse.json(), { error: "Authentication required." });

  const robotsResponse = await worker.fetch(new Request("https://gimmejob.example/robots.txt"), env, context);
  assert.equal(robotsResponse.status, 200);
  assert.match(await robotsResponse.text(), /Disallow: \/workspace/);
});
