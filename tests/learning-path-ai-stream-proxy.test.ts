import assert from "node:assert/strict";
import test from "node:test";
import { handleLearningPathAiStream } from "../app/api/ai/learning-path/stream/route.ts";

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

function request(
  body: unknown,
  options: { authenticated?: boolean; method?: string; multiUser?: boolean; userId?: string; ephemeral?: boolean } = {},
): Request {
  const method = options.method ?? "POST";
  const multiUser = options.multiUser ?? true;
  return new Request("https://gimme-job.com/api/ai/learning-path/stream", {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.ephemeral ? { "x-gimmejob-session-scope": "ephemeral" } : {}),
      ...(multiUser ? {
        "x-gimmejob-auth-mode": "multi-user",
        "x-gimmejob-authenticated": options.authenticated === false ? "0" : "1",
        ...(options.userId === "" ? {} : { "x-gimmejob-user-id": options.userId ?? "user-a" }),
      } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function sseResponse(frames: unknown[], status = 200): Response {
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
  return new Response(body, {
    status,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
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

test("learning-path stream proxy rejects unauthenticated multi-user access before upstream fetch", async () => {
  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAiStream(
      request(
        { messages: [{ role: "user", content: "Python parallelism" }] },
        { authenticated: false, userId: "" },
      ),
      env(),
    );
    assert.equal(response.status, 401);
    assert.equal(called, false);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
});

test("learning-path stream proxy forwards SSE with server-only credentials", async () => {
  let upstreamRequest: Request | null = null;
  const frames = [
    { type: "trace.start", sequence: 1, elapsed_ms: 0.1, request_id: "request-1" },
    { type: "node.start", sequence: 2, elapsed_ms: 0.2, node_id: "contextualize_query" },
    { type: "trace.complete", sequence: 3, elapsed_ms: 10, total_duration_ms: 10 },
    { type: "result", sequence: 4, elapsed_ms: 10, payload: { request_id: "request-1" } },
  ];

  await withFetch((async (input, init) => {
    upstreamRequest = new Request(input, init);
    return sseResponse(frames);
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAiStream(request({
      messages: [
        { role: "user", content: "Python parallelism" },
        { role: "assistant", content: "Which aspect?" },
        { role: "user", content: "How should I learn it?" },
      ],
      sessionId: "session_1",
    }), env());

    assert.equal(response.status, 200);
    assert.ok(upstreamRequest);
    assert.equal(upstreamRequest.url, "https://ai.gimme-job.internal/v1/learning-path/stream");
    assert.equal(upstreamRequest.headers.get("authorization"), `Bearer ${SERVICE_TOKEN}`);
    assert.equal(upstreamRequest.headers.get("accept"), "text/event-stream");
    assert.deepEqual(await upstreamRequest.json(), {
      messages: [
        { role: "user", content: "Python parallelism" },
        { role: "assistant", content: "Which aspect?" },
        { role: "user", content: "How should I learn it?" },
      ],
      session_id: "session_1",
    });

    assert.match(response.headers.get("content-type") ?? "", /^text\/event-stream/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    const body = await response.text();
    for (const frame of frames) assert.match(body, new RegExp(JSON.stringify(frame).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(body, /service-token/);
  });
});

test("learning-path stream proxy supports ephemeral public scope and selected language", async () => {
  let upstreamRequest: Request | null = null;
  await withFetch((async (input, init) => {
    upstreamRequest = new Request(input, init);
    return sseResponse([{ type: "result", sequence: 1, elapsed_ms: 1, payload: {} }]);
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAiStream(
      request(
        { messages: [{ role: "user", content: "Explain queues" }], language: "uk" },
        { authenticated: false, userId: "", ephemeral: true },
      ),
      env(),
    );
    assert.equal(response.status, 200);
    assert.ok(upstreamRequest);
    const body = await upstreamRequest.json() as { messages: Array<{ role: string; content: string }> };
    assert.equal(body.messages.at(-1)?.role, "user");
    assert.ok(body.messages.some((message) => message.content === "[[gimmejob-language:uk]]"));
  });
});

test("learning-path stream proxy validates request input before upstream fetch", async (t) => {
  const cases: Array<{ name: string; body: unknown }> = [
    { name: "missing messages", body: {} },
    { name: "empty messages", body: { messages: [] } },
    { name: "assistant final message", body: { messages: [{ role: "assistant", content: "x" }] } },
    { name: "invalid language", body: { messages: [{ role: "user", content: "x" }], language: "de" } },
    { name: "invalid session", body: { messages: [{ role: "user", content: "x" }], sessionId: "bad/session" } },
    { name: "oversized content", body: { messages: [{ role: "user", content: "x".repeat(20_001) }] } },
  ];
  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    for (const item of cases) {
      await t.test(item.name, async () => {
        const response = await handleLearningPathAiStream(request(item.body), env());
        assert.equal(response.status, 400);
      });
    }
  });
  assert.equal(called, false);
});

test("learning-path stream proxy preserves rollout and provider failure semantics", async (t) => {
  await t.test("old AI image returns 404", async () => {
    await withFetch((async () => Response.json({ detail: "not found" }, { status: 404 })) as typeof fetch, async () => {
      const response = await handleLearningPathAiStream(
        request({ messages: [{ role: "user", content: "Python" }] }),
        env(),
      );
      assert.equal(response.status, 404);
      assert.match(await response.text(), /live stream is not available yet/i);
    });
  });

  await t.test("provider throttling maps to 503", async () => {
    await withFetch((async () => Response.json({ detail: `secret ${SERVICE_TOKEN}` }, { status: 429 })) as typeof fetch, async () => {
      const response = await handleLearningPathAiStream(
        request({ messages: [{ role: "user", content: "Python" }] }),
        env(),
      );
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /service-token|secret/);
    });
  });

  await t.test("network failure maps to 502", async () => {
    await withFetch((async () => { throw new Error(`network ${SERVICE_TOKEN}`); }) as typeof fetch, async () => {
      const response = await handleLearningPathAiStream(
        request({ messages: [{ role: "user", content: "Python" }] }),
        env(),
      );
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /service-token|network/);
    });
  });

  await t.test("non-SSE provider response is rejected", async () => {
    await withFetch((async () => Response.json({ unexpected: true })) as typeof fetch, async () => {
      const response = await handleLearningPathAiStream(
        request({ messages: [{ role: "user", content: "Python" }] }),
        env(),
      );
      assert.equal(response.status, 502);
      assert.match(await response.text(), /invalid live response/i);
    });
  });
});

test("learning-path stream proxy rejects incomplete or insecure service configuration", async (t) => {
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
        const response = await handleLearningPathAiStream(
          request({ messages: [{ role: "user", content: "Python" }] }),
          env(overrides),
        );
        assert.equal(response.status, 503);
      });
    }
  });
  assert.equal(called, false);
});
