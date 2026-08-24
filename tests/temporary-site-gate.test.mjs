import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobCloudflareEnv;")}`;
globalThis.__gimmejobCloudflareEnv = {};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return { shortCircuit: true, url: cloudflareWorkersModule };
    }
    return nextResolve(specifier, context);
  },
});

async function loadWorker(name) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(name, `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const context = { waitUntil() {}, passThroughOnException() {} };
const env = {
  APP_PASSWORD: "0123456789abcdef",
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

test("shows the temporary login gate on the production site", async () => {
  const worker = await loadWorker("temporary-site-gate-page");
  const response = await worker.fetch(new Request("https://gimme-job.com/"), env, context);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");

  const html = await response.text();
  assert.match(html, /background:#000/);
  assert.match(html, /name="login"/);
  assert.match(html, /name="password"/);
  assert.match(html, /action="\/_site-gate\?next=%2F"/);
  assert.doesNotMatch(html, /register|create account/i);
  assert.doesNotMatch(html, /Why I created this site/);
});

test("preserves a requested page across the temporary login gate", async () => {
  const worker = await loadWorker("temporary-site-gate-deep-link");
  const response = await worker.fetch(new Request("https://gimme-job.com/interview?topic=sql"), env, context);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /action="\/_site-gate\?next=%2Finterview%3Ftopic%3Dsql"/);
});

test("rejects incorrect temporary site credentials", async () => {
  const worker = await loadWorker("temporary-site-gate-invalid");

  for (const credentials of [
    { login: "wrong", password: env.APP_PASSWORD },
    { login: "gimmejob", password: "wrong-password" },
  ]) {
    const response = await worker.fetch(
      new Request("https://gimme-job.com/_site-gate?next=%2F", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(credentials),
      }),
      env,
      context,
    );

    assert.equal(response.status, 401);
    assert.match(await response.text(), /Invalid login or password\./);
  }
});

test("sets a signed session and opens the site after valid temporary credentials", async () => {
  const worker = await loadWorker("temporary-site-gate-success");
  const loginResponse = await worker.fetch(
    new Request("https://gimme-job.com/_site-gate?next=%2F", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ login: "gimmejob", password: env.APP_PASSWORD }),
    }),
    env,
    context,
  );

  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get("location"), "/");
  const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  assert.match(cookie, /^gimmejob_site_gate=/);

  const siteResponse = await worker.fetch(
    new Request("https://gimme-job.com/", { headers: { cookie } }),
    env,
    context,
  );
  assert.equal(siteResponse.status, 200);
  const html = await siteResponse.text();
  assert.match(html, /Why I created this site/);
  assert.doesNotMatch(html, /name="login"/);
});

test("does not apply the temporary gate outside the production hostname", async () => {
  const worker = await loadWorker("temporary-site-gate-hostname");
  const response = await worker.fetch(new Request("https://gimmejob.example/"), env, context);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Why I created this site/);
});

test("keeps production health and static deployment checks outside the temporary gate", async () => {
  const worker = await loadWorker("temporary-site-gate-exemptions");

  const healthResponse = await worker.fetch(new Request("https://gimme-job.com/api/health"), env, context);
  assert.doesNotMatch(await healthResponse.text(), /name="login"/);

  const logoResponse = await worker.fetch(new Request("https://gimme-job.com/gimmejob-logo.png"), env, context);
  assert.doesNotMatch(await logoResponse.text(), /name="login"/);
});
