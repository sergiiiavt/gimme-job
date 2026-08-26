import { tenantRequestContext } from "../../_tenant-state.ts";

type LearningPathAiEnv = {
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

type JsonObject = Record<string, unknown>;
type AdvisorLanguage = "en" | "uk";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type WorkflowStep = {
  id: string;
  label: string;
  detail: string;
};

type AssistantCardKind = "knowledge" | "learning" | "interview" | "hint";

type AssistantCard = {
  kind: AssistantCardKind;
  title: string;
  summary: string;
  sourcePath: string | null;
};

type LearningMapNodeKind = "topic" | "foundation" | "concept" | "practice" | "source";

type LearningMapNode = {
  id: string;
  title: string;
  summary: string;
  kind: LearningMapNodeKind;
  sourcePath: string | null;
  durationMinutes: number | null;
};

type LearningMapEdge = {
  source: string;
  target: string;
  label: string;
};

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_TOTAL_MESSAGE_LENGTH = 80_000;
const MAX_SESSION_ID_LENGTH = 200;
const MAX_REQUEST_ID_LENGTH = 200;
const MAX_MODEL_LENGTH = 200;
const MAX_WORKFLOW_STEPS = 16;
const MAX_CARDS = 20;
const MAX_SOURCES = 30;
const MAX_SUGGESTED_PROMPTS = 12;
const MAX_MAP_NODES = 8;
const MAX_MAP_EDGES = 12;
const MAX_ID_LENGTH = 200;
const MAX_KIND_LENGTH = 100;
const MAX_TITLE_LENGTH = 500;
const MAX_LABEL_LENGTH = 500;
const MAX_DETAIL_LENGTH = 4_000;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_PATH_LENGTH = 1_000;
const MAX_PROMPT_LENGTH = 2_000;
const MAX_DURATION_MINUTES = 240;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const LANGUAGE_CONTROL_PATTERN = /^\[\[gimmejob-language:(en|uk)\]\]$/;
const CARD_KINDS = new Set<AssistantCardKind>(["knowledge", "learning", "interview", "hint"]);
const MAP_NODE_KINDS = new Set<LearningMapNodeKind>(["topic", "foundation", "concept", "practice", "source"]);

const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

function json(payload: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(payload, {
    status,
    headers: { ...RESPONSE_HEADERS, ...headers },
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || value.length > maxLength) return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return requiredText(value, maxLength) ?? undefined;
}

function validSessionId(value: string): boolean {
  return value.length <= MAX_SESSION_ID_LENGTH && SESSION_ID_PATTERN.test(value);
}

function parseLanguage(value: unknown): AdvisorLanguage | null {
  return value === "en" || value === "uk" ? value : null;
}

function languageControl(message: ChatMessage): AdvisorLanguage | null {
  if (message.role !== "assistant") return null;
  const match = LANGUAGE_CONTROL_PATTERN.exec(message.content.trim());
  return match ? parseLanguage(match[1]) : null;
}

function selectedLegacyLanguage(messages: ChatMessage[]): AdvisorLanguage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const language = languageControl(messages[index]);
    if (language) return language;
  }
  return null;
}

function withLanguageControl(messages: ChatMessage[], language: AdvisorLanguage): ChatMessage[] {
  const conversation = messages.filter((message) => languageControl(message) === null);
  const bounded = conversation.slice(-(MAX_MESSAGES - 1));
  const latest = bounded.at(-1);
  if (!latest || latest.role !== "user") return bounded;
  return [
    ...bounded.slice(0, -1),
    { role: "assistant", content: `[[gimmejob-language:${language}]]` },
    latest,
  ];
}

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  let totalLength = 0;
  for (const item of value) {
    if (!isJsonObject(item) || (item.role !== "user" && item.role !== "assistant")) return null;
    const content = requiredText(item.content, MAX_MESSAGE_LENGTH);
    if (!content) return null;
    totalLength += content.length;
    if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) return null;
    messages.push({ role: item.role, content });
  }
  return messages;
}

