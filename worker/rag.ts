import interviewCatalog from "../content/interview/catalog";
import learningRagSources from "../content/learning-rag-registry";
import pythonInterviewCatalog from "../content/python-interview/catalog";

type Json = Record<string, unknown>;
export type RagKind = "job" | "learning" | "question";
export type RagRetrievalMode = "vectorize" | "lexical-fallback";

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

export type RagSearchResult = {
  id: string;
  kind: RagKind;
  refId: string;
  title: string;
  text: string;
  score: number;
  sourcePath: string;
  route: string | null;
  metadata: Record<string, unknown>;
};

export type RagSearchResponse = {
  query: string;
  retrieval: RagRetrievalMode;
  embeddingModel: string;
  count: number;
  results: RagSearchResult[];
};

type AiEmbeddingResponse = { data?: number[][] };
type VectorizeQueryResponse = {
  matches?: Array<{ id?: string; score?: number; metadata?: Record<string, unknown> }>;
};

export type RagEnv = {
  DB: D1Database;
  AI?: { run(model: string, input: { text: string[] }): Promise<unknown> };
  RAG_INDEX?: {
    upsert(vectors: Array<{
      id: string;
      values: number[];
      metadata?: Record<string, string | number | boolean>;
    }>): Promise<unknown>;
    query(vector: number[], options: { topK: number; returnMetadata: "all" }): Promise<unknown>;
  };
};

const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const EMBEDDING_TEXT_LIMIT = 1_800;
const INDEX_BATCH_LIMIT = 32;
const SEARCH_TEXT_LIMIT = 6_000;
// Initial safety threshold. Offline retrieval evaluation should tune this against the
// Langfuse dataset rather than treating it as a permanent product constant.
const MIN_VECTOR_SCORE = 0.45;
const QUERY_TOKEN_RE = /[\p{L}\p{N}+#.-]+/gu;
const QUERY_STOP_WORDS = new Set([
  "a", "an", "and", "about", "do", "does", "explain", "for", "from", "give", "help", "how", "in", "is",
  "learn", "me", "need", "of", "path", "please", "show", "teach", "the", "to", "understand", "want", "what", "with",
  "вивчити", "допоможи", "мені", "навчи", "покажи", "поясни", "про", "стати", "хочу", "що", "як",
]);

const questionCatalogs: Array<{ key: string; route: string; track: string; questions: Json[] }> = [
  { key: "qa-interview", route: "/interview", track: "qa", questions: interviewCatalog.questions as unknown as Json[] },
  { key: "python-interview", route: "/interview/python", track: "python", questions: pythonInterviewCatalog.questions as unknown as Json[] },
];

function clean(value: unknown, max = 60_000): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

function compactText(parts: string[]): string {
  return parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, 12_000);
}

