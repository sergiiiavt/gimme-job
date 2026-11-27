import { handlePublicSearch } from "../../../../worker/public-search";
import type { RagEnv } from "../../../../worker/rag";

export async function GET(request: Request) {
  const { env } = await import("cloudflare:workers");
  return handlePublicSearch(request, env as unknown as RagEnv);
}
