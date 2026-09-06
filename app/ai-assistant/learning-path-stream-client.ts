import type { LiveTraceEvent } from "./learning-path-stream-events";

type JsonObject = Record<string, unknown>;
type TraceEventSink = (event: LiveTraceEvent) => void;

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [camelKey(key), camelize(item)]));
}

function requestUrl(input: RequestInfo | URL, baseHref: string): URL | null {
  try {
    if (typeof input === "string") return new URL(input, baseHref);
    if (input instanceof URL) return new URL(input.href);
    return new URL(input.url);
  } catch {
    return null;
  }
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function parseFrame(frame: string): JsonObject | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;

  const normalized = camelize(JSON.parse(data) as unknown);
  if (!isRecord(normalized) || typeof normalized.type !== "string") return null;
  return normalized;
}

export async function consumeLearningPathTraceStream(
  response: Response,
  emit: TraceEventSink,
): Promise<JsonObject> {
  if (!response.body) throw new Error("The Learning Path Advisor live stream had no response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: JsonObject | null = null;

  const consume = (frame: string) => {
    const normalized = parseFrame(frame);
    if (!normalized) return;
    const event = {
      ...normalized,
      sequence: typeof normalized.sequence === "number" && Number.isFinite(normalized.sequence) ? normalized.sequence : 0,
      elapsedMs: typeof normalized.elapsedMs === "number" && Number.isFinite(normalized.elapsedMs) ? normalized.elapsedMs : 0,
    } as LiveTraceEvent;
    emit(event);
    if (event.type === "result" && isRecord(event.payload)) finalPayload = event.payload;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    for (let boundary = buffer.indexOf("\n\n"); boundary >= 0; boundary = buffer.indexOf("\n\n")) {
      consume(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
    }
    if (done) break;
  }

  if (buffer.trim()) consume(buffer);
  if (!finalPayload) throw new Error("The Learning Path Advisor live stream ended without a final result.");
  return finalPayload;
}

function responseFromPayload(payload: JsonObject): Response {
  return Response.json(payload, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export function createLearningPathStreamingFetch(
  originalFetch: typeof fetch,
  baseHref: string,
  emit: TraceEventSink,
): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input, baseHref);
    const method = requestMethod(input, init);
    const isLearningPathRequest = Boolean(
      url
      && url.origin === new URL(baseHref).origin
      && url.pathname === "/api/ai/learning-path"
      && method === "POST",
    );
    if (!isLearningPathRequest) return originalFetch(input, init);

    const headers = new Headers(init?.headers);
    headers.set("accept", "text/event-stream");
    const streamResponse = await originalFetch(new URL("/api/ai/learning-path/stream", baseHref), {
      ...init,
      method: "POST",
      headers,
      cache: "no-store",
    });

    if ([404, 502, 503, 504].includes(streamResponse.status)) return originalFetch(input, init);
    if (!streamResponse.ok) return streamResponse;

    const contentType = streamResponse.headers.get("content-type")?.toLowerCase() ?? "";
    if (!streamResponse.body || !contentType.includes("text/event-stream")) return originalFetch(input, init);

    try {
      return responseFromPayload(await consumeLearningPathTraceStream(streamResponse, emit));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "The Learning Path Advisor live stream failed." },
        {
          status: 502,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
            "x-content-type-options": "nosniff",
          },
        },
      );
    }
  };
}
