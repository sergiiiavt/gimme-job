import { tenantRequestContext } from "../../../_tenant-state.ts";
import {
  parseAdvisorLanguage,
  selectedLegacyLanguage,
  withLanguageControl,
  type AdvisorLanguage,
} from "../language.ts";

type LearningPathAiEnv = {
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

type JsonObject = Record<string, unknown>;
type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_TOTAL_MESSAGE_LENGTH = 80_000;
const MAX_SESSION_ID_LENGTH = 200;
const MAX_STREAM_EVENT_BYTES = 128_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

function json(payload: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(payload, { status, headers: { ...RESPONSE_HEADERS, ...headers } });
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || value.length > maxLength) return null;
  const cleaned = value.trim();
  return cleaned || null;
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

function validSessionId(value: string): boolean {
  return value.length <= MAX_SESSION_ID_LENGTH && SESSION_ID_PATTERN.test(value);
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
    while (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url;
  } catch {
    return null;
  }
}

function boundedSseBody(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = "";

  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffered += decoder.decode(chunk, { stream: true });
      if (buffered.length > MAX_STREAM_EVENT_BYTES * 2) {
        throw new Error("AI learning path stream exceeded the safety limit.");
      }

      let boundary = buffered.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffered.slice(0, boundary + 2);
        buffered = buffered.slice(boundary + 2);
        if (encoder.encode(frame).byteLength > MAX_STREAM_EVENT_BYTES) {
          throw new Error("AI learning path stream event exceeded the safety limit.");
        }
        if (frame.startsWith("data: ")) controller.enqueue(encoder.encode(frame));
        boundary = buffered.indexOf("\n\n");
      }
    },
    flush(controller) {
      buffered += decoder.decode();
      if (!buffered.trim()) return;
      if (encoder.encode(buffered).byteLength > MAX_STREAM_EVENT_BYTES) {
        throw new Error("AI learning path stream event exceeded the safety limit.");
      }
      if (buffered.startsWith("data: ")) controller.enqueue(encoder.encode(buffered));
    },
  }));
}

async function callAiStream(
  env: LearningPathAiEnv,
  messages: ChatMessage[],
  sessionId: string | null,
  language: AdvisorLanguage | null,
): Promise<Response> {
  const base = aiBaseUrl(env);
  const token = env.GIMMEJOB_AI_SERVICE_TOKEN?.trim();
  if (!base || !token) return json({ error: "AI learning path service is not configured." }, 503);

  const endpoint = new URL("v1/learning-path/stream", base.href.endsWith("/") ? base : new URL(`${base.href}/`));
  if (endpoint.origin !== base.origin) return json({ error: "AI learning path service configuration is invalid." }, 503);

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: language ? withLanguageControl(messages, language, MAX_MESSAGES) : messages,
        session_id: sessionId,
      }),
    });
  } catch {
    return json({ error: "AI learning path service is temporarily unavailable." }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 404) return json({ error: "AI learning path live stream is not available yet." }, 404);
    if (upstream.status === 429 || upstream.status === 503 || upstream.status === 504) {
      return json({ error: "AI learning path service is temporarily unavailable." }, 503);
    }
    return json({ error: "AI learning path service failed to start a live response." }, 502);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.body || !contentType.toLowerCase().includes("text/event-stream")) {
    return json({ error: "AI learning path service returned an invalid live response." }, 502);
  }

  return new Response(boundedSseBody(upstream.body), {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}

export async function handleLearningPathAiStream(request: Request, env: LearningPathAiEnv): Promise<Response> {
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
  if (messages.at(-1)?.role !== "user") return json({ error: "The final message must be from the user." }, 400);

  const explicitLanguage = input.language === undefined ? null : parseAdvisorLanguage(input.language);
  if (input.language !== undefined && !explicitLanguage) {
    return json({ error: "Response language must be 'en' or 'uk'." }, 400);
  }
  const language = explicitLanguage ?? selectedLegacyLanguage(messages);

  let sessionId: string | null = null;
  if (input.sessionId !== undefined && input.sessionId !== null) {
    const parsedSessionId = requiredText(input.sessionId, MAX_SESSION_ID_LENGTH);
    if (!parsedSessionId || !validSessionId(parsedSessionId)) return json({ error: "Invalid session identifier." }, 400);
    sessionId = parsedSessionId;
  }

  return callAiStream(env, messages, sessionId, language);
}

export async function POST(request: Request): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  return handleLearningPathAiStream(request, runtime.env as LearningPathAiEnv);
}
