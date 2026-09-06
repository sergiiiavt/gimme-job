"use client";

import { useEffect } from "react";
import LearningPathAdvisor from "./learning-path-advisor";
import {
  dispatchLearningPathTraceEvent,
  type LiveTraceEvent,
} from "./learning-path-stream-events";

type JsonObject = Record<string, unknown>;

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

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") return new URL(input, window.location.href);
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

async function consumeTraceStream(response: Response): Promise<JsonObject> {
  if (!response.body) throw new Error("The Learning Path Advisor live stream had no response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: JsonObject | null = null;

  const consumeFrame = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;

    const parsed = JSON.parse(data) as unknown;
    const normalized = camelize(parsed);
    if (!isRecord(normalized) || typeof normalized.type !== "string") return;

    const sequence = typeof normalized.sequence === "number" && Number.isFinite(normalized.sequence)
      ? normalized.sequence
      : 0;
    const elapsedMs = typeof normalized.elapsedMs === "number" && Number.isFinite(normalized.elapsedMs)
      ? normalized.elapsedMs
      : 0;
    const event = { ...normalized, sequence, elapsedMs } as LiveTraceEvent;
    dispatchLearningPathTraceEvent(event);

    if (event.type === "result" && isRecord(event.payload)) {
      finalPayload = event.payload;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      consumeFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }

    if (done) break;
  }
  if (buffer.trim()) consumeFrame(buffer);
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

export default function StreamingLearningPathAdvisor() {
  useEffect(() => {
    const originalFetch = window.fetch;

    const streamingFetch: typeof window.fetch = async (input, init) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      const isLearningPathRequest = Boolean(
        url
        && url.origin === window.location.origin
        && url.pathname === "/api/ai/learning-path"
        && method === "POST",
      );
      if (!isLearningPathRequest) return originalFetch.call(window, input, init);

      const headers = new Headers(init?.headers);
      headers.set("accept", "text/event-stream");
      const streamResponse = await originalFetch.call(window, "/api/ai/learning-path/stream", {
        ...init,
        method: "POST",
        headers,
        cache: "no-store",
      });

      if ([404, 502, 503, 504].includes(streamResponse.status)) {
        return originalFetch.call(window, input, init);
      }
      if (!streamResponse.ok) return streamResponse;

      const contentType = streamResponse.headers.get("content-type") ?? "";
      if (!streamResponse.body || !contentType.toLowerCase().includes("text/event-stream")) {
        return originalFetch.call(window, input, init);
      }

      try {
        return responseFromPayload(await consumeTraceStream(streamResponse));
      } catch (error) {
        return Response.json(
          {
            error: error instanceof Error
              ? error.message
              : "The Learning Path Advisor live stream failed.",
          },
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

    window.fetch = streamingFetch;
    return () => {
      if (window.fetch === streamingFetch) window.fetch = originalFetch;
    };
  }, []);

  return <LearningPathAdvisor/>;
}
