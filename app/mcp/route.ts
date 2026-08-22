import { handleMcpRequest, type McpEnv } from "../../worker/mcp";
import { hasMcpServiceToken, mcpServiceAuthFailure } from "../../worker/mcp-auth";

type RuntimeEnv = McpEnv & {
  MCP_SERVICE_TOKEN?: string;
};

type UserRow = {
  id: string;
  email: string;
};

async function runtimeEnv(): Promise<RuntimeEnv> {
  return (await import("cloudflare:workers")).env as unknown as RuntimeEnv;
}

async function withMcpTenant(request: Request, env: RuntimeEnv): Promise<Request | Response> {
  if (request.headers.get("x-gimmejob-auth-mode") !== "multi-user") return request;
  if (request.headers.get("x-gimmejob-user-id")) return request;

  const requestedEmail = request.headers.get("x-gimmejob-mcp-user-email")?.trim().toLowerCase() ?? "";
  let user: UserRow | null = null;
  if (requestedEmail) {
    user = await env.DB.prepare("SELECT id, email FROM users WHERE lower(email) = ? LIMIT 1")
      .bind(requestedEmail)
      .first<UserRow>();
    if (!user) {
      return Response.json(
        { error: "The configured MCP user email does not match a GimmeJob account." },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }
  } else {
    const result = await env.DB.prepare("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 2").all<UserRow>();
    if (result.results.length !== 1) {
      return Response.json(
        { error: "Set GIMMEJOB_MCP_USER_EMAIL when the site has zero or multiple user accounts." },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }
    user = result.results[0];
  }

  const headers = new Headers(request.headers);
  headers.set("x-gimmejob-user-id", user.id);
  headers.set("x-gimmejob-authenticated", "1");
  return new Request(request, { headers });
}

export async function POST(request: Request) {
  const env = await runtimeEnv();
  if (!hasMcpServiceToken(request, env.MCP_SERVICE_TOKEN)) {
    return mcpServiceAuthFailure(Boolean(env.MCP_SERVICE_TOKEN));
  }
  const scopedRequest = await withMcpTenant(request, env);
  if (scopedRequest instanceof Response) return scopedRequest;
  return handleMcpRequest(scopedRequest, env);
}
