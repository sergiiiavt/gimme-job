import type { McpEnv } from "./mcp";

type UserRow = {
  id: string;
  email: string;
};

function tenantSelectionFailure(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Resolves which GimmeJob account an authenticated MCP service call acts for in multi-user mode
 * and returns a request that carries that tenant identity.
 *
 * vinext hands route handlers a Proxy around NextRequest, which `new Request(request, init)`
 * cannot clone in workerd or undici, so the scoped request is rebuilt from its parts.
 */
export async function withMcpTenant(request: Request, env: Pick<McpEnv, "DB">): Promise<Request | Response> {
  if (request.headers.get("x-gimmejob-auth-mode") !== "multi-user") return request;
  if (request.headers.get("x-gimmejob-user-id")) return request;

  const requestedEmail = request.headers.get("x-gimmejob-mcp-user-email")?.trim().toLowerCase() ?? "";
  let user: UserRow | null = null;
  if (requestedEmail) {
    user = await env.DB.prepare("SELECT id, email FROM users WHERE lower(email) = ? LIMIT 1")
      .bind(requestedEmail)
      .first<UserRow>();
    if (!user) return tenantSelectionFailure("The configured MCP user email does not match a GimmeJob account.", 404);
  } else {
    const result = await env.DB.prepare("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 2").all<UserRow>();
    if (result.results.length !== 1) {
      return tenantSelectionFailure("Set GIMMEJOB_MCP_USER_EMAIL when the site has zero or multiple user accounts.", 409);
    }
    user = result.results[0];
  }

  const headers = new Headers(request.headers);
  headers.set("x-gimmejob-user-id", user.id);
  headers.set("x-gimmejob-authenticated", "1");
  return new Request(request.url, { method: request.method, headers, body: await request.arrayBuffer() });
}
