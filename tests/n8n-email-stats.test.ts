import assert from "node:assert/strict";
import test from "node:test";
import { handleEmailStats, localMidnightUtc } from "../app/internal/n8n/email-stats/route.ts";

const TOKEN = "test-ingest-token-that-is-long-enough";

function request(query = "", token: string | null = TOKEN): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(`https://gimme-job.com/internal/n8n/email-stats${query}`, { headers });
}

function fakeDb() {
  const bindings: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          bindings.push({ sql, values });
          return statement;
        },
        async first<T>() {
          return {
            received: 20,
            processed: 18,
            pending: 1,
            job_relevant: 5,
            job_alerts: 4,
            non_job: 3,
            service_messages: 6,
            held: 1,
            failed: 0,
            needs_review: 6,
            rule_processed: 13,
            ai_processed: 5,
            ai_input_tokens: 4000,
            ai_output_tokens: 600,
            ai_total_tokens: 4600,
          } as T;
        },
        async all<T>() {
          if (sql.includes("GROUP BY classification")) {
            return {
              success: true,
              results: [
                { classification: "SERVICE_MESSAGE", count: 6 },
                { classification: "INTERVIEW", count: 2 },
              ] as T[],
            };
          }
          return {
            success: true,
            results: [
              {
                id: "evt_1",
                user_id: "usr_1",
                received_at: "2026-08-18T10:00:00.000Z",
                sender_name: "Recruiter",
                sender_email: "recruiter@example.com",
                subject: "Technical interview",
                classification: "INTERVIEW",
                classification_confidence: 0.97,
                classification_source: "OPENAI:gpt-5.6",
                summary: "Technical interview invitation.",
                company: "Example Corp",
                job_title: "QA Lead",
                recruiter_name: "Anna",
                action: "PREPARE_INTERVIEW",
              },
            ] as T[],
          };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { db, bindings };
}

test("Kyiv daily report boundaries follow local midnight in summer and winter", () => {
  assert.equal(localMidnightUtc("2026-08-18"), "2026-08-17T21:00:00.000Z");
  assert.equal(localMidnightUtc("2026-01-18"), "2026-01-17T22:00:00.000Z");
});

test("daily stats returns job relevance, routing, AI usage, and important events", async () => {
  const { db, bindings } = fakeDb();
  const response = await handleEmailStats(
    request("?date=2026-08-18&userId=usr_1"),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    date: "2026-08-18",
    timeZone: "Europe/Kyiv",
    userId: "usr_1",
    window: {
      startUtc: "2026-08-17T21:00:00.000Z",
      endUtc: "2026-08-18T21:00:00.000Z",
    },
    totals: {
      received: 20,
      processed: 18,
      pending: 1,
      jobRelevant: 5,
      jobAlerts: 4,
      nonJob: 3,
      serviceMessages: 6,
      held: 1,
      failed: 0,
      needsReview: 6,
    },
    routing: {
      rule: 13,
      ai: 5,
      other: 0,
      aiAvoidanceRatePct: 72.2,
    },
    ai: {
      classifiedCalls: 5,
      inputTokens: 4000,
      outputTokens: 600,
      totalTokens: 4600,
    },
    byClassification: {
      SERVICE_MESSAGE: 6,
      INTERVIEW: 2,
    },
    important: [{
      id: "evt_1",
      userId: "usr_1",
      receivedAt: "2026-08-18T10:00:00.000Z",
      senderName: "Recruiter",
      senderEmail: "recruiter@example.com",
      subject: "Technical interview",
      classification: "INTERVIEW",
      confidence: 0.97,
      source: "OPENAI:gpt-5.6",
      summary: "Technical interview invitation.",
      company: "Example Corp",
      jobTitle: "QA Lead",
      recruiterName: "Anna",
      action: "PREPARE_INTERVIEW",
    }],
  });

  assert.equal(bindings.length, 3);
  for (const binding of bindings) {
    assert.equal(binding.values[0], "2026-08-17T21:00:00.000Z");
    assert.equal(binding.values[1], "2026-08-18T21:00:00.000Z");
    assert.equal(binding.values[2], "usr_1");
  }
});

test("daily stats is protected by the n8n bearer token", async () => {
  const { db } = fakeDb();
  const response = await handleEmailStats(request("?date=2026-08-18", null), {
    DB: db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(response.status, 401);
});

test("daily stats validates report date", async () => {
  const { db } = fakeDb();
  const response = await handleEmailStats(request("?date=2026-02-30"), {
    DB: db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(response.status, 400);
});
