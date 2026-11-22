import { z } from "zod";
import interviewCatalog from "../content/interview/catalog";
import pythonInterviewCatalog from "../content/python-interview/catalog";
import { analyzeJobsForUser } from "../app/api/_job-actions";
import { type RagEnv, type RagSearchResult, searchRagDocuments } from "./rag";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;

type RequestContext = { multiUser: boolean; userId: string | null };

export type McpEnv = RagEnv & { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };

const SearchJobsInput = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(25).default(10),
  remote: z.boolean().optional(),
  source: z.string().trim().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(100).optional(),
}).strict();
const InterviewQuestionsInput = z.object({
  query: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(25).default(10),
  category: z.string().trim().min(1).max(200).optional(),
  prevalence: z.string().trim().min(1).max(100).optional(),
}).strict();
const LearningProgressInput = z.object({
  query: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(15).default(5),
}).strict();
const AnalyzeVacancyInput = z.object({
  job_id: z.string().trim().min(1).max(300),
  preparation_limit: z.number().int().min(1).max(10).default(5),
}).strict();

export const MCP_TOOL_NAMES = ["search_jobs", "get_interview_questions", "get_learning_progress", "analyze_vacancy"] as const;
export const MCP_TOOLS = [
  {
    name: "search_jobs",
    description: "Search GimmeJob vacancies through the canonical RAG pipeline, with optional source, status, and remote filters.",
    inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: {
      query: { type: "string", minLength: 1, maxLength: 500, description: "Natural-language vacancy search." },
      limit: { type: "integer", minimum: 1, maximum: 25, default: 10 }, remote: { type: "boolean" },
      source: { type: "string", minLength: 1, maxLength: 100 }, status: { type: "string", minLength: 1, maxLength: 100 },
    } },
  },
  {
    name: "get_interview_questions",
    description: "Find QA and Python interview questions from the canonical Git-backed catalogs through the shared RAG pipeline and catalog filters.",
    inputSchema: { type: "object", additionalProperties: false, properties: {
      query: { type: "string", maxLength: 500, description: "Natural-language topic or interview intent." },
      limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
      category: { type: "string", minLength: 1, maxLength: 200 }, prevalence: { type: "string", minLength: 1, maxLength: 100 },
    } },
  },
  {
    name: "get_learning_progress",
    description: "Read private persisted interview-learning progress and optionally retrieve relevant learning materials through canonical RAG.",
    inputSchema: { type: "object", additionalProperties: false, properties: {
      query: { type: "string", maxLength: 500, description: "Optional learning topic for recommended material retrieval." },
      limit: { type: "integer", minimum: 1, maximum: 15, default: 5 },
    } },
  },
  {
    name: "analyze_vacancy",
    description: "Analyze one stored GimmeJob vacancy and return canonical-RAG interview and learning preparation.",
    inputSchema: { type: "object", additionalProperties: false, required: ["job_id"], properties: {
      job_id: { type: "string", minLength: 1, maxLength: 300 }, preparation_limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
    } },
  },
] as const;

function clean(value: unknown, max = 60_000): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}
function parseJson(value: unknown, fallback: Json = {}): Json {
  if (typeof value !== "string") return value && typeof value === "object" && !Array.isArray(value) ? value as Json : fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Json : fallback;
  } catch { return fallback; }
}
function requestContext(request: Request): RequestContext {
  const multiUser = request.headers.get("x-gimmejob-auth-mode") === "multi-user";
  const userId = request.headers.get("x-gimmejob-user-id")?.trim() || null;
  if (multiUser && !userId) throw new Error("Authenticated tenant identity is required.");
  return { multiUser, userId };
}
function statusText(row: Row): string { return clean(row.tracked_status || row.status || "NEW", 100).toUpperCase() || "NEW"; }

