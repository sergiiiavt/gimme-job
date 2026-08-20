import assert from "node:assert/strict";
import test from "node:test";
import { handleInterviewAi } from "../app/api/ai/interviews/route.ts";

type Row = Record<string, unknown>;
type Operation = "first" | "all" | "run";
type DbHandler = (sql: string, values: unknown[], operation: Operation) => Row | Row[] | null | void;

const SERVICE_TOKEN = "service-token-that-is-at-least-32-characters-long";

function request(method: string, body?: unknown, authenticated = true): Request {
  return new Request("https://gimme-job.com/api/ai/interviews", {
    method,
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": authenticated ? "1" : "0",
      ...(authenticated ? { "x-gimmejob-user-id": "user-errors" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawRequest(body: string): Request {
  return new Request("https://gimme-job.com/api/ai/interviews", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-errors",
    },
    body,
  });
}

function fakeDb(handler: DbHandler = () => null): D1Database {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first<T>() {
          return (handler(sql, values, "first") ?? null) as T | null;
        },
        async all<T>() {
          const result = handler(sql, values, "all");
          return { results: (Array.isArray(result) ? result : []) as T[] };
        },
        async run() {
          handler(sql, values, "run");
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

function env(database: D1Database = fakeDb(), overrides: Record<string, unknown> = {}) {
  return {
    DB: database,
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: SERVICE_TOKEN,
    ...overrides,
  };
}

function validQuestion() {
  return {
    id: "question-1",
    question: "Explain a reliable automated test.",
    track: "qa",
    category: "Automation",
    level: "Middle",
    prevalence: "Common",
    kind: "Theory",
  };
}

function activeSession(question = validQuestion()): Row {
  return {
    id: "session_valid",
    track: question.track,
    language: "en",
    status: "ACTIVE",
    question_plan_json: JSON.stringify([question]),
    total_questions: 1,
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
    completed_at: null,
  };
}

function successfulEvaluation(score: unknown = 80): Record<string, unknown> {
  return {
    request_id: "provider-request",
    session_id: "session_valid",
    model: "gpt-test",
    langfuse_tracing: false,
    evaluation: {
      question_id: "question-1",
      score,
      rating: "good",
      feedback: "Good core answer.",
      strengths: ["reliability"],
      gaps: [],
      follow_up_question: null,
      recommended_topics: [],
      reference_answer: "A reliable test is deterministic and isolated.",
      strong_answer_signals: ["deterministic", "isolated"],
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

test("rejects unsupported HTTP methods", async () => {
  const response = await handleInterviewAi(request("PUT"), env());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, POST");
});

test("rejects malformed and non-object JSON bodies", async () => {
  const malformed = await handleInterviewAi(rawRequest("{"), env());
  assert.equal(malformed.status, 400);

  const arrayBody = await handleInterviewAi(rawRequest("[]"), env());
  assert.equal(arrayBody.status, 400);
});

test("rejects unsupported actions without contacting AI service", async () => {
  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", { action: "delete" }), env());
    assert.equal(response.status, 400);
  });
  assert.equal(called, false);
});

test("validates interview setup before provider call", async () => {
  let called = false;
  await withFetch((async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch, async () => {
    const badTrack = await handleInterviewAi(request("POST", { action: "start", track: "security" }), env());
    assert.equal(badTrack.status, 400);
    const badLanguage = await handleInterviewAi(request("POST", { action: "start", language: "de" }), env());
    assert.equal(badLanguage.status, 400);
  });
  assert.equal(called, false);
});

test("sanitizes start filters and clamps question count", async () => {
  let providerBody: Record<string, unknown> | null = null;
  await withFetch((async (input, init) => {
    const providerRequest = new Request(input, init);
    providerBody = await providerRequest.json() as Record<string, unknown>;
    return Response.json({
      session_id: "session_filters",
      questions: [validQuestion()],
    });
  }) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", {
      action: "start",
      track: "qa",
      language: "en",
      questionCount: 999,
      levels: ["Senior", "NotALevel", 42],
      categories: ["API", "", 123, "Automation"],
    }), env());
    assert.equal(response.status, 200);
  });

  assert.ok(providerBody);
  assert.equal(providerBody.question_count, 20);
  assert.deepEqual(providerBody.levels, ["Senior"]);
  assert.deepEqual(providerBody.categories, ["API", "Automation"]);
});

test("returns 503 when AI service configuration is missing or insecure", async () => {
  const missing = await handleInterviewAi(
    request("POST", { action: "start" }),
    env(fakeDb(), { GIMMEJOB_AI_URL: undefined, GIMMEJOB_AI_SERVICE_TOKEN: undefined }),
  );
  assert.equal(missing.status, 503);

  const insecure = await handleInterviewAi(
    request("POST", { action: "start" }),
    env(fakeDb(), { GIMMEJOB_AI_URL: "http://remote.example" }),
  );
  assert.equal(insecure.status, 503);
});

test("allows local HTTP AI service for development", async () => {
  let providerUrl = "";
  await withFetch((async (input) => {
    providerUrl = String(input);
    return Response.json({ session_id: "session_local", questions: [validQuestion()] });
  }) as typeof fetch, async () => {
    const response = await handleInterviewAi(
      request("POST", { action: "start" }),
      env(fakeDb(), { GIMMEJOB_AI_URL: "http://127.0.0.1:8000" }),
    );
    assert.equal(response.status, 200);
  });
  assert.equal(providerUrl, "http://127.0.0.1:8000/v1/interviews/start");
});

test("maps provider network failures and provider errors safely", async () => {
  await withFetch((async () => {
    throw new Error("network down");
  }) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", { action: "start" }), env());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "AI interview service is temporarily unavailable." });
  });

  await withFetch((async () => Response.json({ detail: "No matching questions." }, { status: 422 })) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", { action: "start" }), env());
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: "No matching questions." });
  });
});

