import assert from "node:assert/strict";
import test from "node:test";
import { handleEmailClassification } from "../app/internal/n8n/email-classify/route.ts";

const TOKEN = "test-ingest-token-that-is-long-enough";

type EventRow = {
  id: string;
  user_id: string;
  received_at: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
  classification: string;
  classification_confidence: number | null;
  classification_source: string | null;
  summary: string | null;
  company: string | null;
  job_title: string | null;
  recruiter_name: string | null;
  action: string | null;
  processing_status: string;
  processing_started_at: string | null;
  processing_attempts: number;
};

function fakeDb(initialRow: EventRow | null, options: { denyBudget?: boolean } = {}) {
  let row = initialRow ? { ...initialRow } : null;
  const state = {
    firstBindings: [] as unknown[][],
    runSql: [] as string[],
    runBindings: [] as unknown[][],
  };

  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first<T>() {
          state.firstBindings.push(values);
          return row as T | null;
        },
        async run() {
          state.runSql.push(sql);
          state.runBindings.push(values);

          if (sql.includes("INSERT INTO email_ai_daily_usage") && options.denyBudget) {
            return { success: true, meta: { changes: 0 } };
          }

          if (sql.includes("processing_status = 'PROCESSING'") && row) {
            row.processing_status = "PROCESSING";
            row.processing_attempts += 1;
          }

          if (sql.includes("processing_status = 'CLASSIFIED'") && row) {
            row.classification = String(values[0]);
            row.classification_confidence = Number(values[1]);
            row.classification_source = String(values[2]);
            row.summary = String(values[3]);
            row.company = values[4] as string | null;
            row.job_title = values[5] as string | null;
            row.recruiter_name = values[6] as string | null;
            row.action = String(values[7]);
            row.processing_status = "CLASSIFIED";
          }

          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  return { db, state, row: () => row };
}

function request(body: unknown, token = TOKEN) {
  return new Request("https://gimme-job.com/internal/n8n/email-classify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt_123",
    user_id: "user_123",
    received_at: "2026-08-16T00:30:00.000Z",
    sender_name: "Anna Recruiter",
    sender_email: "anna@example.com",
    subject: "Senior QA Engineer",
    text_excerpt: "We would like to discuss a Senior QA Engineer opportunity with you.",
    classification: "UNCLASSIFIED",
    classification_confidence: null,
    classification_source: null,
    summary: null,
    company: null,
    job_title: null,
    recruiter_name: null,
    action: null,
    processing_status: "PENDING",
    processing_started_at: null,
    processing_attempts: 0,
    ...overrides,
  };
}

test("email classifier handles Gmail forwarding confirmation without an OpenAI call and persists it", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected OpenAI call"); }) as typeof fetch;
  try {
    const fake = fakeDb(event({
      sender_name: null,
      sender_email: "forwarding-noreply@google.com",
      subject: "Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
      text_excerpt: null,
    }));
    const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
      DB: fake.db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-5.6",
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.classification, "SERVICE_MESSAGE");
    assert.equal(payload.processingStatus, "CLASSIFIED");
    assert.equal(payload.action, "NO_ACTION");
    assert.match(payload.source, /^RULE:/);
    assert.equal(fake.row()?.classification, "SERVICE_MESSAGE");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier rejects obvious consumer promotions before OpenAI", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected OpenAI call"); }) as typeof fetch;
  try {
    const fake = fakeDb(event({
      sender_name: "GOG.com",
      sender_email: "news@gog.com",
      subject: "Your wishlist games are 75% off",
      text_excerpt: "Summer sale: save 75% on games from your wishlist.",
    }));
    const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
      DB: fake.db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.classification, "NON_JOB");
    assert.equal(payload.action, "NO_ACTION");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier uses OpenAI structured output, records usage, and never trusts client email text", async () => {
  const originalFetch = globalThis.fetch;
  let openAiBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input, init) => {
    openAiBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            classification: "APPLICATION_RECEIVED",
            confidence: 0.97,
            summary: "Application received for Senior QA Engineer at Example Corp.",
            company: "Example Corp",
            jobTitle: "Senior QA Engineer",
            recruiterName: null,
            action: "TRACK_APPLICATION",
          }),
        },
      }],
      usage: {
        prompt_tokens: 400,
        completion_tokens: 80,
        total_tokens: 480,
      },
    });
  }) as typeof fetch;

  try {
    const fake = fakeDb(event({
      sender_name: "Example Careers",
      sender_email: "careers@example.com",
      subject: "We received your application",
      text_excerpt: "Thank you for applying for Senior QA Engineer at Example Corp.",
    }));
    const response = await handleEmailClassification(request({
      id: "evt_123",
      userId: "user_123",
      textExcerpt: "ATTACKER-CONTROLLED CLIENT VALUE",
    }), {
      DB: fake.db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-5.6",
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.classification, "APPLICATION_RECEIVED");
    assert.equal(payload.confidence, 0.97);
    assert.equal(payload.source, "OPENAI:gpt-5.6");
    assert.equal(payload.company, "Example Corp");
    assert.equal(payload.action, "TRACK_APPLICATION");
    assert.equal(payload.processingStatus, "CLASSIFIED");
    assert.equal(payload.promptVersion, "email-classifier-v2");
    assert.deepEqual(payload.aiUsage, { inputTokens: 400, outputTokens: 80, totalTokens: 480 });
    assert.equal(fake.row()?.classification, "APPLICATION_RECEIVED");

    const messages = openAiBody?.messages as Array<Record<string, unknown>> | undefined;
    const userContent = String(messages?.[1]?.content ?? "");
    assert.match(userContent, /Thank you for applying for Senior QA Engineer at Example Corp/);
    assert.doesNotMatch(userContent, /ATTACKER-CONTROLLED CLIENT VALUE/);
    assert.equal(openAiBody?.store, false);
    assert.ok(fake.state.runSql.some((sql) => sql.includes("INSERT INTO email_ai_daily_usage")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier degrades to a strong deterministic hiring classification when OpenAI fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("upstream failure", { status: 500 })) as typeof fetch;
  try {
    const fake = fakeDb(event({
      subject: "Update on your application",
      text_excerpt: "Unfortunately, we will not be moving forward with your application.",
    }));
    const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
      DB: fake.db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-5.6",
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.classification, "REJECTION");
    assert.match(payload.source, /^FALLBACK:OPENAI_ERROR:/);
    assert.equal(payload.action, "NO_ACTION");
    assert.equal(fake.row()?.processing_status, "CLASSIFIED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier holds ambiguous mail when daily AI budget is exhausted", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected OpenAI call"); }) as typeof fetch;
  try {
    const fake = fakeDb(event({
      subject: "Quick follow-up",
      text_excerpt: "Can we discuss this tomorrow?",
    }), { denyBudget: true });
    const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
      DB: fake.db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
      EMAIL_AI_DAILY_USER_LIMIT: "1",
      EMAIL_AI_DAILY_GLOBAL_LIMIT: "1",
    });
    assert.equal(response.status, 202);
    const payload = await response.json();
    assert.equal(payload.processingStatus, "HOLD");
    assert.equal(payload.reason, "AI_DAILY_BUDGET_EXCEEDED");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier is idempotent for already-classified events", async () => {
  const fake = fakeDb(event({
    classification: "INTERVIEW",
    classification_confidence: 0.95,
    classification_source: "OPENAI:gpt-5.6",
    summary: "Technical interview invitation.",
    action: "PREPARE_INTERVIEW",
    processing_status: "CLASSIFIED",
  }));
  const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
    DB: fake.db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.classification, "INTERVIEW");
  assert.equal(payload.reused, true);
  assert.equal(fake.state.runSql.length, 0);
});

test("email classifier fails closed for bad auth and unknown events", async () => {
  const fake = fakeDb(event());
  const unauthorized = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }, "wrong-token"), {
    DB: fake.db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(unauthorized.status, 401);

  const missing = fakeDb(null);
  const notFound = await handleEmailClassification(request({ id: "evt_missing", userId: "user_123" }), {
    DB: missing.db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(notFound.status, 404);
});