function mapJob(row: Row, result?: RagSearchResult, retrieval?: string) {
  return {
    id: clean(row.id, 300), title: clean(row.title, 1_000), company: clean(row.company, 500), location: clean(row.location, 500),
    remote: row.remote === 1 || row.remote === true, source: clean(row.source, 200), status: statusText(row),
    salaryText: clean(row.salary_text, 500) || null, postedAt: clean(row.posted_at, 100) || null,
    discoveredAt: clean(row.discovered_at, 100) || null, url: clean(row.url, 2_000), description: clean(row.description, 4_000),
    retrievalScore: result?.score ?? null, semanticScore: retrieval === "vectorize" ? result?.score ?? null : null,
  };
}

async function loadJobs(env: McpEnv, context: RequestContext, ids?: string[]): Promise<Row[]> {
  const idFilter = ids?.length ? `WHERE j.id IN (${ids.map(() => "?").join(", ")})` : "";
  if (context.multiUser && context.userId) {
    const result = await env.DB.prepare(`SELECT j.*, COALESCE(t.status, 'NEW') AS tracked_status
      FROM jobs AS j LEFT JOIN job_tracking AS t ON t.job_id = j.id AND t.user_id = ? ${idFilter}
      ORDER BY j.discovered_at DESC LIMIT 500`).bind(context.userId, ...(ids ?? [])).all<Row>();
    return result.results;
  }
  const result = await env.DB.prepare(`SELECT j.*, j.status AS tracked_status FROM jobs AS j ${idFilter}
    ORDER BY j.discovered_at DESC LIMIT 500`).bind(...(ids ?? [])).all<Row>();
  return result.results;
}

