import { hasRagServiceToken, ragServiceAuthFailure } from "../../../../worker/rag-auth";
import { handleRagSearchRequest, type RagEnv } from "../../../../worker/rag";

type RuntimeEnv = RagEnv & {
  GIMMEJOB_RAG_SERVICE_TOKEN?: string;
};

async function runtimeEnv(): Promise<RuntimeEnv> {
  return (await import("cloudflare:workers")).env as unknown as RuntimeEnv;
}

export async function POST(request: Request) {
  const env = await runtimeEnv();
  if (!hasRagServiceToken(request, env.GIMMEJOB_RAG_SERVICE_TOKEN)) {
    return ragServiceAuthFailure(Boolean(env.GIMMEJOB_RAG_SERVICE_TOKEN));
  }
  return handleRagSearchRequest(request, env);
}
