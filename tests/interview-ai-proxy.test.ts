import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleInterviewAi } from "../app/api/ai/interviews/route.ts";

type Query = { sql: string; values: unknown[] };

type FakeDbOptions = {
  first?: (sql: string, values: unknown[]) => Record<string, unknown> | null;
  all?: (sql: string, values: unknown[]) => Record<string, unknown>[];
};

function authenticatedRequest(method: "GET" | "POST", body?: unknown, userId = "user-a"): Request {
  return new Request("https://gimme-job.com/api/ai/interviews", {
    method,
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": userId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function unauthenticatedMultiUserRequest(): Request {
  return new Request("https://gimme-job.com/api/ai/interviews", {
    headers: {
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "0",
    },
  });
}

function fakeDb(options: FakeDbOptions = {}) {
  const queries: Query[] = [];
  const database = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          queries.push({ sql, values });
          return statement;
        },
        async first<T>() {
          return (options.first?.(sql, values) ?? null) as T | null;
        },
        async all<T>() {
          return { results: (options.all?.(sql, values) ?? []) as T[] };
        },
        async run() {
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, queries };
}

function aiEnv(database: D1Database) {
  return {
    DB: database,
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: "service-token-that-is-at-least-32-characters-long",
  };
}

test("AI interview API rejects unauthenticated multi-user access before calling the service", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch;
  try {
    const response = await handleInterviewAi(
      unauthenticatedMultiUserRequest(),
      aiEnv(fakeDb().database),
    );
    assert.equal(response.status, 401);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("start proxies with server-side bearer token and saves only to the authenticated tenant", async () => {
  const { database, queries } = fakeDb();
  const originalFetch = globalThis.fetch;
  let upstreamRequest: Request | null = null;
  globalThis.fetch = (async (input, init) => {
    upstreamRequest = new Request(input, init);
    return Response.json({
      request_id: "request-1",
      session_id: "session_abc12345",
      selected_count: 1,
      questions: [{
        id: "pytest-fixtures",
        question: "Explain pytest fixture scopes.",
        track: "qa",
        category: "Test Automation",
        level: "Middle",
        prevalence: "Common",
        kind: "Theory",
      }],
    });
  }) as typeof fetch;

  try {
    const response = await handleInterviewAi(
      authenticatedRequest("POST", { action: "start", track: "qa", language: "en", questionCount: 5 }),
      aiEnv(database),
    );
    assert.equal(response.status, 200);
    const payload = await response.json() as Record<string, unknown>;
    assert.equal(payload.sessionId, "session_abc12345");
    assert.equal(payload.persistent, true);

    assert.ok(upstreamRequest);
    assert.equal(upstreamRequest.headers.get("authorization"), "Bearer service-token-that-is-at-least-32-characters-long");
    assert.equal(upstreamRequest.url, "https://ai.gimme-job.internal/v1/interviews/start");
    const upstreamBody = await upstreamRequest.clone().json() as Record<string, unknown>;
    assert.equal(upstreamBody.track, "qa");
    assert.equal(upstreamBody.question_count, 5);

    const insert = queries.find((query) => query.sql.includes("INSERT INTO user_interview_sessions"));
    assert.ok(insert);
    assert.equal(insert.values[0], "user-a");
    assert.equal(insert.values[1], "session_abc12345");
    assert.doesNotMatch(JSON.stringify(payload), /service-token-that-is-at-least/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("evaluate uses the persisted session plan instead of trusting client track or category", async () => {
  const plan = [{
    id: "pytest-fixtures",
    question: "Explain pytest fixture scopes.",
    track: "qa",
    category: "Test Automation",
    level: "Middle",
    prevalence: "Common",
    kind: "Theory",
  }];
  const { database, queries } = fakeDb({
    first(sql) {
      if (sql.includes("FROM user_interview_sessions")) {
        return {
          id: "session_abc12345",
          track: "qa",
          language: "uk",
          status: "ACTIVE",
          question_plan_json: JSON.stringify(plan),
          total_questions: 1,
          created_at: "2026-08-20T00:00:00.000Z",
          updated_at: "2026-08-20T00:00:00.000Z",
          completed_at: null,
        };
      }
      if (sql.includes("SELECT id FROM user_interview_attempts")) return null;
      if (sql.includes("COUNT(*) AS answered")) return { answered: 1, average_score: 82 };
      return null;
    },
  });

  const originalFetch = globalThis.fetch;
  let upstreamBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (input, init) => {
    const request = new Request(input, init);
    upstreamBody = await request.json() as Record<string, unknown>;
    return Response.json({
      request_id: "request-2",
      session_id: "session_abc12345",
      model: "gpt-test",
      langfuse_tracing: true,
      evaluation: {
        question_id: "pytest-fixtures",
        score: 82,
        rating: "good",
        feedback: "Good answer.",
        strengths: ["scope lifetime"],
        gaps: [],
        follow_up_question: null,
        recommended_topics: [],
        reference_answer: "Function, class, module, package, session.",
        strong_answer_signals: ["function", "session"],
      },
    });
  }) as typeof fetch;

  try {
    const response = await handleInterviewAi(
      authenticatedRequest("POST", {
        action: "evaluate",
        sessionId: "session_abc12345",
        questionId: "pytest-fixtures",
        answer: "Scopes control fixture lifetime.",
        track: "python",
        language: "en",
      }),
      aiEnv(database),
    );
    assert.equal(response.status, 200);
    assert.ok(upstreamBody);
    assert.equal(upstreamBody.track, "qa");
    assert.equal(upstreamBody.language, "uk");

    const attemptInsert = queries.find((query) => query.sql.includes("INSERT INTO user_interview_attempts"));
    assert.ok(attemptInsert);
    assert.equal(attemptInsert.values[0], "user-a");
    assert.equal(attemptInsert.values[2], "session_abc12345");
    assert.equal(attemptInsert.values[5], "Test Automation");
    assert.equal(attemptInsert.values[8], 82);

    const completionUpdate = queries.find((query) => query.sql.includes("UPDATE user_interview_sessions"));
    assert.ok(completionUpdate);
    assert.equal(completionUpdate.values[0], "COMPLETED");
    assert.equal(completionUpdate.values[3], "user-a");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("evaluate rejects a question outside the authenticated user's session without an LLM call", async () => {
  const plan = [{
    id: "allowed-question",
    question: "Allowed?",
    track: "qa",
    category: "General",
    level: "Middle",
    prevalence: "Common",
    kind: "Theory",
  }];
  const { database } = fakeDb({
    first(sql) {
      if (sql.includes("FROM user_interview_sessions")) {
        return {
          id: "session_abc12345",
          language: "en",
          status: "ACTIVE",
          question_plan_json: JSON.stringify(plan),
          total_questions: 1,
        };
      }
      return null;
    },
  });
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("must not run");
  }) as typeof fetch;
  try {
    const response = await handleInterviewAi(
      authenticatedRequest("POST", {
        action: "evaluate",
        sessionId: "session_abc12345",
        questionId: "other-question",
        answer: "Answer",
      }),
      aiEnv(database),
    );
    assert.equal(response.status, 400);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("progress aggregation remains tenant-scoped", async () => {
  const { database, queries } = fakeDb({
    all(sql) {
      if (sql.includes("FROM user_interview_sessions")) {
        return [{
          id: "session-1",
          track: "qa",
          language: "en",
          status: "COMPLETED",
          total_questions: 5,
          answered_questions: 5,
          average_score: 74,
          created_at: "2026-08-19T00:00:00.000Z",
          updated_at: "2026-08-20T00:00:00.000Z",
          completed_at: "2026-08-20T00:00:00.000Z",
        }];
      }
      return [{
        track: "qa",
        category: "API",
        attempts: 3,
        average_score: 58,
        last_attempted_at: "2026-08-20T00:00:00.000Z",
      }];
    },
  });

  const response = await handleInterviewAi(authenticatedRequest("GET", undefined, "user-b"), aiEnv(database));
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(payload.persistent, true);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries.map((query) => query.values), [["user-b"], ["user-b"]]);
  assert.ok(queries.every((query) => /WHERE (s\.)?user_id = \?/.test(query.sql)));
});

test("interview simulator migration stores private sessions and attempts per user", async () => {
  const sql = await readFile(new URL("../drizzle/0015_interview_simulator.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE `user_interview_sessions`/);
  assert.match(sql, /PRIMARY KEY \(`user_id`, `id`\)/);
  assert.match(sql, /CREATE TABLE `user_interview_attempts`/);
  assert.match(sql, /FOREIGN KEY \(`user_id`, `session_id`\) REFERENCES `user_interview_sessions`/);
  assert.match(sql, /user_interview_attempts_user_session_question_unique/);
});
