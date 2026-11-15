import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobMcpRouteCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobMcpRouteCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

const MCP_TOKEN = "mcp-route-test-token-0123456789abcdef";
const USERS = [
  { id: "user-a", email: "a@example.test" },
  { id: "user-b", email: "b@example.test" },
];

function fakeTenantDb(users) {
  const state = { progressUserIds: [] };
  const db = {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, " ").trim();
      const statement = {
        params: [],
        bind(...values) { statement.params = values; return statement; },
        async first() {
          if (text.startsWith("SELECT id, email FROM users WHERE lower(email) = ?")) {
            return users.find((user) => user.email === statement.params[0]) ?? null;
          }
          return null;
        },
        async all() {
          if (text.startsWith("SELECT id, email FROM users ORDER BY created_at")) return { results: users.slice(0, 2) };
          if (text.includes("FROM user_interview_progress")) state.progressUserIds.push(String(statement.params[0]));
          return { results: [] };
        },
        async run() { return { success: true }; },
      };
      return statement;
    },
  };
  return { db, state };
}

async function loadWorker(users) {
  const { db, state } = fakeTenantDb(users);
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  Object.assign(cloudflareEnv, {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "legacy-password-must-not-authorize-mcp",
    MCP_SERVICE_TOKEN: MCP_TOKEN,
    DB: db,
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  });
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("mcp-route-tenant-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return { worker, env: cloudflareEnv, state };
}

const context = { waitUntil() {}, passThroughOnException() {} };

function mcpRequest(message, { email } = {}) {
  return new Request("https://gimmejob.example/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-gimmejob-mcp-token": MCP_TOKEN,
      ...(email ? { "x-gimmejob-mcp-user-email": email } : {}),
    },
    body: JSON.stringify(message),
  });
}

const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } };

test("MCP route resolves the selected account through the real vinext route handler", async () => {
  const { worker, env, state } = await loadWorker(USERS);

  const initialized = await worker.fetch(mcpRequest(initialize, { email: "B@Example.test" }), env, context);
  assert.equal(initialized.status, 200);
  assert.equal((await initialized.json()).result.serverInfo.name, "gimmejob");

  const progress = await worker.fetch(mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "get_learning_progress", arguments: {} },
  }, { email: "b@example.test" }), env, context);
  assert.equal(progress.status, 200);
  assert.equal((await progress.json()).result.isError, false);
  assert.deepEqual(state.progressUserIds, ["user-b"]);
});