async function searchJobs(env: McpEnv, request: Request, raw: unknown) {
  const input = SearchJobsInput.parse(raw ?? {});
  const context = requestContext(request);
  const rag = await searchRagDocuments(env, input.query, ["job"], input.limit);
  const ids = rag.results.map((result) => result.refId).filter(Boolean);
  const resultById = new Map(rag.results.map((result) => [result.refId, result]));
  const rows = ids.length ? await loadJobs(env, context, ids) : [];
  const rank = new Map(ids.map((id, index) => [id, index]));
  rows.sort((left, right) => (rank.get(clean(left.id)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(clean(right.id)) ?? Number.MAX_SAFE_INTEGER));
  const sourceNeedle = input.source?.toLowerCase();
  const statusNeedle = input.status?.toUpperCase();
  const filtered = rows.filter((row) => {
    if (input.remote !== undefined && (row.remote === 1 || row.remote === true) !== input.remote) return false;
    if (sourceNeedle && clean(row.source).toLowerCase() !== sourceNeedle) return false;
    if (statusNeedle && statusText(row) !== statusNeedle) return false;
    return true;
  }).slice(0, input.limit);
  return { query: input.query, retrieval: rag.retrieval, embeddingModel: rag.embeddingModel, count: filtered.length,
    jobs: filtered.map((row) => mapJob(row, resultById.get(clean(row.id)), rag.retrieval)) };
}

const qaQuestions = interviewCatalog.questions as unknown as Json[];
const pythonQuestions = pythonInterviewCatalog.questions as unknown as Json[];
const qaQuestionById = new Map(qaQuestions.map((question) => [clean(question.id), question]));
const pythonQuestionById = new Map(pythonQuestions.map((question) => [clean(question.id), question]));

function questionForResult(result: RagSearchResult): { question: Json; track: "qa" | "python" } | null {
  const track = clean(result.metadata.track, 20);
  if (track === "python") {
    const question = pythonQuestionById.get(result.refId);
    return question ? { question, track: "python" } : null;
  }
  const question = qaQuestionById.get(result.refId);
  return question ? { question, track: "qa" } : null;
}
function questionByAnyId(id: string): Json | undefined { return qaQuestionById.get(id) ?? pythonQuestionById.get(id); }
function presentQuestion(question: Json, track: "qa" | "python", result?: RagSearchResult, retrieval?: string) {
  return {
    id: clean(question.id, 300), track, question: clean(question.question || question.title, 2_000), answer: clean(question.answer, 8_000),
    category: clean(question.category, 300), kind: clean(question.kind, 100) || null, prevalence: clean(question.prevalence, 100) || null,
    tags: Array.isArray(question.tags) ? question.tags.map((tag) => clean(tag, 100)).filter(Boolean) : [],
    retrievalScore: result?.score ?? null, semanticScore: retrieval === "vectorize" ? result?.score ?? null : null,
  };
}

type MatchedQuestion = { question: Json; track: "qa" | "python"; result?: RagSearchResult };

async function getInterviewQuestions(env: McpEnv, raw: unknown) {
  const input = InterviewQuestionsInput.parse(raw ?? {});
  const query = input.query?.trim() ?? "";
  const rag = query ? await searchRagDocuments(env, query, ["question"], input.limit) : null;
  const matched: MatchedQuestion[] = rag
    ? rag.results.flatMap((result) => {
        const resolved = questionForResult(result);
        return resolved ? [{ ...resolved, result }] : [];
      })
    : qaQuestions.map((question) => ({ question, track: "qa" as const, result: undefined }));
  let questions = matched;
  if (input.category) {
    const needle = input.category.toLowerCase();
    questions = questions.filter(({ question }) => clean(question.category).toLowerCase() === needle);
  }
  if (input.prevalence) {
    const needle = input.prevalence.toLowerCase();
    questions = questions.filter(({ question }) => clean(question.prevalence).toLowerCase() === needle);
  }
  questions = questions.slice(0, input.limit);
  return {
    query: query || null, retrieval: rag?.retrieval ?? "catalog", embeddingModel: rag?.embeddingModel ?? null, count: questions.length,
    questions: questions.map(({ question, track, result }) => presentQuestion(question, track, result, rag?.retrieval)),
  };
}

async function getLearningProgress(env: McpEnv, request: Request, raw: unknown) {
  const input = LearningProgressInput.parse(raw ?? {});
  const context = requestContext(request);
  let rows: Row[];
  if (context.multiUser && context.userId) {
    const result = await env.DB.prepare(`SELECT question_id, status, updated_at FROM user_interview_progress
      WHERE user_id = ? ORDER BY updated_at DESC`).bind(context.userId).all<Row>(); rows = result.results;
  } else {
    const result = await env.DB.prepare(`SELECT question_id, status, updated_at FROM interview_progress ORDER BY updated_at DESC`).all<Row>(); rows = result.results;
  }
  const statusCounts = { PLANNED: 0, LEARNING: 0, LEARNED: 0 };
  const items = rows.map((row) => {
    const id = clean(row.question_id, 300); const status = clean(row.status, 100).toUpperCase();
    if (status in statusCounts) statusCounts[status as keyof typeof statusCounts] += 1;
    const question = questionByAnyId(id);
    return { questionId: id, status, updatedAt: clean(row.updated_at, 100),
      question: question ? clean(question.question || question.title, 2_000) : null,
      category: question ? clean(question.category, 300) : null };
  });
  const recommendations = input.query ? await searchRagDocuments(env, input.query, ["learning"], input.limit) : null;
  const recommendedMaterials = (recommendations?.results ?? []).map((result) => ({
    id: result.refId, title: result.title, catalog: clean(result.metadata.catalog, 200), route: result.route,
    sourcePath: result.sourcePath, snippet: result.text.slice(0, 1_200), retrievalScore: result.score,
    semanticScore: recommendations?.retrieval === "vectorize" ? result.score : null,
  }));
  return { scope: "interview_questions", totalQuestions: qaQuestions.length + pythonQuestions.length, trackedQuestions: items.length,
    statusCounts, items, recommendedMaterials, recommendationQuery: input.query ?? null,
    recommendationRetrieval: recommendations?.retrieval ?? null };
}

function presentPreparationMatch(result: RagSearchResult, retrieval: string) {
  return { id: result.refId, title: result.title, track: clean(result.metadata.track, 20) || null,
    category: clean(result.metadata.category || result.metadata.catalog, 300) || null, route: result.route, sourcePath: result.sourcePath,
    snippet: result.text.slice(0, 1_200), retrievalScore: result.score, semanticScore: retrieval === "vectorize" ? result.score : null };
}

async function analyzeVacancy(env: McpEnv, request: Request, raw: unknown) {
  const input = AnalyzeVacancyInput.parse(raw ?? {});
  const context = requestContext(request);
  const job = await env.DB.prepare(`SELECT id, title, company, location, description, url FROM jobs WHERE id = ? LIMIT 1`)
    .bind(input.job_id).first<Row>();
  if (!job) throw new Error("Job not found.");
  const result = await analyzeJobsForUser(context.userId, input.job_id, 1);
  const analysisRow = context.multiUser && context.userId
    ? await env.DB.prepare(`SELECT mode, score, verdict, payload_json, updated_at FROM user_analyses WHERE user_id = ? AND job_id = ? LIMIT 1`)
      .bind(context.userId, input.job_id).first<Row>()
    : await env.DB.prepare(`SELECT mode, score, verdict, payload_json, updated_at FROM analyses WHERE job_id = ? LIMIT 1`)
      .bind(input.job_id).first<Row>();
  const preparationQuery = `${clean(job.title, 1_000)} ${clean(job.description, 3_000)}`.trim();
  const [learning, questions] = await Promise.all([
    searchRagDocuments(env, preparationQuery, ["learning"], input.preparation_limit),
    searchRagDocuments(env, preparationQuery, ["question"], input.preparation_limit),
  ]);
  return {
    job: { id: clean(job.id, 300), title: clean(job.title, 1_000), company: clean(job.company, 500),
      location: clean(job.location, 500), url: clean(job.url, 2_000) },
    execution: result[0] ?? null,
    analysis: analysisRow ? { mode: clean(analysisRow.mode, 100), score: Number(analysisRow.score ?? 0), verdict: clean(analysisRow.verdict, 100),
      updatedAt: clean(analysisRow.updated_at, 100), payload: parseJson(analysisRow.payload_json) } : null,
    preparation: {
      learningMaterials: learning.results.map((item) => presentPreparationMatch(item, learning.retrieval)),
      interviewQuestions: questions.results.map((item) => presentPreparationMatch(item, questions.retrieval)),
      learningRetrieval: learning.retrieval, questionRetrieval: questions.retrieval,
    },
  };
}

async function callTool(env: McpEnv, request: Request, name: string, args: unknown): Promise<Json> {
  if (name === "search_jobs") return searchJobs(env, request, args);
  if (name === "get_interview_questions") return getInterviewQuestions(env, args);
  if (name === "get_learning_progress") return getLearningProgress(env, request, args);
  return analyzeVacancy(env, request, args);
}

// Protocol layer: MCP revision 2026-07-28 over Streamable HTTP, stateless, one JSON-RPC message per POST.
export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const MCP_SUPPORTED_VERSIONS: readonly string[] = [MCP_PROTOCOL_VERSION];
export const MCP_ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  headerMismatch: -32020,
  unsupportedProtocolVersion: -32022,
} as const;
const META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_CLIENT_CAPABILITIES = "io.modelcontextprotocol/clientCapabilities";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";
const SERVER_INFO = { name: "gimmejob", version: "0.2.0" };
const SERVER_INSTRUCTIONS = "Use GimmeJob tools for vacancy search/analysis and private interview-learning progress. All semantic and lexical retrieval runs through one canonical RAG pipeline; Git/D1 remain authoritative sources.";
const DISCOVER_TTL_MS = 3_600_000;
const TOOLS_TTL_MS = 300_000;
const ALLOWED_METHODS = "POST, OPTIONS";
const JSON_HEADERS = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" };

