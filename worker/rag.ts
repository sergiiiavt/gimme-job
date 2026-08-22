import interviewCatalog from "../content/interview/catalog";
import automationCurriculum from "../content/automation-learning/catalog";
import cloudDevopsCatalog from "../content/cloud-devops/catalog";
import metricsEstimationCatalog from "../content/metrics-estimation/catalog";
import pythonCurriculum from "../content/python-learning/catalog";
import qaFundamentalsCatalog from "../content/qa-fundamentals/catalog";
import testingToolsCatalog from "../content/testing-tools/catalog";

type Json = Record<string, unknown>;
type RagKind = "job" | "learning" | "question";

export type RagDocument = {
  id: string;
  kind: RagKind;
  refId: string;
  title: string;
  text: string;
  metadata: Record<string, string | number | boolean>;
};

export type RagMatch = {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
};

type AiEmbeddingResponse = {
  data?: number[][];
};

type VectorizeQueryResponse = {
  matches?: Array<{
    id?: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
};

export type RagEnv = {
  DB: D1Database;
  AI?: {
    run(model: string, input: { text: string[]; pooling?: string }): Promise<unknown>;
  };
  RAG_INDEX?: {
    upsert(vectors: Array<{
      id: string;
      values: number[];
      metadata?: Record<string, string | number | boolean>;
    }>): Promise<unknown>;
    query(vector: number[], options: {
      topK: number;
      returnMetadata: "all";
    }): Promise<unknown>;
  };
};

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const EMBEDDING_TEXT_LIMIT = 1_800;
const INDEX_BATCH_LIMIT = 32;

const learningCatalogs: Array<{
  key: string;
  route: string;
  value: unknown;
}> = [
  { key: "qa-fundamentals", route: "/reference/qa-fundamentals", value: qaFundamentalsCatalog },
  { key: "python", route: "/learn/programming", value: pythonCurriculum },
  { key: "automation", route: "/learn/automation", value: automationCurriculum },
  { key: "testing-tools", route: "/learn/testing-tools", value: testingToolsCatalog },
  { key: "cloud-devops", route: "/learn/cloud-devops", value: cloudDevopsCatalog },
  { key: "metrics-estimation", route: "/learn/metrics-estimation", value: metricsEstimationCatalog },
];

function clean(value: unknown, max = 60_000): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

function compactText(parts: string[]): string {
  return parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 12_000);
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1));
  if (typeof value !== "object") return [];

  const ignored = new Set(["sourceIds", "sources", "url", "href", "image", "images", "media"]);
  return Object.entries(value as Json)
    .filter(([key]) => !ignored.has(key))
    .flatMap(([, item]) => collectStrings(item, depth + 1));
}

function catalogItems(catalog: unknown): Json[] {
  if (!catalog || typeof catalog !== "object") return [];
  const value = catalog as Json;
  for (const key of ["lessons", "chapters", "articles", "modules", "taxonomy"]) {
    if (Array.isArray(value[key]) && (value[key] as unknown[]).length) {
      return (value[key] as unknown[]).filter((item): item is Json => Boolean(item && typeof item === "object" && !Array.isArray(item)));
    }
  }
  return [];
}

function learningTitle(item: Json): string {
  return clean(item.title || item.label || item.name || item.id, 500) || "Learning material";
}

function learningDocuments(): RagDocument[] {
  return learningCatalogs.flatMap(({ key, route, value }) => catalogItems(value).map((item, index) => {
    const refId = clean(item.id, 300) || `${key}-${index + 1}`;
    const title = learningTitle(item);
    const text = compactText([title, ...collectStrings(item)]);
    return {
      id: `learning:${key}:${refId}`,
      kind: "learning" as const,
      refId,
      title,
      text,
      metadata: {
        kind: "learning",
        refId,
        title: title.slice(0, 500),
        catalog: key,
        route,
        snippet: text.slice(0, 900),
      },
    };
  }));
}

function questionDocuments(): RagDocument[] {
  const questions = interviewCatalog.questions as unknown as Json[];
  return questions.map((question) => {
    const refId = clean(question.id, 300);
    const title = clean(question.question || question.title, 1_000) || refId;
    const text = compactText([
      title,
      clean(question.category, 500),
      clean(question.answer, 8_000),
      ...collectStrings(question.tags),
      ...collectStrings(question.signals),
      ...collectStrings(question.codeExamples),
    ]);
    return {
      id: `question:${refId}`,
      kind: "question",
      refId,
      title,
      text,
      metadata: {
        kind: "question",
        refId,
        title: title.slice(0, 500),
        category: clean(question.category, 300),
        prevalence: clean(question.prevalence, 100),
        snippet: text.slice(0, 900),
      },
    };
  });
}

