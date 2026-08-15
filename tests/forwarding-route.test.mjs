import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobForwardingRouteEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobForwardingRouteEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

const routeUrl = new URL("../app/auth/forwarding/route.ts", import.meta.url);
routeUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { GET } = await import(routeUrl.href);

function fakeDb() {
  const db = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, " ").trim();
      const statement = {
        values: [],
        bind(...values) { statement.values = values; return statement; },
        async first() {
          if (text.includes("FROM user_sessions s") && text.includes("INNER JOIN users u")) {
            return {
              user_id: "user-a",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
              google_sub: "local:user-a",
              email: "a@example.com",
              name: null,
              picture_url: null,
            };
          }
          if (text.startsWith("SELECT token FROM email_ingest_aliases")) return { token: "abc123def456" };
          return null;
        },
        async run() { return { success: true }; },
      };
      return statement;
    },
  };
  return db;
}

test("forwarding endpoint requires an authenticated session", async () => {
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = fakeDb();
  cloudflareEnv.MULTI_USER_ENABLED = "true";
  const response = await GET(new Request("https://gimme-job.com/auth/forwarding"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("forwarding endpoint returns only the current user's private address", async () => {
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  cloudflareEnv.DB = fakeDb();
  cloudflareEnv.MULTI_USER_ENABLED = "true";
  const response = await GET(new Request("https://gimme-job.com/auth/forwarding", {
    headers: { cookie: "gimmejob_user_session=session-token" },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { address: "jobs+abc123def456@gimme-job.com" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
});