class McpProtocolError extends Error {
  readonly status: number;
  readonly code: number;
  readonly data: unknown;

  constructor(status: number, code: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function invalidRequest(message: string) { return new McpProtocolError(400, MCP_ERROR_CODES.invalidRequest, message); }
function invalidParams(message: string) { return new McpProtocolError(400, MCP_ERROR_CODES.invalidParams, message); }
function headerMismatch(message: string) { return new McpProtocolError(400, MCP_ERROR_CODES.headerMismatch, message); }
function unsupportedVersion(requested: string) {
  return new McpProtocolError(400, MCP_ERROR_CODES.unsupportedProtocolVersion, "Unsupported protocol version",
    { supported: [...MCP_SUPPORTED_VERSIONS], requested });
}
function isObject(value: unknown): value is Json { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

function rpcErrorResponse(id: string | number | undefined, error: McpProtocolError): Response {
  const body = { jsonrpc: "2.0", ...(id === undefined ? {} : { id }),
    error: { code: error.code, message: error.message, ...(error.data === undefined ? {} : { data: error.data }) } };
  return Response.json(body, { status: error.status, headers: JSON_HEADERS });
}
function rpcResultResponse(id: string | number, value: Json): Response {
  const result = { resultType: "complete", ...value, _meta: { [META_SERVER_INFO]: SERVER_INFO } };
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: JSON_HEADERS });
}
function toolResult(value: Json): Json { return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false }; }
function toolError(message: string): Json { return { content: [{ type: "text", text: message }], isError: true }; }

