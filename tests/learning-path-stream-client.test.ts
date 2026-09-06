import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeLearningPathTraceStream,
  createLearningPathStreamingFetch,
} from "../app/ai-assistant/learning-path-stream-client.ts";
import type { LiveTraceEvent } from "../app/ai-assistant/learning-path-stream-events.ts";

const BASE = "https://gimme-job.com/ai-assistant";

function browserRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) return new Request(input, init);
  return new Request(new URL(input.toString(), BASE), init);
}

function sse(frames: unknown[], status = 200): Response {
  return new Response(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(""), {
    status,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

test("stream client emits normalized live events and returns the final JSON contract", async () => {
  const calls: Array<{ url: string; accept: string | null }> = [];
  const events: LiveTraceEvent[] = [];
  const originalFetch: typeof fetch = async (input, init) => {
    const request = browserRequest(input, init);
    calls.push({ url: request.url, accept: request.headers.get("accept") });
    return sse([
      { type: "trace.start", sequence: 1, elapsed_ms: 0.5, request_id: "request-1" },
      { type: "node.start", sequence: 2, elapsed_ms: 1.5, node_id: "contextualize_query" },
      { type: "result", sequence: 3, elapsed_ms: 9.25, payload: { request_id: "request-1", retrieval_mode: "repository" } },
    ]);
  };

  const streamingFetch = createLearningPathStreamingFetch(originalFetch, BASE, (event) => events.push(event));
  const response = await streamingFetch("/api/ai/learning-path", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Python" }] }),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://gimme-job.com/api/ai/learning-path/stream");
  assert.equal(calls[0]?.accept, "text/event-stream");
  assert.deepEqual(await response.json(), { requestId: "request-1", retrievalMode: "repository" });
  assert.equal(events.length, 3);
  assert.equal(events[0]?.requestId, "request-1");
  assert.equal(events[1]?.nodeId, "contextualize_query");
  assert.equal(events[2]?.elapsedMs, 9.25);
});

test("stream client falls back to the existing JSON endpoint during rolling deployment", async () => {
  const urls: string[] = [];
  const originalFetch: typeof fetch = async (input, init) => {
    const request = browserRequest(input, init);
    urls.push(request.url);
    if (request.url.endsWith("/stream")) return Response.json({ error: "not deployed" }, { status: 404 });
    return Response.json({ requestId: "fallback-request" });
  };

  const streamingFetch = createLearningPathStreamingFetch(originalFetch, BASE, () => undefined);
  const response = await streamingFetch("/api/ai/learning-path", { method: "POST", body: "{}" });

  assert.deepEqual(urls, [
    "https://gimme-job.com/api/ai/learning-path/stream",
    "https://gimme-job.com/api/ai/learning-path",
  ]);
  assert.deepEqual(await response.json(), { requestId: "fallback-request" });
});

test("stream client leaves unrelated and non-POST requests untouched", async () => {
  const urls: string[] = [];
  const originalFetch: typeof fetch = async (input, init) => {
    const request = browserRequest(input, init);
    urls.push(request.url);
    return Response.json({ ok: true });
  };
  const streamingFetch = createLearningPathStreamingFetch(originalFetch, BASE, () => undefined);

  assert.equal((await streamingFetch("/api/health")).status, 200);
  assert.equal((await streamingFetch("/api/ai/learning-path", { method: "GET" })).status, 200);
  assert.deepEqual(urls, ["https://gimme-job.com/api/health", "https://gimme-job.com/api/ai/learning-path"]);
});

test("stream client falls back when a successful upstream response is not SSE", async () => {
  let calls = 0;
  const originalFetch: typeof fetch = async () => {
    calls += 1;
    return calls === 1 ? Response.json({ unexpected: true }) : Response.json({ requestId: "json-fallback" });
  };
  const streamingFetch = createLearningPathStreamingFetch(originalFetch, BASE, () => undefined);
  const response = await streamingFetch("/api/ai/learning-path", { method: "POST" });
  assert.equal(calls, 2);
  assert.deepEqual(await response.json(), { requestId: "json-fallback" });
});

test("stream client returns a safe 502 if SSE ends without a final result", async () => {
  const originalFetch: typeof fetch = async () => sse([
    { type: "trace.start", sequence: 1, elapsed_ms: 0 },
    { type: "node.start", sequence: 2, elapsed_ms: 1 },
  ]);
  const streamingFetch = createLearningPathStreamingFetch(originalFetch, BASE, () => undefined);
  const response = await streamingFetch("/api/ai/learning-path", { method: "POST" });
  assert.equal(response.status, 502);
  assert.match((await response.json() as { error: string }).error, /ended without a final result/i);
});

test("trace consumer handles split frames, final flush, ignored frames and default metrics", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("event: ping\n\n"));
      controller.enqueue(encoder.encode('data: {"type":"node.start","node_id":"retrieve"}\n'));
      controller.enqueue(encoder.encode('\ndata: {"type":"result","payload":{"request_id":"r2"}}'));
      controller.close();
    },
  });
  const events: LiveTraceEvent[] = [];
  const payload = await consumeLearningPathTraceStream(
    new Response(body, { headers: { "content-type": "text/event-stream" } }),
    (event) => events.push(event),
  );

  assert.deepEqual(payload, { requestId: "r2" });
  assert.equal(events.length, 2);
  assert.equal(events[0]?.sequence, 0);
  assert.equal(events[0]?.elapsedMs, 0);
  assert.equal(events[0]?.nodeId, "retrieve");
});
