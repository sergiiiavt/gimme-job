import assert from "node:assert/strict";
import test from "node:test";
import { handleLearningPathAi } from "../app/api/ai/learning-path/route.ts";

type Env = {
  GIMMEJOB_AI_URL?: string;
  GIMMEJOB_AI_SERVICE_TOKEN?: string;
};

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";

function env(overrides: Partial<Env> = {}): Env {
  return {
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
    ...overrides,
  };
}

function request(body: unknown, options: { authenticated?: boolean; method?: string; multiUser?: boolean; userId?: string } = {}): Request {
  const method = options.method ?? "POST";
  const multiUser = options.multiUser ?? true;
  return new Request("https://gimme-job.com/api/ai/learning-path", {
    method,
    headers: {
      "content-type": "application/json",
      ...(multiUser ? {
        "x-gimmejob-auth-mode": "multi-user",
        "x-gimmejob-authenticated": options.authenticated === false ? "0" : "1",
        ...(options.userId === "" ? {} : { "x-gimmejob-user-id": options.userId ?? "user-a" }),
      } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function providerPayload() {
  return {
    request_id: "request-1",
    session_id: "session_1",
    model: "gpt-test",
    langfuse_tracing: true,
    orchestration: "langgraph",
    retrieval_mode: "repository",
    workflow_steps: [
      { id: "retrieve", label: "Retrieve", detail: "Matched maintained GimmeJob lessons." },
      { id: "compose", label: "Compose", detail: "Built a connected learning sequence." },
    ],
    response: {
      answer: "Start with the concurrency decision model, then compare each execution strategy.",
      cards: [{
        kind: "learning",
        title: "Python concurrency",
        summary: "A grounded path through threading, processes, and asyncio.",
        source_path: "content/python-learning/advanced-lessons.json",
      }],
      sources: ["content/python-learning/advanced-lessons.json"],
      suggested_prompts: ["Give me a practice exercise"],
      learning_map: {
        title: "Python parallelism",
        nodes: [
          {
            id: "choose",
            title: "Choose a concurrency model",
            summary: "Classify CPU-bound and I/O-bound work.",
            kind: "concept",
            source_path: "content/python-learning/advanced-lessons.json",
            duration_minutes: 10,
          },
          {
            id: "practice",
            title: "Compare implementations",
            summary: "Implement one workload with threads, processes, and asyncio.",
            kind: "practice",
            source_path: null,
            duration_minutes: null,
          },
        ],
        edges: [{ source: "choose", target: "practice", label: "then practice" }],
      },
    },
  };
}

async function withFetch(mock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("learning-path proxy rejects unauthenticated multi-user access before calling the service", async () => {
  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAi(
      request({ messages: [{ role: "user", content: "Python parallelism" }] }, { authenticated: false, userId: "" }),
      env(),
    );
    assert.equal(response.status, 401);
    assert.equal(called, false);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
});

test("learning-path proxy forwards the bounded contract with a server-only token and sanitizes its response", async () => {
  let upstreamRequest: Request | null = null;
  await withFetch((async (input, init) => {
    upstreamRequest = new Request(input, init);
    return Response.json(providerPayload());
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAi(request({
      messages: [
        { role: "user", content: "Python parallelism" },
        { role: "assistant", content: "Which aspect?" },
        { role: "user", content: "How should I learn it?" },
      ],
      sessionId: "session_1",
    }), env());

    assert.equal(response.status, 200);
    assert.ok(upstreamRequest);
    assert.equal(upstreamRequest.url, "https://ai.gimme-job.internal/v1/learning-path");
    assert.equal(upstreamRequest.headers.get("authorization"), `Bearer ${SERVICE_TOKEN}`);
    assert.deepEqual(await upstreamRequest.json(), {
      messages: [
        { role: "user", content: "Python parallelism" },
        { role: "assistant", content: "Which aspect?" },
        { role: "user", content: "How should I learn it?" },
      ],
      session_id: "session_1",
    });

    const body = await response.json() as Record<string, unknown>;
    assert.deepEqual(body, {
      requestId: "request-1",
      sessionId: "session_1",
      model: "gpt-test",
      langfuseTracing: true,
      orchestration: "langgraph",
      retrievalMode: "repository",
      workflowSteps: [
        { id: "retrieve", label: "Retrieve", detail: "Matched maintained GimmeJob lessons." },
        { id: "compose", label: "Compose", detail: "Built a connected learning sequence." },
      ],
      response: {
        answer: "Start with the concurrency decision model, then compare each execution strategy.",
        cards: [{
          kind: "learning",
          title: "Python concurrency",
          summary: "A grounded path through threading, processes, and asyncio.",
          sourcePath: "content/python-learning/advanced-lessons.json",
        }],
        sources: ["content/python-learning/advanced-lessons.json"],
        suggestedPrompts: ["Give me a practice exercise"],
        learningMap: {
          title: "Python parallelism",
          nodes: [
            {
              id: "choose",
              title: "Choose a concurrency model",
              summary: "Classify CPU-bound and I/O-bound work.",
              kind: "concept",
              sourcePath: "content/python-learning/advanced-lessons.json",
              durationMinutes: 10,
            },
            {
              id: "practice",
              title: "Compare implementations",
              summary: "Implement one workload with threads, processes, and asyncio.",
              kind: "practice",
              sourcePath: null,
              durationMinutes: null,
            },
          ],
          edges: [{ source: "choose", target: "practice", label: "then practice" }],
        },
      },
    });
    assert.doesNotMatch(JSON.stringify(body), /service-token/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("learning-path proxy allows legacy single-user mode and localhost HTTP", async () => {
  let upstreamRequest: Request | null = null;
  await withFetch((async (input, init) => {
    upstreamRequest = new Request(input, init);
    const payload = { ...providerPayload(), retrieval_mode: "general" };
    Reflect.deleteProperty(payload.response.learning_map.nodes[1], "duration_minutes");
    return Response.json(payload);
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAi(
      request({ messages: [{ role: "user", content: "Explain queues" }] }, { multiUser: false }),
      env({ GIMMEJOB_AI_URL: "http://127.0.0.1:8000/base?ignored=true#fragment" }),
    );
    assert.equal(response.status, 200);
    assert.ok(upstreamRequest);
    assert.equal(upstreamRequest.url, "http://127.0.0.1:8000/base/v1/learning-path");
    assert.deepEqual(await upstreamRequest.json(), {
      messages: [{ role: "user", content: "Explain queues" }],
      session_id: null,
    });
    const body = await response.json() as {
      retrievalMode: string;
      response: { learningMap: { nodes: Array<{ durationMinutes: number | null }> } };
    };
    assert.equal(body.retrievalMode, "general");
    assert.equal(body.response.learningMap.nodes[1].durationMinutes, null);
  });
});

test("learning-path proxy validates messages, final role, and session identifiers before fetch", async (t) => {
  const cases: Array<{ name: string; body: unknown }> = [
    { name: "missing messages", body: {} },
    { name: "empty messages", body: { messages: [] } },
    { name: "too many messages", body: { messages: Array.from({ length: 31 }, () => ({ role: "user", content: "x" })) } },
    { name: "empty content", body: { messages: [{ role: "user", content: "   " }] } },
    { name: "oversized content", body: { messages: [{ role: "user", content: "x".repeat(20_001) }] } },
    { name: "oversized conversation", body: { messages: Array.from({ length: 5 }, () => ({ role: "user", content: "x".repeat(20_000) })) } },
    { name: "unsupported role", body: { messages: [{ role: "system", content: "x" }] } },
    { name: "assistant final message", body: { messages: [{ role: "assistant", content: "x" }] } },
    { name: "invalid session characters", body: { messages: [{ role: "user", content: "x" }], sessionId: "bad/session" } },
    { name: "oversized session", body: { messages: [{ role: "user", content: "x" }], sessionId: "s".repeat(201) } },
  ];

  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    for (const item of cases) {
      await t.test(item.name, async () => {
        const response = await handleLearningPathAi(request(item.body), env());
        assert.equal(response.status, 400);
      });
    }
  });
  assert.equal(called, false);
});

test("learning-path proxy rejects insecure or incomplete service configuration", async (t) => {
  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    for (const [name, overrides] of [
      ["missing URL", { GIMMEJOB_AI_URL: undefined }],
      ["missing token", { GIMMEJOB_AI_SERVICE_TOKEN: undefined }],
      ["remote HTTP", { GIMMEJOB_AI_URL: "http://ai.example.test" }],
      ["URL credentials", { GIMMEJOB_AI_URL: "https://user:password@ai.example.test" }],
    ] as Array<[string, Partial<Env>]>) {
      await t.test(name, async () => {
        const response = await handleLearningPathAi(
          request({ messages: [{ role: "user", content: "Python" }] }),
          env(overrides),
        );
        assert.equal(response.status, 503);
      });
    }
  });
  assert.equal(called, false);
});

test("learning-path proxy maps provider and network failures to safe errors", async (t) => {
  await t.test("network failure", async () => {
    await withFetch((async () => { throw new Error(`could not reach ${SERVICE_TOKEN}`); }) as typeof fetch, async () => {
      const response = await handleLearningPathAi(request({ messages: [{ role: "user", content: "Python" }] }), env());
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /service-token|could not reach/);
    });
  });

  await t.test("provider throttling", async () => {
    await withFetch((async () => Response.json({ detail: `secret ${SERVICE_TOKEN}` }, { status: 429 })) as typeof fetch, async () => {
      const response = await handleLearningPathAi(request({ messages: [{ role: "user", content: "Python" }] }), env());
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /service-token|secret/);
    });
  });

  await t.test("provider failure", async () => {
    await withFetch((async () => Response.json({ detail: `secret ${SERVICE_TOKEN}` }, { status: 500 })) as typeof fetch, async () => {
      const response = await handleLearningPathAi(request({ messages: [{ role: "user", content: "Python" }] }), env());
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /service-token|secret/);
    });
  });
});

test("learning-path proxy rejects malformed or unbounded provider payloads", async (t) => {
  const cases: Array<{ name: string; mutate: (payload: ReturnType<typeof providerPayload>) => void }> = [
    { name: "invalid session", mutate: (payload) => { payload.session_id = "bad/session"; } },
    { name: "blank answer", mutate: (payload) => { payload.response.answer = " "; } },
    { name: "oversized answer", mutate: (payload) => { payload.response.answer = "x".repeat(20_001); } },
    { name: "unknown edge endpoint", mutate: (payload) => { payload.response.learning_map.edges[0].target = "missing"; } },
    { name: "self-loop edge", mutate: (payload) => { payload.response.learning_map.edges[0].target = "choose"; } },
    { name: "duplicate node ID", mutate: (payload) => { payload.response.learning_map.nodes[1].id = "choose"; } },
    { name: "invalid duration", mutate: (payload) => { payload.response.learning_map.nodes[0].duration_minutes = 0; } },
    { name: "excessive duration", mutate: (payload) => { payload.response.learning_map.nodes[0].duration_minutes = 241; } },
    { name: "invalid card kind", mutate: (payload) => { payload.response.cards[0].kind = "other"; } },
    { name: "invalid map kind", mutate: (payload) => { payload.response.learning_map.nodes[0].kind = "other"; } },
    {
      name: "too many map nodes",
      mutate: (payload) => {
        payload.response.learning_map.nodes = Array.from({ length: 9 }, (_, index) => ({
          id: `node-${index}`,
          title: `Node ${index}`,
          summary: "Summary",
          kind: "concept",
          source_path: null,
          duration_minutes: null,
        }));
        payload.response.learning_map.edges = [];
      },
    },
    {
      name: "too many map edges",
      mutate: (payload) => {
        payload.response.learning_map.edges = Array.from({ length: 13 }, () => ({
          source: "choose",
          target: "practice",
          label: "then practice",
        }));
      },
    },
    {
      name: "too many cards",
      mutate: (payload) => {
        payload.response.cards = Array.from({ length: 21 }, () => ({
          kind: "learning",
          title: "Title",
          summary: "Summary",
          source_path: "content/interview/python.json",
        }));
      },
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const payload = providerPayload();
      item.mutate(payload);
      await withFetch((async () => Response.json(payload)) as typeof fetch, async () => {
        const response = await handleLearningPathAi(request({ messages: [{ role: "user", content: "Python" }] }), env());
        assert.equal(response.status, 502);
        assert.equal(response.headers.get("cache-control"), "no-store");
      });
    });
  }
});

test("learning-path proxy returns a protected method error", async () => {
  const response = await handleLearningPathAi(request({}, { method: "GET", multiUser: false }), env());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
});
