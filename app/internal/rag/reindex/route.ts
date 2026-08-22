import { handleRagReindexRequest, type RagEnv } from "../../../../worker/rag";
import { hasMcpServiceToken, mcpServiceAuthFailure } from "../../../../worker/mcp-auth";

type RuntimeEnv = RagEnv & {
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
  return handleRagReindexRequest(request, env);
}
