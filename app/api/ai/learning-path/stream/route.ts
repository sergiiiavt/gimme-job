import { z } from "zod";
import { tenantRequestContext } from "../../../_tenant-state.ts";
import {
  selectedLegacyLanguage,
  withLanguageControl,
  type AdvisorLanguage,
} from "../language.ts";

type LearningPathAiEnv = {
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 30;
const MAX_TOTAL_MESSAGE_LENGTH = 80_000;
const MAX_STREAM_EVENT_BYTES = 128_000;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(20_000),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  sessionId: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/).nullable().optional(),
  language: z.enum(["en", "uk"]).optional(),
});

const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

function errorResponse(error: string, status: number, headers: HeadersInit = {}): Response {
  return Response.json({ error }, { status, headers: { ...RESPONSE_HEADERS, ...headers } });
}

function serviceTarget(env: LearningPathAiEnv): { endpoint: URL; token: string } | null {
  const rawUrl = env.GIMMEJOB_AI_URL?.trim();
  const token = env.GIMMEJOB_AI_SERVICE_TOKEN?.trim();
  if (!rawUrl || !token) return null;

  try {
    const base = new URL(rawUrl);
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
    if (base.username || base.password || (base.protocol !== "https:" && !(local && base.protocol === "http:"))) {
      return null;
    }
    base.search = "";
    base.hash = "";
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    const endpoint = new URL("v1/learning-path/stream", base);
    return endpoint.origin === base.origin ? { endpoint, token } : null;
  } catch {
    return null;
  }
}

function boundedSseBody(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = "";

  const emit = (frame: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    const bytes = encoder.encode(frame);
    if (bytes.byteLength > MAX_STREAM_EVENT_BYTES) throw new Error("AI learning path stream event exceeded the safety limit.");
    if (frame.startsWith("data: ")) controller.enqueue(bytes);
  };

  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffered += decoder.decode(chunk, { stream: true });
      if (buffered.length > MAX_STREAM_EVENT_BYTES * 2) throw new Error("AI learning path stream exceeded the safety limit.");

      for (let boundary = buffered.indexOf("\n\n"); boundary >= 0; boundary = buffered.indexOf("\n\n")) {
        const frame = buffered.slice(0, boundary + 2);
        buffered = buffered.slice(boundary + 2);
        emit(frame, controller);
      }
    },
    flush(controller) {
      buffered += decoder.decode();
      if (buffered.trim()) emit(buffered, controller);
    },
  }));
}

async function callAiStream(
  env: LearningPathAiEnv,
  messages: ChatMessage[],
  sessionId: string | null,
  language: AdvisorLanguage | null,
): Promise<Response> {
  const target = serviceTarget(env);
  if (!target) return errorResponse("AI learning path service is not configured.", 503);

  let upstream: Response;
  try {
    upstream = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${target.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: language ? withLanguageControl(messages, language, MAX_MESSAGES) : messages,
        session_id: sessionId,
      }),
    });
  } catch {
    return errorResponse("AI learning path service is temporarily unavailable.", 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 404) return errorResponse("AI learning path live stream is not available yet.", 404);
    if ([429, 503, 504].includes(upstream.status)) {
      return errorResponse("AI learning path service is temporarily unavailable.", 503);
    }
    return errorResponse("AI learning path service failed to start a live response.", 502);
  }

  const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? "";
  if (!upstream.body || !contentType.includes("text/event-stream")) {
    return errorResponse("AI learning path service returned an invalid live response.", 502);
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
    return errorResponse("Authentication required.", 401);
  }
  if (request.method !== "POST") return errorResponse("Method not allowed.", 405, { allow: "POST" });

  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  const parsed = requestSchema.safeParse(rawInput);
  if (!parsed.success) return errorResponse("Invalid learning path stream request.", 400);

  const { messages, sessionId = null } = parsed.data;
  if (messages.reduce((total, message) => total + message.content.length, 0) > MAX_TOTAL_MESSAGE_LENGTH) {
    return errorResponse("Learning path messages are too large.", 400);
  }
  if (messages.at(-1)?.role !== "user") return errorResponse("The final message must be from the user.", 400);

  const language = (parsed.data.language as AdvisorLanguage | undefined) ?? selectedLegacyLanguage(messages);
  return callAiStream(env, messages, sessionId, language);
}

export async function POST(request: Request): Promise<Response> {
  const runtime = await import("cloudflare:workers");
  return handleLearningPathAiStream(request, runtime.env as LearningPathAiEnv);
}
