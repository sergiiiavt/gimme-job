import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, wrapperSource, eventsSource, traceSource, proxySource] = await Promise.all([
  readFile(new URL("../app/ai-assistant/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ai-assistant/learning-path-advisor-streaming.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/ai-assistant/learning-path-stream-events.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/ai-assistant/execution-trace.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/ai/learning-path/stream/route.ts", import.meta.url), "utf8"),
]);

test("Learning Advisor page enables the streaming wrapper without replacing the existing advisor", () => {
  assert.match(pageSource, /StreamingLearningPathAdvisor/);
  assert.match(wrapperSource, /<LearningPathAdvisor\/>/);
  assert.match(wrapperSource, /\/api\/ai\/learning-path\/stream/);
  assert.match(wrapperSource, /\/api\/ai\/learning-path/);
  assert.match(wrapperSource, /\[404, 502, 503, 504\]\.includes\(streamResponse\.status\)/);
  assert.match(wrapperSource, /text\/event-stream/);
  assert.match(wrapperSource, /consumeTraceStream/);
  assert.match(wrapperSource, /responseFromPayload/);
});

test("browser transport separates live execution events from the final result payload", () => {
  assert.match(eventsSource, /gimmejob:learning-path-trace/);
  assert.match(eventsSource, /CustomEvent<LiveTraceEvent>/);
  assert.match(wrapperSource, /dispatchLearningPathTraceEvent\(event\)/);
  assert.match(wrapperSource, /event\.type === "result"/);
  assert.match(wrapperSource, /finalPayload = event\.payload/);
  assert.match(wrapperSource, /ended without a final result/);
});

test("runtime debugger renders actual live graph and model lifecycle events", () => {
  assert.match(traceSource, /LEARNING_PATH_TRACE_EVENT/);
  assert.match(traceSource, /trace\.start/);
  assert.match(traceSource, /node\.start/);
  assert.match(traceSource, /node\.complete/);
  assert.match(traceSource, /retrieval\.complete/);
  assert.match(traceSource, /llm\.start/);
  assert.match(traceSource, /llm\.complete/);
  assert.match(traceSource, /trace\.complete/);
  assert.match(traceSource, /Running now…/);
  assert.match(traceSource, /Open live trace in Langfuse/);
  assert.match(traceSource, /not private model chain-of-thought/);
});

test("stream proxy keeps credentials server-side and applies bounded no-store SSE forwarding", () => {
  assert.match(proxySource, /authorization: `Bearer \$\{token\}`/);
  assert.match(proxySource, /MAX_STREAM_EVENT_BYTES = 128_000/);
  assert.match(proxySource, /boundedSseBody/);
  assert.match(proxySource, /cache-control": "no-store"/);
  assert.match(proxySource, /x-accel-buffering": "no"/);
  assert.match(proxySource, /AI learning path live stream is not available yet/);
  assert.doesNotMatch(wrapperSource, /GIMMEJOB_AI_SERVICE_TOKEN/);
});
