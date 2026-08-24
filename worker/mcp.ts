import { z } from "zod";
import interviewCatalog from "../content/interview/catalog";
import { analyzeJobsForUser } from "../app/api/_job-actions";
import { type RagEnv, type RagSearchResult, searchRagDocuments } from "./rag";

type Json = Record<string, unknown>;
type Row = Record<string, unknown>;
type RpcId = string | number | null;

type RequestContext = {
  multiUser: boolean;
  userId: string | null;
};

export type McpEnv = RagEnv & {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

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

export const MCP_TOOL_NAMES = [
  "search_jobs",
  "get_interview_questions",
  "get_learning_progress",
  "analyze_vacancy",
] as const;

export const MCP_TOOLS = [
  {
    name: "search_jobs",
    description: "Search GimmeJob vacancies through the canonical RAG pipeline, with optional source, status, and remote filters.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, maxLength: 500, description: "Natural-language vacancy search." },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
        remote: { type: "boolean" },
        source: { type: "string", minLength: 1, maxLength: 100 },
        status: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
  },
  {
    name: "get_interview_questions",
    description: "Find interview questions from the canonical Git-backed catalog through the shared RAG pipeline and catalog filters.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", maxLength: 500, description: "Natural-language topic or interview intent." },
        limit: { type: "integer", minimum: 1, maximum: 25, default: 10 },
        category: { type: "string", minLength: 1, maxLength: 200 },
        prevalence: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
  },
  {
    name: "get_learning_progress",
    description: "Read private persisted interview-learning progress and optionally retrieve relevant learning materials through canonical RAG.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", maxLength: 500, description: "Optional learning topic for recommended material retrieval." },
        limit: { type: "integer", minimum: 1, maximum: 15, default: 5 },
      },
    },
  },
  {
    name: "analyze_vacancy",
    description: "Analyze one stored GimmeJob vacancy and return canonical-RAG interview and learning preparation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["job_id"],
      properties: {
        job_id: { type: "string", minLength: 1, maxLength: 300 },
        preparation_limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
    },
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
  } catch {
    return fallback;
  }
}

function requestContext(request: Request): RequestContext {
  const multiUser = request.headers.get("x-gimmejob-auth-mode") === "multi-user";
  const userId = request.headers.get("x-gimmejob-user-id")?.trim() || null;
  if (multiUser && !userId) throw new Error("Authenticated tenant identity is required.");
  return { multiUser, userId };
}

function statusText(row: Row): string {
  return clean(row.tracked_status || row.status || "NEW", 100).toUpperCase() || "NEW";
}

function mapJob(row: Row, result?: RagSearchResult, retrieval?: string) {
  return {
    id: clean(row.id, 300),
    title: clean(row.title, 1_000),
    company: clean(row.company, 500),
    location: clean(row.location, 500),
    remote: row.remote === 1 || row.remote === true,
    source: clean(row.source, 200),
    status: statusText(row),
    salaryText: clean(row.salary_text, 500) || null,
    postedAt: clean(row.posted_at, 100) || null,
    discoveredAt: clean(row.discovered_at, 100) || null,
    url: clean(row.url, 2_000),
    description: clean(row.description, 4_000),
    retrievalScore: result?.score ?? null,
    semanticScore: retrieval === "vectorize" ? result?.score ?? null : null,
  };
}

async function loadJobs(env: McpEnv, context: RequestContext, ids?: string[]): Promise<Row[]> {
  const idFilter = ids?.length ? `WHERE j.id IN (${ids.map(() => "?").join(", ")})` : "";
  if (context.multiUser && context.userId) {
    const result = await env.DB.prepare(`SELECT j.*, COALESCE(t.status, 'NEW') AS tracked_status
      FROM jobs AS j
      LEFT JOIN job_tracking AS t ON t.job_id = j.id AND t.user_id = ?
      ${idFilter}
      ORDER BY j.discovered_at DESC
      LIMIT 500`)
      .bind(context.userId, ...(ids ?? []))
      .all<Row>();
    return result.results;
  }
  const result = await env.DB.prepare(`SELECT j.*, j.status AS tracked_status
    FROM jobs AS j
    ${idFilter}
    ORDER BY j.discovered_at DESC
    LIMIT 500`)
    .bind(...(ids ?? []))
    .all<Row>();
  return result.results;
}

async function searchJobs(env: McpEnv, request: Request, raw: unknown) {
  const input = SearchJobsInput.parse(raw ?? {});
  const context = requestContext(request);
  const rag = await searchRagDocuments(env, input.query, ["job"], Math.min(12, input.limit));
  const ids = rag.results.map((result) => result.refId).filter(Boolean);
  const resultById = new Map(rag.results.map((result) => [result.refId, result]));
  let rows = ids.length ? await loadJobs(env, context, ids) : [];
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

  return {
    query: input.query,
    retrieval: rag.retrieval,
    embeddingModel: rag.embeddingModel,
    count: filtered.length,
    jobs: filtered.map((row) => mapJob(row, resultById.get(clean(row.id)), rag.retrieval)),
  };
}