let cachedStaticDocuments: RagDocument[] | null = null;

export function staticRagDocuments(): RagDocument[] {
  if (!cachedStaticDocuments) cachedStaticDocuments = [...questionDocuments(), ...learningDocuments()];
  return cachedStaticDocuments;
}

async function jobDocuments(env: RagEnv): Promise<RagDocument[]> {
  const result = await env.DB.prepare(`SELECT
      id, title, company, location, remote, url, description, salary_text, source, posted_at, updated_at
    FROM jobs ORDER BY id ASC`).all<Record<string, unknown>>();

  return result.results.map((row) => {
    const refId = clean(row.id, 300);
    const title = clean(row.title, 1_000) || refId;
    const text = compactText([
      title,
      clean(row.company, 500),
      clean(row.location, 500),
      clean(row.source, 300),
      clean(row.salary_text, 500),
      clean(row.description, 10_000),
    ]);
    return {
      id: `job:${refId}`,
      kind: "job",
      refId,
      title,
      text,
      metadata: {
        kind: "job",
        refId,
        title: title.slice(0, 500),
        company: clean(row.company, 500),
        location: clean(row.location, 500),
        source: clean(row.source, 300),
        remote: row.remote === 1 || row.remote === true,
        url: clean(row.url, 1_000),
        updatedAt: clean(row.updated_at, 100),
        snippet: text.slice(0, 900),
      },
    };
  });
}

async function embed(env: RagEnv, texts: string[]): Promise<number[][]> {
  if (!env.AI) throw new Error("Workers AI binding is not configured.");
  const raw = await env.AI.run(EMBEDDING_MODEL, {
    text: texts.map((text) => text.slice(0, EMBEDDING_TEXT_LIMIT)),
    pooling: "cls",
  }) as AiEmbeddingResponse;
  if (!Array.isArray(raw.data) || raw.data.length !== texts.length) {
    throw new Error("Workers AI returned an unexpected embedding response.");
  }
  return raw.data;
}

export function ragAvailable(env: RagEnv): boolean {
  return Boolean(env.AI && env.RAG_INDEX);
}

export async function semanticSearch(
  env: RagEnv,
  query: string,
  kinds: RagKind[],
  limit = 10,
): Promise<RagMatch[]> {
  const text = query.trim();
  if (!text || !env.AI || !env.RAG_INDEX) return [];

  const [vector] = await embed(env, [text]);
  const topK = Math.min(50, Math.max(limit * 4, 20));
  const raw = await env.RAG_INDEX.query(vector, { topK, returnMetadata: "all" }) as VectorizeQueryResponse;
  const allowed = new Set(kinds);
  return (raw.matches ?? [])
    .filter((match) => allowed.has(clean(match.metadata?.kind) as RagKind))
    .map((match) => ({
      id: clean(match.id),
      score: typeof match.score === "number" ? match.score : 0,
      metadata: match.metadata ?? {},
    }))
    .slice(0, Math.max(1, limit));
}

export async function reindexRagBatch(
  env: RagEnv,
  cursor = 0,
  requestedLimit = INDEX_BATCH_LIMIT,
): Promise<{
  indexed: number;
  total: number;
  nextCursor: number | null;
  counts: Record<RagKind, number>;
}> {
  if (!env.AI || !env.RAG_INDEX) throw new Error("RAG bindings are not configured.");
  const documents = [...staticRagDocuments(), ...await jobDocuments(env)];
  const start = Math.max(0, Math.trunc(cursor));
  const limit = Math.min(INDEX_BATCH_LIMIT, Math.max(1, Math.trunc(requestedLimit)));
  const batch = documents.slice(start, start + limit);

  if (batch.length) {
    const vectors = await embed(env, batch.map((document) => document.text));
    await env.RAG_INDEX.upsert(batch.map((document, index) => ({
      id: document.id,
      values: vectors[index],
      metadata: document.metadata,
    })));
  }

  const counts: Record<RagKind, number> = { job: 0, learning: 0, question: 0 };
  for (const document of documents) counts[document.kind] += 1;
  const nextCursor = start + batch.length < documents.length ? start + batch.length : null;
  return { indexed: batch.length, total: documents.length, nextCursor, counts };
}

export async function handleRagReindexRequest(request: Request, env: RagEnv): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    });
  }
  if (!ragAvailable(env)) {
    return Response.json(
      { ok: false, error: "RAG bindings are not configured." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let body: Json = {};
  try {
    body = await request.json() as Json;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;
    const limit = typeof body.limit === "number" ? body.limit : INDEX_BATCH_LIMIT;
    const result = await reindexRagBatch(env, cursor, limit);
    return Response.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "RAG indexing failed." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
