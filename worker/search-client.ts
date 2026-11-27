import type { RagDocument } from "./rag";
import { protectedSearchTerms, searchCorpusRevision } from "./search-corpus";

export type SearchServiceEnv = { GIMMEJOB_AI_URL?: string; GIMMEJOB_AI_SERVICE_TOKEN?: string };
export type SearchCandidate = { id: string; score: number };
export type SearchServiceResult = { candidates: SearchCandidate[]; mode: "typesense" | "hybrid"; semanticAvailable: boolean; revision: string };

export async function searchService(
  env: SearchServiceEnv, documents: readonly RagDocument[], query: string,
  options: { semantic: boolean; kind?: string; language?: string; limit: number },
): Promise<SearchServiceResult | null> {
  if (!env.GIMMEJOB_AI_URL || !env.GIMMEJOB_AI_SERVICE_TOKEN) return null;
  try {
    const base = new URL(env.GIMMEJOB_AI_URL);
    if (base.protocol !== "https:" || base.username || base.password) return null;
    const revision = await searchCorpusRevision(documents);
    const response = await fetch(new URL("/v1/search", base), {
      method: "POST", headers: { authorization: `Bearer ${env.GIMMEJOB_AI_SERVICE_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ query, revision, ...options, technical: protectedSearchTerms(query) }),
      signal: AbortSignal.timeout(options.semantic ? 8_000 : 2_500),
    });
    if (!response.ok) return null;
    const result = await response.json() as SearchServiceResult;
    if (typeof result.semanticAvailable !== "boolean" || result.revision !== revision || !["typesense", "hybrid"].includes(result.mode) || !Array.isArray(result.candidates)) return null;
    result.candidates = result.candidates.slice(0, 60).filter((item) => typeof item.id === "string" && Number.isFinite(item.score) && item.score >= 0 && item.score <= 1);
    return result;
  } catch { return null; }
}
