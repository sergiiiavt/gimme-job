import assert from "node:assert/strict";
import test from "node:test";
import { handleInterviewAi } from "../app/api/ai/interviews/route.ts";
import { handleLearningPathAi } from "../app/api/ai/learning-path/route.ts";

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";

function ephemeralRequest(path: string, method: "GET" | "POST", body?: unknown): Request {
  return new Request(`https://gimme-job.com${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "0",
      "x-gimmejob-session-scope": "ephemeral",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function forbiddenDb(): D1Database {
  return {
    prepare() {
      throw new Error("ephemeral public sessions must not touch D1");
    },
  } as unknown as D1Database;
}

function interviewEnv() {
  return {
    DB: forbiddenDb(),
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
  };
}

function learningEnv() {
  return {
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
  };
}

function learningPayload() {
  return {
    request_id: "request_public",
    session_id: "session_public",
    model: "gpt-test",
    langfuse_tracing: true,
    orchestration: "langgraph",
    retrieval_mode: "repository",
    workflow_steps: [{ id: "compose", label: "Compose", detail: "Build a source-backed path." }],
    response: {
      answer: "Start with the foundation and then practice.",
      cards: [],
      sources: [],
      suggested_prompts: [],
      learning_map: {
        title: "Public learning path",
        nodes: [{
          id: "foundation",
          title: "Foundation",
          summary: "Learn the core concept.",
          kind: "foundation",
          source_path: null,
          duration_minutes: 10,
        }],
        edges: [],
      },
    },
  };
}

function interviewQuestion() {
  return {
    id: "question_public",
    question: "Explain test isolation.",
    track: "qa",
    category: "Test design",
    level: "Middle",
    prevalence: "Common",
    kind: "Theory",
  };
}

function evaluationPayload() {
  return {
    session_id: "session_public",
    model: "gpt-test",
    langfuse_tracing: true,
    evaluation: {
      question_id: "question_public",
      score: 80,
      rating: "good",
      feedback: "Good answer.",
      strengths: ["isolation"],
      gaps: [],
      follow_up_question: null,
      recommended_topics: [],
      reference_answer: "Keep tests independent and reset shared state.",
      strong_answer_signals: ["independent"],
    },
  };
}

async function withFetch<T>(implementation: typeof fetch, action: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    return await action();
  } finally {
    globalThis.fetch = original;
  }
}

test("public Learning Path Advisor accepts explicit ephemeral scope", async () => {
  let upstream: Request | null = null;
  await withFetch((async (input, init) => {
    upstream = new Request(input, init);
    return Response.json(learningPayload());
  }) as typeof fetch, async () => {
    const response = await handleLearningPathAi(
      ephemeralRequest("/api/ai/learning-path", "POST", {
        messages: [{ role: "user", content: "Teach me test isolation" }],
      }),
      learningEnv(),
    );
    assert.equal(response.status, 200);
    assert.ok(upstream);
    assert.equal(upstream.headers.get("authorization"), `Bearer ${SERVICE_TOKEN}`);
    const payload = await response.json() as Record<string, unknown>;
    assert.equal(payload.sessionId, "session_public");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("public interview progress is empty and non-persistent", async () => {
  const response = await handleInterviewAi(
    ephemeralRequest("/api/ai/interviews", "GET"),
    interviewEnv(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    persistent: false,
    recentSessions: [],
    areas: [],
  });
});

test("public interview start, evaluate, and stop stay outside D1", async () => {
  const providerBodies: Record<string, unknown>[] = [];
  await withFetch((async (input, init) => {
    const request = new Request(input, init);
    providerBodies.push(await request.clone().json() as Record<string, unknown>);
    if (request.url.endsWith("/v1/interviews/start")) {
      return Response.json({
        session_id: "session_public",
        questions: [interviewQuestion()],
      });
    }
    if (request.url.endsWith("/v1/interviews/evaluate")) return Response.json(evaluationPayload());
    throw new Error(`unexpected upstream URL: ${request.url}`);
  }) as typeof fetch, async () => {
    const start = await handleInterviewAi(
      ephemeralRequest("/api/ai/interviews", "POST", {
        action: "start",
        track: "qa",
        language: "en",
        questionCount: 5,
      }),
      interviewEnv(),
    );
    assert.equal(start.status, 200);
    const started = await start.json() as Record<string, unknown>;
    assert.equal(started.persistent, false);
    assert.equal(started.sessionId, "session_public");

    const evaluate = await handleInterviewAi(
      ephemeralRequest("/api/ai/interviews", "POST", {
        action: "evaluate",
        sessionId: "session_public",
        questionId: "question_public",
        track: "qa",
        language: "en",
        answer: "Each test controls and cleans its shared state.",
      }),
      interviewEnv(),
    );
    assert.equal(evaluate.status, 200);
    const evaluated = await evaluate.json() as { progress: unknown };
    assert.equal(evaluated.progress, null);

    const stop = await handleInterviewAi(
      ephemeralRequest("/api/ai/interviews", "POST", {
        action: "stop",
        sessionId: "session_public",
      }),
      interviewEnv(),
    );
    assert.equal(stop.status, 200);
    assert.deepEqual(await stop.json(), {
      sessionId: "session_public",
      stopped: true,
      persistent: false,
    });
  });

  assert.equal(providerBodies.length, 2);
  assert.equal(providerBodies[1].track, "qa");
  assert.equal(providerBodies[1].language, "en");
});
