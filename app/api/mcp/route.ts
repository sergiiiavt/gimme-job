import { handleMcpRequest, type McpEnv } from "../../../worker/mcp";

async function runtimeEnv(): Promise<McpEnv> {
  return (await import("cloudflare:workers")).env as unknown as McpEnv;
}

export async function POST(request: Request) {
  return handleMcpRequest(request, await runtimeEnv());
}

export async function OPTIONS(request: Request) {
  return handleMcpRequest(request, await runtimeEnv());
}