function compactVectorId(prefix: "j" | "l" | "q", source: string): string {
  let hash = 1469598103934665603n;
  const prime = 1099511628211n;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= BigInt(source.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `${prefix}:${hash.toString(16).padStart(16, "0")}`;
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
  for (const key of ["lessons", "chapters", "articles", "modules", "taxonomy", "topics", "cards"]) {
    if (Array.isArray(value[key]) && (value[key] as unknown[]).length) {
      return (value[key] as unknown[]).filter((item): item is Json => Boolean(item && typeof item === "object" && !Array.isArray(item)));
    }
  }
  return [];
}

function learningTitle(item: Json): string {
  return clean(item.title || item.label || item.name || item.id, 500) || "Learning material";
}

function markdownPlainText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function markdownSlug(value: string): string {
  return markdownPlainText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function markdownSections(markdown: string): Array<{ id: string; title: string; text: string }> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ id: string; title: string; text: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^##\s+(.+)$/);
    if (!heading) continue;
    let end = index + 1;
    while (end < lines.length && !/^##\s+/.test(lines[end])) end += 1;
    const title = markdownPlainText(heading[1]);
    const id = markdownSlug(heading[1]);
    const text = compactText([title, lines.slice(index + 1, end).join("\n")]);
    if (id && text) sections.push({ id, title, text });
    index = end - 1;
  }
  return sections;
}

function learningDocuments(): RagDocument[] {
  return learningRagSources.flatMap(({ key, route, track, value }) => catalogItems(value).flatMap((item, index) => {
    const status = clean(item.status, 100);
    if (status && status !== "published") return [];

    const refId = clean(item.id, 300) || `${key}-${index + 1}`;
    const title = learningTitle(item);
    const text = compactText([title, ...collectStrings(item)]);
    const topic = clean(item.moduleId || item.id, 300);
    const markdown = clean(item.markdown, 60_000);
    const lessonSection = !markdown && item.moduleId ? markdownSlug(clean(item.title, 500)) : "";
    const commonMetadata: Record<string, string | number | boolean> = {
      kind: "learning",
      refId,
      title: title.slice(0, 500),
      catalog: key,
      route,
      ...(topic ? { topic } : {}),
      ...(track ? { track } : {}),
      snippet: text.slice(0, 900),
    };

    const documents: RagDocument[] = [{
      id: compactVectorId("l", `${key}:${refId}${lessonSection ? `:${lessonSection}` : ""}`),
      kind: "learning",
      refId,
      title,
      text,
      metadata: {
        ...commonMetadata,
        ...(lessonSection ? { section: lessonSection } : {}),
      },
    }];

    for (const section of markdownSections(markdown)) {
      const sectionRefId = `${refId}#${section.id}`;
      const sectionText = compactText([title, section.title, section.text]);
      documents.push({
        id: compactVectorId("l", `${key}:${sectionRefId}`),
        kind: "learning",
        refId: sectionRefId,
        title: section.title,
        text: sectionText,
        metadata: {
          ...commonMetadata,
          refId: sectionRefId,
          title: section.title.slice(0, 500),
          section: section.id,
          snippet: sectionText.slice(0, 900),
        },
      });
    }

    return documents;
  }));
}

function questionDocuments(): RagDocument[] {
  return questionCatalogs.flatMap(({ key, route, track, questions }) => questions.map((question) => {
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
      id: compactVectorId("q", `${key}:${refId}`),
      kind: "question" as const,
      refId,
      title,
      text,
      metadata: {
        kind: "question",
        refId,
        title: title.slice(0, 500),
        catalog: key,
        track,
        category: clean(question.category, 300),
        prevalence: clean(question.prevalence, 100),
        route,
        snippet: text.slice(0, 900),
      },
    };
  }));
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
      id: compactVectorId("j", refId),
      kind: "job" as const,
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
        route: "/vacancies",
        updatedAt: clean(row.updated_at, 100),
        snippet: text.slice(0, 900),
      },
    };
  });
}

async function embed(env: RagEnv, texts: string[]): Promise<number[][]> {
  if (!env.AI) throw new Error("Workers AI binding is not configured.");
  const raw = await env.AI.run(EMBEDDING_MODEL, { text: texts.map((text) => text.slice(0, EMBEDDING_TEXT_LIMIT)) }) as AiEmbeddingResponse;
  if (!Array.isArray(raw.data) || raw.data.length !== texts.length) throw new Error("Workers AI returned an unexpected embedding response.");
  return raw.data;
}

export function ragAvailable(env: RagEnv): boolean {
  return Boolean(env.AI && env.RAG_INDEX);
}

export async function semanticSearch(env: RagEnv, query: string, kinds: RagKind[], limit = 10): Promise<RagMatch[]> {
  const text = query.trim();
  if (!text || !env.AI || !env.RAG_INDEX) return [];
  const [vector] = await embed(env, [text]);
  const topK = Math.min(50, Math.max(limit * 4, 20));
  const raw = await env.RAG_INDEX.query(vector, { topK, returnMetadata: "all" }) as VectorizeQueryResponse;
  const allowed = new Set(kinds);
  return (raw.matches ?? [])
    .filter((match) => allowed.has(clean(match.metadata?.kind) as RagKind))
    .map((match) => ({ id: clean(match.id), score: typeof match.score === "number" ? match.score : 0, metadata: match.metadata ?? {} }))
    .slice(0, Math.max(1, limit));
}