/** Streamable HTTP carries header values that are not plain ASCII as `=?base64?<utf-8 bytes>?=`. */
function decodeHeaderValue(value: string | null): string | null {
  const encoded = value === null ? null : /^=\?base64\?([a-z0-9+/]*={0,2})\?=$/i.exec(value);
  if (!encoded) return value;
  try {
    const bytes = Uint8Array.from(atob(encoded[1]), (character) => character.codePointAt(0) ?? 0);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch { return null; }
}

function requireHeader(request: Request, name: string, expected: string, encoded = false): void {
  const raw = request.headers.get(name);
  const value = encoded ? decodeHeaderValue(raw) : raw;
  if (!value) throw headerMismatch(`Missing or malformed ${name} header.`);
  if (value !== expected) {
    throw headerMismatch(`Header mismatch: ${name} header value '${clean(value, 200)}' does not match body value '${clean(expected, 200)}'.`);
  }
}

function validateHeaders(request: Request, method: string, version: string, toolName?: string): void {
  requireHeader(request, "MCP-Protocol-Version", version);
  requireHeader(request, "Mcp-Method", method);
  if (toolName !== undefined) requireHeader(request, "Mcp-Name", toolName, true);
}

type McpMessage = { id?: string | number; method: string; params: Json };

function parseMessage(body: unknown): McpMessage {
  if (Array.isArray(body)) throw invalidRequest("Invalid Request: send one JSON-RPC message per POST; batching is not supported.");
  if (!isObject(body) || body.jsonrpc !== "2.0" || typeof body.method !== "string" || !body.method) throw invalidRequest("Invalid Request");
  if ("id" in body && typeof body.id !== "string" && typeof body.id !== "number") throw invalidRequest("Invalid Request: id must be a string or a number.");
  if (body.params !== undefined && !isObject(body.params)) throw invalidParams("params must be an object.");
  return { id: body.id as string | number | undefined, method: body.method, params: (body.params as Json | undefined) ?? {} };
}

/** Every request names its revision in params._meta; there is no initialize handshake to remember it. */
function requestVersion(request: Request, message: McpMessage): string {
  if (message.method === "initialize") throw unsupportedVersion(clean(message.params.protocolVersion, 100));
  const meta = isObject(message.params._meta) ? message.params._meta : {};
  const metaVersion = typeof meta[META_PROTOCOL_VERSION] === "string" ? meta[META_PROTOCOL_VERSION] : null;
  const requested = metaVersion ?? request.headers.get("MCP-Protocol-Version");
  if (requested !== null && !MCP_SUPPORTED_VERSIONS.includes(requested)) throw unsupportedVersion(clean(requested, 100));
  if (metaVersion === null) throw invalidParams(`params._meta must include ${META_PROTOCOL_VERSION}.`);
  if (!isObject(meta[META_CLIENT_CAPABILITIES])) throw invalidParams(`params._meta must include ${META_CLIENT_CAPABILITIES} (use {} for none).`);
  return metaVersion;
}

function toolNameOf(params: Json): string { return typeof params.name === "string" ? params.name : ""; }

async function runTool(request: Request, env: McpEnv, params: Json): Promise<Json> {
  const name = toolNameOf(params);
  if (!(MCP_TOOL_NAMES as readonly string[]).includes(name)) throw invalidParams(`Unknown tool: ${clean(name, 200) || "(missing)"}`);
  try { return toolResult(await callTool(env, request, name, params.arguments ?? {})); }
  catch (error) {
    if (error instanceof z.ZodError) return toolError(`Invalid tool arguments: ${error.issues.map((issue) => issue.message).join("; ")}`);
    return toolError(error instanceof Error ? error.message : "Tool execution failed.");
  }
}

async function dispatch(request: Request, env: McpEnv, message: McpMessage): Promise<Json> {
  if (message.method === "server/discover") {
    return { supportedVersions: [...MCP_SUPPORTED_VERSIONS], capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS,
      ttlMs: DISCOVER_TTL_MS, cacheScope: "public" };
  }
  if (message.method === "tools/list") return { tools: MCP_TOOLS, ttlMs: TOOLS_TTL_MS, cacheScope: "public" };
  if (message.method === "tools/call") return runTool(request, env, message.params);
  throw new McpProtocolError(404, MCP_ERROR_CODES.methodNotFound, `Method not found: ${clean(message.method, 200)}`);
}

/** Server-to-server callers send no Origin; a browser page from another origin is refused (DNS rebinding, CSRF). */
function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
}

