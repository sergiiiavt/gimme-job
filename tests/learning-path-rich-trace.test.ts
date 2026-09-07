import assert from "node:assert/strict";
import test from "node:test";
import { handleLearningPathAi } from "../app/api/ai/learning-path/route.ts";

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";
const env = {
  GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
  GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
};

function request(): Request {
  return new Request("https://gimme-job.com/api/ai/learning-path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "trace-test-user",
    },
    body: JSON.stringify({ messages: [{ role: "user", content: "Python parallelism" }] }),
  });
}

function richProviderPayload() {
  return {
    request_id: "request-rich-1",
    session_id: "session_rich_1",
    model: "gpt-test",
    langfuse_tracing: true,
    langfuse_trace_url: "https://cloud.langfuse.com/project/demo/traces/trace-rich-1",
    orchestration: "langgraph",
    retrieval_mode: "repository",
    total_duration_ms: 812.5,
    workflow_steps: [
      {
        id: "retrieve",
        label: "Retrieve canonical RAG context",
        detail: "Found one canonical RAG material using vectorize.",
        duration_ms: 61.25,
        input: { query: "Python parallelism", language: "en", limit: 8 },
        output: {
          strategy: "vectorize",
          embedding_model: "@cf/baai/bge-m3",
          result_count: 1,
          top_score: 0.94,
        },
        decisions: [
          {
            label: "Query embedding",
            detail: "Embedded 18 query characters with @cf/baai/bge-m3; vector dimension 1024.",
            status: "pass",
            value: 1024,
          },
          {
            label: "Similarity threshold",
            detail: "Canonical minimum vector score is 0.45; one candidate passed.",
            status: "pass",
            value: 0.45,
          },
        ],
        payloads: [
          { label: "Canonical retrieval query", kind: "text", content: "Python parallelism", truncated: false },
        ],
        retrieval_results: [{
          title: "Python parallelism",
          kind: "question",
          score: 0.94,
          source_path: "/interview/python?question=python-parallelism",
          excerpt: "Processes provide CPU parallelism while asyncio targets cooperative I/O concurrency.",
          rank: 1,
          raw_rank: 2,
          threshold: 0.45,
          matched_tokens: [],
          title_matched_tokens: [],
          score_explanation: "Vector similarity 0.9400; accepted because it is >= 0.45.",
        }],
        token_usage: null,
      },
      {
        id: "compose_repository",
        label: "Compose grounded path",
        detail: "LangChain produced structured advice from canonical RAG context.",
        duration_ms: 751.25,
        input: { retrieval_count: 1, prompt_messages: 3 },
        output: { answer_characters: 42, card_count: 0, map_node_count: 1 },
        decisions: [
          {
            label: "Structured output",
            detail: "The OpenAI call is constrained to the AssistantResponse schema.",
            status: "info",
            value: true,
          },
        ],
        payloads: [
          { label: "System prompt", kind: "prompt", content: "Use canonical RAG excerpts only.", truncated: false },
          { label: "RAG data sent to model", kind: "json", content: "[{\"title\":\"Python parallelism\"}]", truncated: false },
        ],
        retrieval_results: [],
        token_usage: { input_tokens: 520, output_tokens: 180, total_tokens: 700 },
      },
    ],
    response: {
      answer: "Start with the concurrency model, then practise it.",
      cards: [],
      sources: ["/interview/python?question=python-parallelism"],
      suggested_prompts: [],
      learning_map: {
        title: "Python parallelism",
        nodes: [{
          id: "parallelism",
          title: "Parallelism",
          summary: "Compare processes with cooperative concurrency.",
          kind: "concept",
          source_path: "/interview/python?question=python-parallelism",
          duration_minutes: 15,
        }],
        edges: [],
      },
    },
  };
}

