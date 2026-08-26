import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobPublicAiCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobPublicAiCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

function fakeDb() {
  return {
    prepare() {
      const statement = {
        bind() { return statement; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { success: true }; },
      };
      return statement;
    },
  };
}

function envFor(db) {
  return {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "legacy-core-password",
    DB: db,
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

const context = { waitUntil() {}, passThroughOnException() {} };

test("built Worker allows only explicit ephemeral public interview progress", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("public-ai-core-gate-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const db = fakeDb();
  const env = envFor(db);

  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = db;
  cloudflareEnv.MULTI_USER_ENABLED = "true";

  const publicResponse = await worker.fetch(new Request("https://gimmejob.example/api/ai/interviews", {
    headers: { "x-gimmejob-session-scope": "ephemeral" },
  }), env, context);
  assert.equal(publicResponse.status, 200);
  assert.deepEqual(await publicResponse.json(), {
    persistent: false,
    recentSessions: [],
    areas: [],
  });

  const privateResponse = await worker.fetch(
    new Request("https://gimmejob.example/api/ai/interviews"),
    env,
    context,
  );
  assert.equal(privateResponse.status, 401);
  assert.deepEqual(await privateResponse.json(), { error: "Authentication required." });
});