const interviewQuestions = interviewCatalog.questions as unknown as Json[];
const questionById = new Map(interviewQuestions.map((question) => [clean(question.id), question]));

function presentQuestion(question: Json, result?: RagSearchResult, retrieval?: string) {
  return {
    id: clean(question.id, 300),
    question: clean(question.question || question.title, 2_000),
    answer: clean(question.answer, 8_000),
    category: clean(question.category, 300),
    kind: clean(question.kind, 100) || null,
    prevalence: clean(question.prevalence, 100) || null,
    tags: Array.isArray(question.tags) ? question.tags.map((tag) => clean(tag, 100)).filter(Boolean) : [],
    retrievalScore: result?.score ?? null,
    semanticScore: retrieval === "vectorize" ? result?.score ?? null : null,
  };
}

async function getInterviewQuestions(env: McpEnv, raw: unknown) {
  const input = InterviewQuestionsInput.parse(raw ?? {});
  const query = input.query?.trim() ?? "";
  const rag = query
    ? await searchRagDocuments(env, query, ["question"], Math.min(12, input.limit))
    : null;
  const resultById = new Map((rag?.results ?? []).map((result) => [result.refId, result]));
  let questions = rag
    ? rag.results.map((result) => questionById.get(result.refId)).filter((item): item is Json => Boolean(item))
    : interviewQuestions;

  if (input.category) {
    const needle = input.category.toLowerCase();
    questions = questions.filter((question) => clean(question.category).toLowerCase() === needle);
  }
  if (input.prevalence) {
    const needle = input.prevalence.toLowerCase();
    questions = questions.filter((question) => clean(question.prevalence).toLowerCase() === needle);
  }
  questions = questions.slice(0, input.limit);

  return {
    query: query || null,
    retrieval: rag?.retrieval ?? "catalog",
    embeddingModel: rag?.embeddingModel ?? null,
    count: questions.length,
    questions: questions.map((question) => presentQuestion(question, resultById.get(clean(question.id)), rag?.retrieval)),
  };
}

async function getLearningProgress(env: McpEnv, request: Request, raw: unknown) {
  const input = LearningProgressInput.parse(raw ?? {});
  const context = requestContext(request);
  let rows: Row[];
  if (context.multiUser && context.userId) {
    const result = await env.DB.prepare(`SELECT question_id, status, updated_at
      FROM user_interview_progress WHERE user_id = ? ORDER BY updated_at DESC`)
      .bind(context.userId)
      .all<Row>();
    rows = result.results;
  } else {
    const result = await env.DB.prepare(`SELECT question_id, status, updated_at
      FROM interview_progress ORDER BY updated_at DESC`).all<Row>();
    rows = result.results;
  }

  const statusCounts = { PLANNED: 0, LEARNING: 0, LEARNED: 0 };
  const items = rows.map((row) => {
    const id = clean(row.question_id, 300);
    const status = clean(row.status, 100).toUpperCase();
    if (status in statusCounts) statusCounts[status as keyof typeof statusCounts] += 1;
    const question = questionById.get(id);
    return {
      questionId: id,
      status,
      updatedAt: clean(row.updated_at, 100),
      question: question ? clean(question.question || question.title, 2_000) : null,
      category: question ? clean(question.category, 300) : null,
    };
  });

  const recommendations = input.query
    ? await searchRagDocuments(env, input.query, ["learning"], Math.min(12, input.limit))
    : null;
  const recommendedMaterials = (recommendations?.results ?? []).map((result) => ({
    id: result.refId,
    title: result.title,
    catalog: clean(result.metadata.catalog, 200),
    route: result.route,
    sourcePath: result.sourcePath,
    snippet: result.text.slice(0, 1_200),
    retrievalScore: result.score,
    semanticScore: recommendations?.retrieval === "vectorize" ? result.score : null,
  }));

  return {
    scope: "interview_questions",
    totalQuestions: interviewQuestions.length,
    trackedQuestions: items.length,
    statusCounts,
    items,
    recommendedMaterials,
    recommendationQuery: input.query ?? null,
    recommendationRetrieval: recommendations?.retrieval ?? null,
  };
}

function presentPreparationMatch(result: RagSearchResult, retrieval: string) {
  return {
    id: result.refId,
    title: result.title,
    category: clean(result.metadata.category || result.metadata.catalog, 300) || null,
    route: result.route,
    sourcePath: result.sourcePath,
    snippet: result.text.slice(0, 1_200),
    retrievalScore: result.score,
    semanticScore: retrieval === "vectorize" ? result.score : null,
  };
}

