import assert from "node:assert/strict";
import test from "node:test";
import { handleLearningPathAi } from "../app/api/ai/learning-path/route.ts";

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";

function request(body: unknown): Request {
  return new Request("https://gimme-job.com/api/ai/learning-path", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-a",
    },
    body: JSON.stringify(body),
  });
}

function providerPayload() {
  return {
    request_id: "request-1",
    session_id: "session_1",
    model: "gpt-test",
    langfuse_tracing: false,
    orchestration: "langgraph",
    retrieval_mode: "general",
    workflow_steps: [{ id: "compose", label: "Compose", detail: "Built response." }],
    response: {
      answer: "Відповідь українською.",
      cards: [],
      sources: [],
      suggested_prompts: [],
      learning_map: {
        title: "Навчальний шлях",
        nodes: [{
          id: "topic",
          title: "Тема",
          summary: "Короткий опис.",
          kind: "topic",
          source_path: null,
          duration_minutes: null,
        }],
        edges: [],
      },
    },
  };
}

test("explicit Ukrainian selection is inserted immediately before the latest user turn", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamBody: unknown = null;
  globalThis.fetch = (async (input, init) => {
    upstreamBody = await new Request(input, init).json();
    return Response.json(providerPayload());
  }) as typeof fetch;

  try {
    const response = await handleLearningPathAi(request({
      language: "uk",
      messages: [
        { role: "user", content: "testing types" },
        { role: "assistant", content: "Previous answer" },
        { role: "user", content: "continue" },
      ],
    }), {
      GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
      GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(upstreamBody, {
      messages: [
        { role: "user", content: "testing types" },
        { role: "assistant", content: "Previous answer" },
        { role: "assistant", content: "[[gimmejob-language:uk]]" },
        { role: "user", content: "continue" },
      ],
      session_id: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid explicit response language is rejected before calling the AI service", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch;

  try {
    const response = await handleLearningPathAi(request({
      language: "de",
      messages: [{ role: "user", content: "testing types" }],
    }), {
      GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
      GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
    });

    assert.equal(response.status, 400);
    assert.equal(called, false);
    assert.match(await response.text(), /Response language/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
