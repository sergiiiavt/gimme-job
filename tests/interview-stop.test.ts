import assert from "node:assert/strict";
import test from "node:test";
import { handleInterviewAi } from "../app/api/ai/interviews/route.ts";

type SessionStatus = "ACTIVE" | "STOPPED" | "COMPLETED";

function authenticatedRequest(body: unknown): Request {
  return new Request("https://gimme-job.com/api/ai/interviews", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gimmejob-auth-mode": "multi-user",
      "x-gimmejob-authenticated": "1",
      "x-gimmejob-user-id": "user-stop-test",
    },
    body: JSON.stringify(body),
  });
}

function env(database: D1Database) {
  return {
    DB: database,
    GIMMEJOB_AI_URL: "https://ai.gimme-job.internal",
    GIMMEJOB_AI_SERVICE_TOKEN: "service-token-that-is-at-least-32-characters-long",
  };
}

function sessionRow(status: SessionStatus) {
  return {
    id: "session_stop_1",
    track: "qa",
    language: "en",
    status,
    question_plan_json: JSON.stringify([{
      id: "question-1",
      question: "Explain test isolation.",
      track: "qa",
      category: "Test design",
      level: "Middle",
      prevalence: "Common",
      kind: "Theory",
    }]),
    total_questions: 1,
    created_at: "2026-08-25T20:00:00.000Z",
    updated_at: "2026-08-25T20:00:00.000Z",
    completed_at: status === "COMPLETED" ? "2026-08-25T20:05:00.000Z" : null,
  };
}

function stopDb(options: {
  status?: SessionStatus | null;
  throwOnRun?: boolean;
} = {}) {
  const status = options.status === undefined ? "ACTIVE" : options.status;
  const updates: unknown[][] = [];
  const database = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first<T>() {
          if (sql.includes("FROM user_interview_sessions")) {
            return (status ? sessionRow(status) : null) as T | null;
          }
          return null as T | null;
        },
        async run() {
          if (options.throwOnRun) throw new Error("database unavailable");
          updates.push(values);
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { database, updates };
}

test("authenticated active interview can be stopped and persisted", async () => {
  const { database, updates } = stopDb({ status: "ACTIVE" });
  const response = await handleInterviewAi(
    authenticatedRequest({ action: "stop", sessionId: "session_stop_1" }),
    env(database),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    sessionId: "session_stop_1",
    stopped: true,
    persistent: true,
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0][1], "user-stop-test");
  assert.equal(updates[0][2], "session_stop_1");
});

test("stop is idempotent for stopped and completed interviews", async () => {
  const stopped = stopDb({ status: "STOPPED" });
  const stoppedResponse = await handleInterviewAi(
    authenticatedRequest({ action: "stop", sessionId: "session_stop_1" }),
    env(stopped.database),
  );
  assert.equal(stoppedResponse.status, 200);
  assert.deepEqual(await stoppedResponse.json(), {
    sessionId: "session_stop_1",
    stopped: true,
    persistent: true,
  });
  assert.equal(stopped.updates.length, 0);

  const completed = stopDb({ status: "COMPLETED" });
  const completedResponse = await handleInterviewAi(
    authenticatedRequest({ action: "stop", sessionId: "session_stop_1" }),
    env(completed.database),
  );
  assert.equal(completedResponse.status, 200);
  assert.deepEqual(await completedResponse.json(), {
    sessionId: "session_stop_1",
    stopped: false,
    persistent: true,
  });
  assert.equal(completed.updates.length, 0);
});

test("stop validates sessions and reports persistence failures", async () => {
  const invalid = await handleInterviewAi(
    authenticatedRequest({ action: "stop", sessionId: "bad session id" }),
    env(stopDb().database),
  );
  assert.equal(invalid.status, 400);

  const missing = await handleInterviewAi(
    authenticatedRequest({ action: "stop", sessionId: "session_stop_1" }),
    env(stopDb({ status: null }).database),
  );
  assert.equal(missing.status, 404);

  const failed = await handleInterviewAi(
    authenticatedRequest({ action: "stop", sessionId: "session_stop_1" }),
    env(stopDb({ status: "ACTIVE", throwOnRun: true }).database),
  );
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: "Interview could not be stopped. Please retry." });
});

test("stopped authenticated interview cannot accept more answers", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("provider must not be called");
  }) as typeof fetch;
  try {
    const response = await handleInterviewAi(
      authenticatedRequest({
        action: "evaluate",
        sessionId: "session_stop_1",
        questionId: "question-1",
        answer: "An answer after stop.",
      }),
      env(stopDb({ status: "STOPPED" }).database),
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Interview session is no longer active." });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