async function analyzeVacancy(env: McpEnv, request: Request, raw: unknown) {
  const input = AnalyzeVacancyInput.parse(raw ?? {});
  const context = requestContext(request);
  const job = await env.DB.prepare(`SELECT id, title, company, location, description, url
    FROM jobs WHERE id = ? LIMIT 1`).bind(input.job_id).first<Row>();
  if (!job) throw new Error("Job not found.");

  const result = await analyzeJobsForUser(context.userId, input.job_id, 1);
  const analysisRow = context.multiUser && context.userId
    ? await env.DB.prepare(`SELECT mode, score, verdict, payload_json, updated_at
        FROM user_analyses WHERE user_id = ? AND job_id = ? LIMIT 1`)
        .bind(context.userId, input.job_id).first<Row>()
    : await env.DB.prepare(`SELECT mode, score, verdict, payload_json, updated_at
        FROM analyses WHERE job_id = ? LIMIT 1`)
        .bind(input.job_id).first<Row>();

  const preparationQuery = `${clean(job.title, 1_000)} ${clean(job.description, 3_000)}`.trim();
  const [learning, questions] = await Promise.all([
    searchRagDocuments(env, preparationQuery, ["learning"], input.preparation_limit),
    searchRagDocuments(env, preparationQuery, ["question"], input.preparation_limit),
  ]);

  return {
    job: {
      id: clean(job.id, 300),
      title: clean(job.title, 1_000),
      company: clean(job.company, 500),
      location: clean(job.location, 500),
      url: clean(job.url, 2_000),
    },
    execution: result[0] ?? null,
    analysis: analysisRow ? {
      mode: clean(analysisRow.mode, 100),
      score: Number(analysisRow.score ?? 0),
      verdict: clean(analysisRow.verdict, 100),
      updatedAt: clean(analysisRow.updated_at, 100),
      payload: parseJson(analysisRow.payload_json),
    } : null,
    preparation: {
      learningMaterials: learning.results.map((item) => presentPreparationMatch(item, learning.retrieval)),
      interviewQuestions: questions.results.map((item) => presentPreparationMatch(item, questions.retrieval)),
      learningRetrieval: learning.retrieval,
      questionRetrieval: questions.retrieval,
    },
  };
}

async function callTool(env: McpEnv, request: Request, name: string, args: unknown): Promise<Json> {
  if (name === "search_jobs") return searchJobs(env, request, args);
  if (name === "get_interview_questions") return getInterviewQuestions(env, args);
  if (name === "get_learning_progress") return getLearningProgress(env, request, args);
  if (name === "analyze_vacancy") return analyzeVacancy(env, request, args);
  throw new Error(`Unknown tool: ${name}`);
}

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: RpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

function toolResult(value: Json) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    isError: false,
  };
}

function toolError(message: string) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

async function handleRpcMessage(message: unknown, request: Request, env: McpEnv): Promise<unknown | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return rpcError(null, -32600, "Invalid Request");
  const rpc = message as Json;
  const id = typeof rpc.id === "string" || typeof rpc.id === "number" || rpc.id === null ? rpc.id as RpcId : null;
  const method = clean(rpc.method, 200);
  const notification = !("id" in rpc);

  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (notification) return null;

  if (method === "initialize") {
    const params = rpc.params && typeof rpc.params === "object" && !Array.isArray(rpc.params) ? rpc.params as Json : {};
    return rpcResult(id, {
      protocolVersion: clean(params.protocolVersion, 100) || "2026-07-28",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "gimmejob", version: "0.1.0" },
      instructions: "Use GimmeJob tools for vacancy search/analysis and private interview-learning progress. All semantic and lexical retrieval runs through one canonical RAG pipeline; Git/D1 remain authoritative sources.",
    });
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: MCP_TOOLS });
  if (method === "tools/call") {
    const params = rpc.params && typeof rpc.params === "object" && !Array.isArray(rpc.params) ? rpc.params as Json : {};
    const name = clean(params.name, 200);
    if (!MCP_TOOL_NAMES.includes(name as typeof MCP_TOOL_NAMES[number])) {
      return rpcError(id, -32602, `Unknown tool: ${name || "(missing)"}`);
    }
    try {
      const result = await callTool(env, request, name, params.arguments ?? {});
      return rpcResult(id, toolResult(result));
    } catch (error) {
      if (error instanceof z.ZodError) return rpcResult(id, toolError(`Invalid tool arguments: ${error.issues.map((issue) => issue.message).join("; ")}`));
      return rpcResult(id, toolError(error instanceof Error ? error.message : "Tool execution failed."));
    }
  }

  return rpcError(id, -32601, `Method not found: ${method || "(missing)"}`);
}

export async function handleMcpRequest(request: Request, env: McpEnv): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { allow: "POST, OPTIONS", "cache-control": "no-store" },
    });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { allow: "POST, OPTIONS", "cache-control": "no-store" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  const responses = Array.isArray(body)
    ? (await Promise.all(body.map((message) => handleRpcMessage(message, request, env)))).filter((item) => item !== null)
    : [await handleRpcMessage(body, request, env)].filter((item) => item !== null);

  if (!responses.length) return new Response(null, { status: 202, headers: { "cache-control": "no-store" } });
  const payload = Array.isArray(body) ? responses : responses[0];
  return Response.json(payload, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