function parseWorkflowSteps(value: unknown): WorkflowStep[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_WORKFLOW_STEPS) return null;
  const steps: WorkflowStep[] = [];
  for (const item of value) {
    if (!isJsonObject(item)) return null;
    const id = requiredText(item.id, MAX_ID_LENGTH);
    const label = requiredText(item.label, MAX_LABEL_LENGTH);
    const detail = requiredText(item.detail, MAX_DETAIL_LENGTH);
    if (!id || !label || !detail) return null;
    steps.push({ id, label, detail });
  }
  return steps;
}

function parseCards(value: unknown): AssistantCard[] | null {
  if (!Array.isArray(value) || value.length > MAX_CARDS) return null;
  const cards: AssistantCard[] = [];
  for (const item of value) {
    if (!isJsonObject(item)) return null;
    const kind = requiredText(item.kind, MAX_KIND_LENGTH) as AssistantCardKind | null;
    const title = requiredText(item.title, MAX_TITLE_LENGTH);
    const summary = requiredText(item.summary, MAX_SUMMARY_LENGTH);
    const sourcePath = nullableText(item.source_path, MAX_PATH_LENGTH);
    if (!kind || !CARD_KINDS.has(kind) || !title || !summary || sourcePath === undefined) return null;
    cards.push({ kind, title, summary, sourcePath });
  }
  return cards;
}

function parseStringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const items: string[] = [];
  for (const item of value) {
    const parsed = requiredText(item, maxLength);
    if (!parsed) return null;
    items.push(parsed);
  }
  return items;
}

function parseLearningMapNodes(value: unknown): LearningMapNode[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MAP_NODES) return null;
  const nodes: LearningMapNode[] = [];
  const nodeIds = new Set<string>();
  for (const item of value) {
    if (!isJsonObject(item)) return null;
    const id = requiredText(item.id, MAX_ID_LENGTH);
    const title = requiredText(item.title, MAX_TITLE_LENGTH);
    const summary = requiredText(item.summary, MAX_SUMMARY_LENGTH);
    const kind = requiredText(item.kind, MAX_KIND_LENGTH) as LearningMapNodeKind | null;
    const sourcePath = nullableText(item.source_path, MAX_PATH_LENGTH);
    const rawDuration = item.duration_minutes;
    const durationMinutes = rawDuration ?? null;
    if (
      !id || !title || !summary || !kind || !MAP_NODE_KINDS.has(kind) || sourcePath === undefined
      || (durationMinutes !== null && (
        typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes)
        || durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES
      ))
      || nodeIds.has(id)
    ) return null;
    nodeIds.add(id);
    nodes.push({ id, title, summary, kind, sourcePath, durationMinutes });
  }
  return nodes;
}

function parseLearningMapEdges(value: unknown, nodeIds: Set<string>): LearningMapEdge[] | null {
  if (!Array.isArray(value) || value.length > MAX_MAP_EDGES) return null;
  const edges: LearningMapEdge[] = [];
  for (const item of value) {
    if (!isJsonObject(item)) return null;
    const source = requiredText(item.source, MAX_ID_LENGTH);
    const target = requiredText(item.target, MAX_ID_LENGTH);
    const label = requiredText(item.label, MAX_LABEL_LENGTH);
    if (!source || !target || !label || source === target || !nodeIds.has(source) || !nodeIds.has(target)) return null;
    edges.push({ source, target, label });
  }
  return edges;
}

function sanitizeProviderPayload(payload: unknown): JsonObject | null {
  if (!isJsonObject(payload)) return null;
  const requestId = requiredText(payload.request_id, MAX_REQUEST_ID_LENGTH);
  const sessionId = requiredText(payload.session_id, MAX_SESSION_ID_LENGTH);
  const model = requiredText(payload.model, MAX_MODEL_LENGTH);
  const workflowSteps = parseWorkflowSteps(payload.workflow_steps);
  if (
    !requestId || !sessionId || !validSessionId(sessionId) || !model
    || typeof payload.langfuse_tracing !== "boolean"
    || payload.orchestration !== "langgraph"
    || (payload.retrieval_mode !== "repository" && payload.retrieval_mode !== "general")
    || !workflowSteps
    || !isJsonObject(payload.response)
  ) return null;

  const response = payload.response;
  const answer = requiredText(response.answer, MAX_MESSAGE_LENGTH);
  const cards = parseCards(response.cards);
  const sources = parseStringArray(response.sources, MAX_SOURCES, MAX_PATH_LENGTH);
  const suggestedPrompts = parseStringArray(response.suggested_prompts, MAX_SUGGESTED_PROMPTS, MAX_PROMPT_LENGTH);
  if (!answer || !cards || !sources || !suggestedPrompts || !isJsonObject(response.learning_map)) return null;

  const learningMap = response.learning_map;
  const mapTitle = requiredText(learningMap.title, MAX_TITLE_LENGTH);
  const nodes = parseLearningMapNodes(learningMap.nodes);
  if (!mapTitle || !nodes) return null;
  const edges = parseLearningMapEdges(learningMap.edges, new Set(nodes.map((node) => node.id)));
  if (!edges) return null;

  return {
    requestId,
    sessionId,
    model,
    langfuseTracing: payload.langfuse_tracing,
    orchestration: "langgraph",
    retrievalMode: payload.retrieval_mode,
    workflowSteps,
    response: {
      answer,
      cards,
      sources,
      suggestedPrompts,
      learningMap: {
        title: mapTitle,
        nodes,
        edges,
      },
    },
  };
}

