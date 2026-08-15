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
};

function fakeDb(row: EventRow | null) {
  const state = { bindings: [] as unknown[][] };
  const db = {
    prepare() {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) { values = bound; return statement; },
        async first<T>() { state.bindings.push(values); return row as T | null; },
      };
      return statement;
    },
  } as unknown as D1Database;
  return { db, state };
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
    ...overrides,
  };
}

test("email classifier handles Gmail forwarding confirmation without an OpenAI call", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected OpenAI call"); }) as typeof fetch;
  try {
    const { db } = fakeDb(event({
      sender_name: null,
      sender_email: "forwarding-noreply@google.com",
      subject: "Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
      text_excerpt: null,
    }));
    const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
      DB: db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-5.6",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: "evt_123",
      userId: "user_123",
      classification: "SERVICE_MESSAGE",
      confidence: 1,
      source: "RULE",
      summary: "Gmail forwarding confirmation",
      company: null,
      jobTitle: null,
      recruiterName: null,
      action: "NO_ACTION",
    });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier uses OpenAI structured output and never trusts client-supplied email text", async () => {
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
    });
  }) as typeof fetch;

  try {
    const { db, state } = fakeDb(event({
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
      DB: db,
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
    assert.deepEqual(state.bindings, [["user_123", "evt_123"]]);

    const messages = openAiBody?.messages as Array<Record<string, unknown>> | undefined;
    const userContent = String(messages?.[1]?.content ?? "");
    assert.match(userContent, /Thank you for applying for Senior QA Engineer at Example Corp/);
    assert.doesNotMatch(userContent, /ATTACKER-CONTROLLED CLIENT VALUE/);
    assert.equal(openAiBody?.store, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier degrades to deterministic classification when OpenAI fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("upstream failure", { status: 500 })) as typeof fetch;
  try {
    const { db } = fakeDb(event({
      subject: "Update on your application",
      text_excerpt: "Unfortunately, we will not be moving forward with your application.",
    }));
    const response = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
      DB: db,
      N8N_INGEST_TOKEN: TOKEN,
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-5.6",
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.classification, "REJECTION");
    assert.equal(payload.source, "FALLBACK");
    assert.equal(payload.action, "NO_ACTION");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email classifier fails closed for bad auth, unknown events, and already-classified events", async () => {
  const { db } = fakeDb(event());
  const unauthorized = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }, "wrong-token"), {
    DB: db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(unauthorized.status, 401);

  const missing = fakeDb(null);
  const notFound = await handleEmailClassification(request({ id: "evt_missing", userId: "user_123" }), {
    DB: missing.db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(notFound.status, 404);

  const classified = fakeDb(event({ classification: "INTERVIEW" }));
  const conflict = await handleEmailClassification(request({ id: "evt_123", userId: "user_123" }), {
    DB: classified.db,
    N8N_INGEST_TOKEN: TOKEN,
  });
  assert.equal(conflict.status, 409);
});
