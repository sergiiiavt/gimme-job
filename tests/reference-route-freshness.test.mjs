import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobReferenceCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobReferenceCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

const context = { waitUntil() {}, passThroughOnException() {} };

function referenceEnv() {
  return {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "reference-test-password",
    DB: { prepare() { throw new Error("Public reference route must not query tenant storage."); } },
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

test("Python quick reference renders the humanized catalog and cannot be served from stale document cache", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("reference-freshness-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = referenceEnv();
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  Object.assign(cloudflareEnv, env);

  const response = await worker.fetch(new Request("https://gimmejob.example/reference/programming"), env, context);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");

  const html = await response.text();
  assert.match(html, /Mutability (?:&amp;|&) References/);
  assert.match(html, /Bind a name to an object/);
  assert.match(html, /Exit the nearest loop immediately/);
});
