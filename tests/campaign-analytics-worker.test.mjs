import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobCampaignCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobCampaignCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

const BROWSER_UA = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 Telegram-Android/12.0";

function harness() {
  const points = [];
  const pending = [];
  const env = {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "campaign-test-password",
    DB: { prepare() { throw new Error("A public reference page must not query tenant storage."); } },
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    CAMPAIGN_ANALYTICS: { writeDataPoint(point) { points.push(point); } },
  };
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  Object.assign(cloudflareEnv, env);
  const context = { waitUntil(promise) { pending.push(promise); }, passThroughOnException() {} };
  return { env, context, points, settled: () => Promise.all(pending) };
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("campaign-analytics-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const get = (path) => new Request(`https://gimme-job.com${path}`, { headers: { "user-agent": BROWSER_UA, referer: "https://t.me/" } });

test("built Worker counts a page opened from a tagged link and leaves the page unchanged", async () => {
  const worker = await loadWorker();
  const { env, context, points, settled } = harness();

  const response = await worker.fetch(get("/reference/programming?utm_source=telegram&utm_medium=organic_social&utm_campaign=tg_daily&utm_content=q_042"), env, context);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await response.text(), /Mutability (?:&amp;|&) References/);
  await settled();

  assert.deepEqual(points, [{
    indexes: ["telegram"],
    blobs: ["telegram", "organic_social", "tg_daily", "q_042", "/reference/programming", "", "t.me", "page"],
  }]);
});

test("built Worker does not count an untagged page", async () => {
  const worker = await loadWorker();
  const { env, context, points, settled } = harness();

  const response = await worker.fetch(get("/reference/programming"), env, context);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
  await settled();

  assert.deepEqual(points, []);
});

test("built Worker counts a tagged home-page visit once", async () => {
  const worker = await loadWorker();
  const { env, context, points, settled } = harness();

  const response = await worker.fetch(get("/?utm_source=instagram&utm_medium=organic_social&utm_campaign=profile&utm_content=bio"), env, context);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  await response.arrayBuffer();
  await settled();

  assert.equal(points.length, 1);
  assert.deepEqual(points[0].blobs.slice(0, 5), ["instagram", "organic_social", "profile", "bio", "/"]);
});

test("built Worker counts a redirected tagged link once, on the page it lands on", async () => {
  const worker = await loadWorker();
  const { env, context, points, settled } = harness();

  const hop = await worker.fetch(get("/uk?utm_source=threads&utm_medium=organic_social&utm_campaign=profile&utm_content=bio"), env, context);
  assert.ok(hop.status >= 300 && hop.status < 400, `expected a redirect, got ${hop.status}`);
  const landing = new URL(hop.headers.get("location") ?? "", "https://gimme-job.com");
  assert.equal(landing.pathname, "/uk/interview");
  await hop.arrayBuffer();
  await settled();
  assert.deepEqual(points, [], "the redirect hop itself must not be counted");

  // The browser follows the redirect; the landing page is counted with the original tags.
  const page = await worker.fetch(get(`${landing.pathname}${landing.search}`), env, context);
  assert.equal(page.status, 200);
  await page.arrayBuffer();
  await settled();
  assert.equal(points.length, 1);
  assert.deepEqual(points[0].blobs.slice(0, 5), ["threads", "organic_social", "profile", "bio", "/uk/interview"]);
});

test("built Worker serves /go short links before the app and counts the click", async () => {
  const worker = await loadWorker();
  const { env, context, points, settled } = harness();

  const response = await worker.fetch(get("/go/dou"), env, context);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://gimme-job.com/uk/interview?utm_source=dou&utm_medium=community&utm_campaign=dou_resource");
  assert.ok(response.headers.get("content-security-policy"), "short links keep the baseline security headers");

  const unknown = await worker.fetch(get("/go/not-a-campaign"), env, context);
  assert.equal(unknown.status, 404);
  await settled();

  assert.deepEqual(points.map((point) => point.blobs.at(-1)), ["go"]);
  assert.equal(points[0].blobs[4], "/go/dou");
});
