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
const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};

function mcpRequest(message, { email, token = MCP_TOKEN } = {}) {
  const toolName = message.method === "tools/call" ? message.params?.name : undefined;
  return new Request("https://gimmejob.example/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": message.method,
      ...(toolName ? { "mcp-name": toolName } : {}),
      ...(token ? { "x-gimmejob-mcp-token": token } : {}),
      ...(email ? { "x-gimmejob-mcp-user-email": email } : {}),
    },
    body: JSON.stringify({ ...message, params: { ...message.params, _meta: META } }),
  });
}

const discover = { jsonrpc: "2.0", id: 1, method: "server/discover", params: {} };

test("MCP route resolves the selected account through the real vinext route handler", async () => {
  const { worker, env, state } = await loadWorker(USERS);

  const discovered = await worker.fetch(mcpRequest(discover, { email: "B@Example.test" }), env, context);
  assert.equal(discovered.status, 200);
  const discovery = (await discovered.json()).result;
  assert.deepEqual(discovery.supportedVersions, ["2026-07-28"]);
  assert.equal(discovery._meta["io.modelcontextprotocol/serverInfo"].name, "gimmejob");

  const progress = await worker.fetch(mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "get_learning_progress", arguments: {} },
  }, { email: "b@example.test" }), env, context);
  assert.equal(progress.status, 200);
  const result = (await progress.json()).result;
  assert.equal(result.resultType, "complete");
  assert.equal(result.isError, false);
  assert.deepEqual(state.progressUserIds, ["user-b"]);
});

test("MCP route keeps rejecting calls without the service token and refuses non-POST methods", async () => {
  const { worker, env, state } = await loadWorker(USERS);

  const anonymous = await worker.fetch(mcpRequest(discover, { token: "" }), env, context);
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await anonymous.json(), { error: "MCP service authentication required." });

  const get = await worker.fetch(new Request("https://gimmejob.example/mcp", { headers: { accept: "text/event-stream" } }), env, context);
  assert.equal(get.status, 405);
  assert.deepEqual(state.progressUserIds, []);
});