function aiBaseUrl(env: LearningPathAiEnv): URL | null {
  const configured = env.GIMMEJOB_AI_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localDevelopment = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
    if (url.username || url.password || (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:"))) return null;
    url.search = "";
    url.hash = "";
    while (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url;
  } catch {
    return null;
  }
}

async function callAi(
  env: LearningPathAiEnv,
  messages: ChatMessage[],
  sessionId: string | null,
  language: AdvisorLanguage | null,
): Promise<Response> {
  const base = aiBaseUrl(env);
  const token = env.GIMMEJOB_AI_SERVICE_TOKEN?.trim();
  if (!base || !token) return json({ error: "AI learning path service is not configured." }, 503);

  const endpoint = new URL("v1/learning-path", base.href.endsWith("/") ? base : new URL(`${base.href}/`));
  if (endpoint.origin !== base.origin) return json({ error: "AI learning path service configuration is invalid." }, 503);

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: language ? withLanguageControl(messages, language) : messages,
        session_id: sessionId,
      }),
    });
  } catch {
    return json({ error: "AI learning path service is temporarily unavailable." }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 429 || upstream.status === 503 || upstream.status === 504) {
      return json({ error: "AI learning path service is temporarily unavailable." }, 503);
    }
    return json({ error: "AI learning path service failed to generate a response." }, 502);
  }

  const raw = await upstream.json().catch(() => null) as unknown;
  const payload = sanitizeProviderPayload(raw);
  if (!payload) return json({ error: "AI learning path service returned an invalid response." }, 502);
  return json(payload);
}

export async function handleLearningPathAi(request: Request, env: LearningPathAiEnv): Promise<Response> {
  const tenant = tenantRequestContext(request);
  const ephemeral = request.headers.get("x-gimmejob-session-scope") === "ephemeral";
  if (tenant.multiUser && (!tenant.authenticated || !tenant.userId) && !ephemeral) {
    return json({ error: "Authentication required." }, 401);
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { allow: "POST" });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!isJsonObject(input)) return json({ error: "Invalid request body." }, 400);

  const messages = parseMessages(input.messages);
  if (!messages) return json({ error: "Provide between 1 and 30 valid messages." }, 400);
  if (messages.at(-1)?.role !== "user") {
    return json({ error: "The final message must be from the user." }, 400);
  }

  const explicitLanguage = input.language === undefined ? null : parseLanguage(input.language);
  if (input.language !== undefined && !explicitLanguage) {
    return json({ error: "Response language must be 'en' or 'uk'." }, 400);
  }
  const language = explicitLanguage ?? selectedLegacyLanguage(messages);

  let sessionId: string | null = null;
  if (input.sessionId !== undefined && input.sessionId !== null) {
    const parsedSessionId = requiredText(input.sessionId, MAX_SESSION_ID_LENGTH);
    if (!parsedSessionId || !validSessionId(parsedSessionId)) {
      return json({ error: "Invalid session identifier." }, 400);
    }
    sessionId = parsedSessionId;
  }

  return callAi(env, messages, sessionId, language);
}

export async function POST(request: Request): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  return handleLearningPathAi(request, runtime.env as LearningPathAiEnv);
}