test("rejects invalid interview sessions returned by provider", async () => {
  await withFetch((async () => Response.json({ session_id: "bad session", questions: [validQuestion()] })) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", { action: "start" }), env());
    assert.equal(response.status, 502);
  });

  await withFetch((async () => Response.json({ session_id: "session_empty", questions: [{ id: "", track: "qa" }] })) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", { action: "start" }), env());
    assert.equal(response.status, 502);
  });
});

test("returns 500 when a started interview cannot be persisted", async () => {
  const database = fakeDb((sql, _values, operation) => {
    if (operation === "run" && sql.includes("INSERT INTO user_interview_sessions")) throw new Error("D1 unavailable");
    return null;
  });
  await withFetch((async () => Response.json({ session_id: "session_save", questions: [validQuestion()] })) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", { action: "start" }), env(database));
    assert.equal(response.status, 500);
  });
});

test("rejects malformed interview answers before database or provider work", async () => {
  const cases = [
    { sessionId: "bad session", questionId: "question-1", answer: "answer" },
    { sessionId: "session_valid", questionId: "", answer: "answer" },
    { sessionId: "session_valid", questionId: "question-1", answer: "   " },
    { sessionId: "session_valid", questionId: "question-1", answer: "x".repeat(20_001) },
  ];
  for (const body of cases) {
    const response = await handleInterviewAi(request("POST", { action: "evaluate", ...body }), env());
    assert.equal(response.status, 400);
  }
});

test("handles missing, completed, malformed, and duplicate persisted sessions", async () => {
  const missing = fakeDb(() => null);
  const missingResponse = await handleInterviewAi(request("POST", {
    action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
  }), env(missing));
  assert.equal(missingResponse.status, 404);

  const completed = fakeDb((sql, _values, operation) => {
    if (operation === "first" && sql.includes("FROM user_interview_sessions")) return { ...activeSession(), status: "COMPLETED" };
    return null;
  });
  const completedResponse = await handleInterviewAi(request("POST", {
    action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
  }), env(completed));
  assert.equal(completedResponse.status, 409);

  const malformedPlan = fakeDb((sql, _values, operation) => {
    if (operation === "first" && sql.includes("FROM user_interview_sessions")) return { ...activeSession(), question_plan_json: "not-json" };
    return null;
  });
  const malformedResponse = await handleInterviewAi(request("POST", {
    action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
  }), env(malformedPlan));
  assert.equal(malformedResponse.status, 400);

  const duplicate = fakeDb((sql, _values, operation) => {
    if (operation !== "first") return null;
    if (sql.includes("FROM user_interview_sessions")) return activeSession();
    if (sql.includes("SELECT id FROM user_interview_attempts")) return { id: "attempt-existing" };
    return null;
  });
  const duplicateResponse = await handleInterviewAi(request("POST", {
    action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
  }), env(duplicate));
  assert.equal(duplicateResponse.status, 409);
});

test("rejects invalid provider evaluations and scores", async () => {
  const database = fakeDb((sql, _values, operation) => {
    if (operation === "first" && sql.includes("FROM user_interview_sessions")) return activeSession();
    return null;
  });

  await withFetch((async () => Response.json({ model: "gpt-test" })) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", {
      action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
    }), env(database));
    assert.equal(response.status, 502);
  });

  for (const badScore of [-1, 101, 50.5, "not-a-number"]) {
    await withFetch((async () => Response.json(successfulEvaluation(badScore))) as typeof fetch, async () => {
      const response = await handleInterviewAi(request("POST", {
        action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
      }), env(database));
      assert.equal(response.status, 502);
    });
  }
});

test("returns 500 when evaluated answer cannot be persisted", async () => {
  const database = fakeDb((sql, _values, operation) => {
    if (operation === "first" && sql.includes("FROM user_interview_sessions")) return activeSession();
    if (operation === "run" && sql.includes("INSERT INTO user_interview_attempts")) throw new Error("write failed");
    return null;
  });
  await withFetch((async () => Response.json(successfulEvaluation())) as typeof fetch, async () => {
    const response = await handleInterviewAi(request("POST", {
      action: "evaluate", sessionId: "session_valid", questionId: "question-1", answer: "answer",
    }), env(database));
    assert.equal(response.status, 500);
  });
});

test("legacy non-persistent mode can evaluate without D1 and returns null progress", async () => {
  const legacyRequest = new Request("https://gimme-job.com/api/ai/interviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "evaluate",
      sessionId: "session_valid",
      questionId: "question-1",
      answer: "answer",
      track: "python",
      language: "uk",
    }),
  });
  let providerBody: Record<string, unknown> | null = null;
  await withFetch((async (input, init) => {
    providerBody = await new Request(input, init).json() as Record<string, unknown>;
    return Response.json(successfulEvaluation());
  }) as typeof fetch, async () => {
    const response = await handleInterviewAi(legacyRequest, env(fakeDb(), { DB: undefined }));
    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.progress, null);
  });
  assert.ok(providerBody);
  assert.equal(providerBody.track, "python");
  assert.equal(providerBody.language, "uk");
});

test("progress GET is non-persistent without a database and reports D1 failures", async () => {
  const withoutDatabase = await handleInterviewAi(request("GET"), env(fakeDb(), { DB: undefined }));
  assert.equal(withoutDatabase.status, 200);
  assert.deepEqual(await withoutDatabase.json(), { persistent: false, recentSessions: [], areas: [] });

  const failingDatabase = fakeDb((_sql, _values, operation) => {
    if (operation === "all") throw new Error("read failed");
    return null;
  });
  const failed = await handleInterviewAi(request("GET"), env(failingDatabase));
  assert.equal(failed.status, 500);
});