async function handleMessage(request: Request, env: McpEnv, body: unknown): Promise<Response> {
  const message = parseMessage(body);
  if (message.id === undefined) {
    const version = request.headers.get("MCP-Protocol-Version");
    if (version !== null && !MCP_SUPPORTED_VERSIONS.includes(version)) throw unsupportedVersion(clean(version, 100));
    validateHeaders(request, message.method, version ?? MCP_PROTOCOL_VERSION);
    return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
  }
  const version = requestVersion(request, message);
  validateHeaders(request, message.method, version, message.method === "tools/call" ? toolNameOf(message.params) : undefined);
  return rpcResultResponse(message.id, await dispatch(request, env, message));
}

export async function handleMcpRequest(request: Request, env: McpEnv): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { allow: ALLOWED_METHODS, "cache-control": "no-store" } });
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { allow: ALLOWED_METHODS, "cache-control": "no-store" } });
  if (!hasAllowedOrigin(request)) return rpcErrorResponse(undefined, new McpProtocolError(403, MCP_ERROR_CODES.invalidRequest, "Forbidden: Origin is not allowed."));
  let body: unknown;
  try { body = await request.json(); }
  catch { return rpcErrorResponse(undefined, new McpProtocolError(400, MCP_ERROR_CODES.parseError, "Parse error")); }
  try { return await handleMessage(request, env, body); }
  catch (error) {
    if (!(error instanceof McpProtocolError)) throw error;
    const id = isObject(body) && (typeof body.id === "string" || typeof body.id === "number") ? body.id : undefined;
    return rpcErrorResponse(id, error);
  }
}
