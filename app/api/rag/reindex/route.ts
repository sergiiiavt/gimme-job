import { handleRagReindexRequest, type RagEnv } from "../../../../worker/rag";

async function runtimeEnv(): Promise<RagEnv> {
  return (await import("cloudflare:workers")).env as unknown as RagEnv;
}

export async function POST(request: Request) {
  return handleRagReindexRequest(request, await runtimeEnv());
}