function trimTokenPunctuation(token: string): string {
  let start = 0;
  let end = token.length;
  while (start < end && (token[start] === "-" || token[start] === ".")) start += 1;
  while (end > start && (token[end - 1] === "-" || token[end - 1] === ".")) end -= 1;
  return token.slice(start, end);
}

function queryTokens(query: string): string[] {
  const raw = query.toLowerCase().match(QUERY_TOKEN_RE) ?? [];
  const unique = [...new Set(raw.map(trimTokenPunctuation).filter((token) => token.length >= 2))];
  const meaningful = unique.filter((token) => !QUERY_STOP_WORDS.has(token));
  return (meaningful.length ? meaningful : unique).slice(0, 24);
}

function lexicalDocumentScore(document: RagDocument, query: string): number | null {
  const tokens = queryTokens(query);
  if (!tokens.length) return null;
  const title = document.title.toLowerCase();
  const text = document.text.toLowerCase();
  const matched = tokens.filter((token) => title.includes(token) || text.includes(token));
  let minimumMatches = 1;
  if (tokens.length > 4) {
    minimumMatches = Math.min(3, Math.ceil(tokens.length / 4));
  } else if (tokens.length > 1) {
    minimumMatches = 2;
  }
  if (matched.length < minimumMatches) return null;
  const titleMatches = matched.filter((token) => title.includes(token)).length;
  const coverage = matched.length / tokens.length;
  const titleCoverage = titleMatches / tokens.length;
  const phrase = query.trim().toLowerCase();
  const phraseBonus = phrase && (title.includes(phrase) || text.includes(phrase)) ? 0.15 : 0;
  return Math.min(1, coverage * 0.65 + titleCoverage * 0.2 + phraseBonus);
}

async function documentsForKinds(env: RagEnv, kinds: RagKind[]): Promise<RagDocument[]> {
  const allowed = new Set(kinds);
  const documents = staticRagDocuments().filter((document) => allowed.has(document.kind));
  if (allowed.has("job")) documents.push(...await jobDocuments(env));
  return documents;
}

function sourcePath(document: RagDocument): string {
  const route = clean(document.metadata.route, 1_000);
  if (!route.startsWith("/") || route.startsWith("//")) return "/";
  if (document.kind !== "learning") return route;
  const params = new URLSearchParams();
  const topic = clean(document.metadata.topic, 300);
  const section = clean(document.metadata.section, 300);
  const track = clean(document.metadata.track, 300);
  if (topic) params.set("topic", topic);
  if (section) params.set("section", section);
  if (track) params.set("track", track);
  return params.size ? `${route}?${params.toString()}` : route;
}

function presentDocument(document: RagDocument, score: number, metadata: Record<string, unknown> = document.metadata): RagSearchResult {
  const route = clean(document.metadata.route, 1_000);
  return {
    id: document.id,
    kind: document.kind,
    refId: document.refId,
    title: document.title,
    text: document.text.slice(0, SEARCH_TEXT_LIMIT),
    score,
    sourcePath: sourcePath(document),
    route: route.startsWith("/") && !route.startsWith("//") ? route : null,
    metadata,
  };
}

function materializeSemanticResults(matches: RagMatch[], documents: RagDocument[], limit: number): RagSearchResult[] {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const results: RagSearchResult[] = [];
  for (const match of matches) {
    if (match.score < MIN_VECTOR_SCORE) continue;
    const document = byId.get(match.id);
    if (!document) continue;
    results.push(presentDocument(document, match.score, match.metadata));
    if (results.length >= limit) break;
  }
  return results;
}

function lexicalSearch(documents: RagDocument[], query: string, limit: number): RagSearchResult[] {
  return documents
    .map((document) => ({ document, score: lexicalDocumentScore(document, query) }))
    .filter((item): item is { document: RagDocument; score: number } => item.score !== null)
    .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title))
    .slice(0, limit)
    .map(({ document, score }) => presentDocument(document, score));
}

