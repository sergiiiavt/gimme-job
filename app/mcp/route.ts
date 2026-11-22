import { handleMcpRequest, type McpEnv } from "../../worker/mcp";
import { hasMcpServiceToken, mcpServiceAuthFailure } from "../../worker/mcp-auth";
import { withMcpTenant } from "../../worker/mcp-tenant";

type RuntimeEnv = McpEnv & {
  MCP_SERVICE_TOKEN?: string;
};

async function runtimeEnv(): Promise<RuntimeEnv> {
  return (await import("cloudflare:workers")).env as unknown as RuntimeEnv;
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
