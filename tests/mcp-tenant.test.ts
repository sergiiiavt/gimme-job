import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

register();

const { withMcpTenant } = await import("../worker/mcp-tenant.ts");

type User = { id: string; email: string };

function tenantEnv(users: User[]) {
  const DB = {
    prepare(sql: string) {
      const statement = {
        params: [] as unknown[],
        bind(...values: unknown[]) { statement.params = values; return statement; },
        async first() {
          if (!sql.startsWith("SELECT id, email FROM users WHERE lower(email) = ?")) return null;
          return users.find((user) => user.email === statement.params[0]) ?? null;
        },
        async all() {
          return { results: sql.startsWith("SELECT id, email FROM users ORDER BY created_at") ? users.slice(0, 2) : [] };
        },
      };
      return statement;
    },
  };
  return { DB } as never;
}

const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" });

function mcpRequest(headers: Record<string, string> = {}) {
  return new Request("https://gimmejob.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-gimmejob-auth-mode": "multi-user", ...headers },
    body,
  });
}

// vinext passes route handlers a Proxy around NextRequest rather than a plain Request.
function vinextLikeRequest(request: Request): Request {
  return new Proxy(request, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("MCP tenant selection rebuilds a vinext Proxy request for the selected account", async () => {
  const users = [{ id: "user-a", email: "a@example.test" }, { id: "user-b", email: "b@example.test" }];
  const scoped = await withMcpTenant(
    vinextLikeRequest(mcpRequest({ "x-gimmejob-mcp-user-email": " B@Example.TEST ", "x-gimmejob-mcp-token": "service-token" })),
    tenantEnv(users),
  );

  assert.ok(scoped instanceof Request);
  assert.equal(scoped.url, "https://gimmejob.example/mcp");
  assert.equal(scoped.method, "POST");
  assert.equal(scoped.headers.get("x-gimmejob-user-id"), "user-b");
  assert.equal(scoped.headers.get("x-gimmejob-authenticated"), "1");
  assert.equal(scoped.headers.get("x-gimmejob-mcp-token"), "service-token");
  assert.equal(await scoped.text(), body);
});

test("MCP tenant selection auto-selects a single account and rejects unknown or ambiguous selection", async () => {
  const onlyUser = await withMcpTenant(vinextLikeRequest(mcpRequest()), tenantEnv([{ id: "solo", email: "solo@example.test" }]));
  assert.ok(onlyUser instanceof Request);
  assert.equal(onlyUser.headers.get("x-gimmejob-user-id"), "solo");

  const twoUsers = tenantEnv([{ id: "user-a", email: "a@example.test" }, { id: "user-b", email: "b@example.test" }]);
  const ambiguous = await withMcpTenant(mcpRequest(), twoUsers);
  assert.ok(ambiguous instanceof Response);
  assert.equal(ambiguous.status, 409);
  assert.equal(ambiguous.headers.get("cache-control"), "no-store");

  const noUsers = await withMcpTenant(mcpRequest(), tenantEnv([]));
  assert.ok(noUsers instanceof Response);
  assert.equal(noUsers.status, 409);

  const unknown = await withMcpTenant(mcpRequest({ "x-gimmejob-mcp-user-email": "missing@example.test" }), twoUsers);
  assert.ok(unknown instanceof Response);
  assert.equal(unknown.status, 404);
  assert.match((await unknown.json()).error, /does not match a GimmeJob account/);
});

test("MCP tenant selection leaves single-user and already-scoped requests untouched", async () => {
  const env = tenantEnv([]);
  const singleUser = new Request("https://gimmejob.example/mcp", { method: "POST", body });
  assert.equal(await withMcpTenant(singleUser, env), singleUser);

  const alreadyScoped = mcpRequest({ "x-gimmejob-user-id": "user-a" });
  assert.equal(await withMcpTenant(alreadyScoped, env), alreadyScoped);
});