export async function searchRagDocuments(
  env: RagEnv,
  query: string,
  kinds: RagKind[] = ["learning", "question"],
  requestedLimit = 8,
): Promise<RagSearchResponse> {
  const normalizedQuery = query.trim().slice(0, 2_000);
  const limit = Math.max(1, Math.min(25, Math.trunc(requestedLimit) || 8));
  const normalizedKinds = [...new Set(kinds)].filter((kind): kind is RagKind => ["job", "learning", "question"].includes(kind));
  const selectedKinds = normalizedKinds.length ? normalizedKinds : ["learning", "question"];
  const documents = await documentsForKinds(env, selectedKinds);

  if (normalizedQuery && ragAvailable(env)) {
    try {
      const matches = await semanticSearch(env, normalizedQuery, selectedKinds, Math.min(50, limit * 3));
      const results = materializeSemanticResults(matches, documents, limit);
      if (results.length) {
        return { query: normalizedQuery, retrieval: "vectorize", embeddingModel: EMBEDDING_MODEL, count: results.length, results };
      }
    } catch {
      // One canonical pipeline owns degradation. Consumers never maintain their own fallback retrieval.
    }
  }

  const results = normalizedQuery ? lexicalSearch(documents, normalizedQuery, limit) : [];
  return { query: normalizedQuery, retrieval: "lexical-fallback", embeddingModel: EMBEDDING_MODEL, count: results.length, results };
}

export async function handleRagSearchRequest(request: Request, env: RagEnv): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
  let body: Json;
  try {
    body = await request.json() as Json;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const query = clean(body.query, 2_000);
  if (!query) return Response.json({ error: "query is required." }, { status: 400, headers: { "cache-control": "no-store" } });
  const rawKinds = Array.isArray(body.kinds) ? body.kinds.map((kind) => clean(kind, 30)) : ["learning", "question"];
  const kinds = rawKinds.filter((kind): kind is RagKind => ["job", "learning", "question"].includes(kind));
  if (!kinds.length || kinds.length !== rawKinds.length) {
    return Response.json({ error: "kinds must contain only job, learning, or question." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const limit = typeof body.limit === "number" && Number.isInteger(body.limit) ? body.limit : 8;
  if (limit < 1 || limit > 12) return Response.json({ error: "limit must be between 1 and 12." }, { status: 400, headers: { "cache-control": "no-store" } });
  try {
    const result = await searchRagDocuments(env, query, kinds, limit);
    return Response.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "RAG search failed." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export async function reindexRagBatch(
  env: RagEnv,
  cursor = 0,
  requestedLimit = INDEX_BATCH_LIMIT,
): Promise<{ indexed: number; total: number; nextCursor: number | null; counts: Record<RagKind, number> }> {
  if (!env.AI || !env.RAG_INDEX) throw new Error("RAG bindings are not configured.");
  const documents = [...staticRagDocuments(), ...await jobDocuments(env)];
  const start = Math.max(0, Math.trunc(cursor));
  const limit = Math.min(INDEX_BATCH_LIMIT, Math.max(1, Math.trunc(requestedLimit)));
  const batch = documents.slice(start, start + limit);
  if (batch.length) {
    const vectors = await embed(env, batch.map((document) => document.text));
    await env.RAG_INDEX.upsert(batch.map((document, index) => ({ id: document.id, values: vectors[index], metadata: document.metadata })));
  }
  const counts: Record<RagKind, number> = { job: 0, learning: 0, question: 0 };
  for (const document of documents) counts[document.kind] += 1;
  const nextCursor = start + batch.length < documents.length ? start + batch.length : null;
  return { indexed: batch.length, total: documents.length, nextCursor, counts };
}

export async function handleRagReindexRequest(request: Request, env: RagEnv): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
  if (!ragAvailable(env)) return Response.json({ ok: false, error: "RAG bindings are not configured." }, { status: 503, headers: { "cache-control": "no-store" } });
  let body: Json = {};
  try {
    body = await request.json() as Json;
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  try {
    const cursor = typeof body.cursor === "number" ? body.cursor : 0;
    const limit = typeof body.limit === "number" ? body.limit : INDEX_BATCH_LIMIT;
    const result = await reindexRagBatch(env, cursor, limit);
    return Response.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "RAG indexing failed." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