async function withFetch(payload: unknown, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json(payload)) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("learning-path proxy preserves bounded deep execution diagnostics", async () => {
  await withFetch(richProviderPayload(), async () => {
    const response = await handleLearningPathAi(request(), env);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      langfuseTraceUrl: string;
      totalDurationMs: number;
      workflowSteps: Array<{
        durationMs: number;
        output: Record<string, unknown>;
        decisions: Array<{ label: string; detail: string; status: string; value: unknown }>;
        payloads: Array<{ label: string; kind: string; content: string; truncated: boolean }>;
        retrievalResults: Array<{
          score: number;
          sourcePath: string;
          excerpt: string;
          rank: number;
          rawRank: number | null;
          threshold: number | null;
          matchedTokens: string[];
          titleMatchedTokens: string[];
          scoreExplanation: string | null;
        }>;
        tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
      }>;
    };

    assert.equal(body.langfuseTraceUrl, "https://cloud.langfuse.com/project/demo/traces/trace-rich-1");
    assert.equal(body.totalDurationMs, 812.5);
    assert.equal(body.workflowSteps[0].durationMs, 61.25);
    assert.equal(body.workflowSteps[0].output.strategy, "vectorize");
    assert.equal(body.workflowSteps[0].decisions[0].label, "Query embedding");
    assert.equal(body.workflowSteps[0].decisions[1].value, 0.45);
    assert.deepEqual(body.workflowSteps[0].payloads[0], {
      label: "Canonical retrieval query",
      kind: "text",
      content: "Python parallelism",
      truncated: false,
    });
    const retrieval = body.workflowSteps[0].retrievalResults[0];
    assert.equal(retrieval.score, 0.94);
    assert.equal(retrieval.rank, 1);
    assert.equal(retrieval.rawRank, 2);
    assert.equal(retrieval.threshold, 0.45);
    assert.equal(retrieval.sourcePath, "/interview/python?question=python-parallelism");
    assert.match(retrieval.excerpt, /CPU parallelism/);
    assert.match(retrieval.scoreExplanation ?? "", /accepted because/);
    assert.deepEqual(body.workflowSteps[1].tokenUsage, { inputTokens: 520, outputTokens: 180, totalTokens: 700 });
    assert.equal(body.workflowSteps[1].payloads[1].kind, "json");
  });
});

test("learning-path proxy keeps legacy rich diagnostics rollout compatible", async () => {
  const payload = richProviderPayload();
  for (const step of payload.workflow_steps) {
    delete (step as { decisions?: unknown }).decisions;
    delete (step as { payloads?: unknown }).payloads;
    for (const result of step.retrieval_results) {
      delete (result as { rank?: unknown }).rank;
      delete (result as { raw_rank?: unknown }).raw_rank;
      delete (result as { threshold?: unknown }).threshold;
      delete (result as { matched_tokens?: unknown }).matched_tokens;
      delete (result as { title_matched_tokens?: unknown }).title_matched_tokens;
      delete (result as { score_explanation?: unknown }).score_explanation;
    }
  }
  await withFetch(payload, async () => {
    const response = await handleLearningPathAi(request(), env);
    assert.equal(response.status, 200);
    const body = await response.json() as { workflowSteps: Array<{ decisions: unknown[]; payloads: unknown[]; retrievalResults: Array<{ rank: number; rawRank: null }> }> };
    assert.deepEqual(body.workflowSteps[0].decisions, []);
    assert.deepEqual(body.workflowSteps[0].payloads, []);
    assert.equal(body.workflowSteps[0].retrievalResults[0].rank, 1);
    assert.equal(body.workflowSteps[0].retrievalResults[0].rawRank, null);
  });
});

test("learning-path proxy rejects malformed deep diagnostics rather than silently downgrading them", async () => {
  const payload = richProviderPayload();
  payload.workflow_steps[0].payloads[0].content = "x".repeat(12_001);
  await withFetch(payload, async () => {
    const response = await handleLearningPathAi(request(), env);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "AI learning path service returned an invalid response." });
  });
});

test("learning-path proxy rejects insecure trace URLs", async () => {
  const payload = richProviderPayload();
  payload.langfuse_trace_url = "http://insecure.example.test/trace";
  await withFetch(payload, async () => {
    const response = await handleLearningPathAi(request(), env);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "AI learning path service returned an invalid response." });
  });
});