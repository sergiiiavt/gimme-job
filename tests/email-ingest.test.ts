import assert from "node:assert/strict";
import test from "node:test";
import {
  EmailEventValidationError,
  bearerToken,
  constantTimeEqual,
  normalizeEmailEvent,
} from "../app/internal/n8n/email-events/email-event.ts";
import { handleEmailEvent } from "../app/internal/n8n/email-events/route.ts";

const INGEST_TOKEN = "test-ingest-token-that-is-long-enough";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    providerMessageId: "18fabc123",
    threadId: "18fabc000",
    receivedAt: "2026-08-15T12:30:00+03:00",
    senderName: "Recruiter",
    senderEmail: "Recruiter@Example.com",
    subject: "Senior QA Engineer",
    ...overrides,
  };
}

function request(body: unknown, options: { token?: string | null; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...options.headers,
  };
  const token = options.token === undefined ? INGEST_TOKEN : options.token;
  if (token !== null) headers.authorization = `Bearer ${token}`;

  return new Request("https://gimme-job.com/internal/n8n/email-events", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeDb(options: { existing?: boolean; fail?: boolean } = {}): D1Database {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first<T>() {
          if (options.fail) throw new Error("database unavailable");
          if (sql.startsWith("SELECT") && options.existing) {
            return { id: String(values[0]) } as T;
          }
          return null;
        },
        async run() {
          if (options.fail) throw new Error("database unavailable");
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

test("normalizeEmailEvent creates a stable Gmail event without storing message body", () => {
  const event = normalizeEmailEvent(validPayload({
    classification: "interview",
    summary: "Recruiter invited me to an interview.",
    company: "Example",
    jobTitle: "Senior QA Engineer",
    recruiterName: "Recruiter",
    jobId: "job-123",
  }));

  assert.equal(event.id, "gmail:18fabc123");
  assert.equal(event.provider, "gmail");
  assert.equal(event.receivedAt, "2026-08-15T09:30:00.000Z");
  assert.equal(event.senderEmail, "recruiter@example.com");
  assert.equal(event.classification, "INTERVIEW");
  assert.equal(event.summary, "Recruiter invited me to an interview.");
  assert.equal(event.company, "Example");
  assert.equal(event.jobTitle, "Senior QA Engineer");
  assert.equal(event.recruiterName, "Recruiter");
  assert.equal(event.jobId, "job-123");
});

test("normalizeEmailEvent accepts minimal metadata and normalizes empty optional values", () => {
  const event = normalizeEmailEvent({
    providerMessageId: "message-id",
    receivedAt: "2026-08-15T12:30:00Z",
    senderEmail: "",
    subject: null,
    threadId: "   ",
    classification: "",
  });

  assert.equal(event.subject, "");
  assert.equal(event.threadId, null);
  assert.equal(event.senderEmail, null);
  assert.equal(event.classification, "UNCLASSIFIED");
});

test("normalizeEmailEvent rejects non-object, missing, oversized, and malformed values", () => {
  assert.throws(() => normalizeEmailEvent(null), EmailEventValidationError);
  assert.throws(() => normalizeEmailEvent([]), EmailEventValidationError);
  assert.throws(
    () => normalizeEmailEvent({ receivedAt: "2026-08-15T12:30:00Z" }),
    /providerMessageId is required/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ providerMessageId: "x".repeat(513) })),
    /providerMessageId is too long/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ senderName: 123 })),
    /senderName must be a string/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ senderName: "x".repeat(301) })),
    /senderName is too long/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ subject: 123 })),
    /subject must be a string/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ subject: "x".repeat(1001) })),
    /subject is too long/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ receivedAt: "not-a-date" })),
    /receivedAt must be a valid date\/time/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ classification: 123 })),
    /classification must be a string/,
  );
  assert.throws(
    () => normalizeEmailEvent(validPayload({ classification: "SPAM_THE_RECRUITER" })),
    /Unsupported classification/,
  );
});

test("normalizeEmailEvent rejects malformed sender email addresses", () => {
  for (const senderEmail of ["missing-at", "@example.com", "name@"] as const) {
    assert.throws(
      () => normalizeEmailEvent(validPayload({ senderEmail })),
      /senderEmail must be a valid email address/,
    );
  }
});

test("normalizeEmailEvent rejects every raw email body field", () => {
  for (const field of ["body", "html", "text", "textHtml", "textPlain", "raw", "snippet"] as const) {
    assert.throws(
      () => normalizeEmailEvent(validPayload({ [field]: "private message body" })),
      (error: unknown) => error instanceof EmailEventValidationError && /not accepted/.test(error.message),
    );
  }
});

test("Bearer-token helpers reject malformed, empty, or mismatched credentials", () => {
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("Basic abc"), null);
  assert.equal(bearerToken("Bearer    "), null);
  assert.equal(bearerToken("Bearer secret-token"), "secret-token");
  assert.equal(constantTimeEqual("same-secret", "same-secret"), true);
  assert.equal(constantTimeEqual("same-secret", "different-secret"), false);
  assert.equal(constantTimeEqual("short", "longer"), false);
});

test("email ingest endpoint fails closed when the integration is not configured", async () => {
  const response = await handleEmailEvent(request(validPayload()), { DB: fakeDb() });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "n8n ingest is not configured." });
});

test("email ingest endpoint rejects missing and incorrect bearer tokens", async () => {
  for (const token of [null, "wrong-token"] as const) {
    const response = await handleEmailEvent(request(validPayload(), { token }), {
      DB: fakeDb(),
      N8N_INGEST_TOKEN: INGEST_TOKEN,
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("www-authenticate"), "Bearer");
  }
});

test("email ingest endpoint requires D1 after authentication", async () => {
  const response = await handleEmailEvent(request(validPayload()), {
    N8N_INGEST_TOKEN: INGEST_TOKEN,
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Cloud database is not available." });
});

test("email ingest endpoint rejects oversized and invalid JSON requests", async () => {
  const oversized = await handleEmailEvent(
    request({ padding: "x".repeat(33 * 1024) }),
    { DB: fakeDb(), N8N_INGEST_TOKEN: INGEST_TOKEN },
  );
  assert.equal(oversized.status, 413);

  const invalidJson = await handleEmailEvent(
    request("{not-json"),
    { DB: fakeDb(), N8N_INGEST_TOKEN: INGEST_TOKEN },
  );
  assert.equal(invalidJson.status, 400);
  assert.deepEqual(await invalidJson.json(), { error: "Request body must be valid JSON." });
});

test("email ingest endpoint returns validation errors without touching storage", async () => {
  const response = await handleEmailEvent(
    request(validPayload({ body: "private body" })),
    { DB: fakeDb(), N8N_INGEST_TOKEN: INGEST_TOKEN },
  );
  assert.equal(response.status, 400);
  const payload = await response.json() as { error?: string };
  assert.match(payload.error ?? "", /not accepted/);
});

test("email ingest endpoint creates new events and idempotently updates existing ones", async () => {
  const created = await handleEmailEvent(
    request(validPayload({ classification: "recruiter" })),
    { DB: fakeDb(), N8N_INGEST_TOKEN: INGEST_TOKEN },
  );
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {
    ok: true,
    id: "gmail:18fabc123",
    created: true,
    classification: "RECRUITER",
  });

  const updated = await handleEmailEvent(
    request(validPayload({ classification: "interview" })),
    { DB: fakeDb({ existing: true }), N8N_INGEST_TOKEN: INGEST_TOKEN },
  );
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), {
    ok: true,
    id: "gmail:18fabc123",
    created: false,
    classification: "INTERVIEW",
  });
});

test("email ingest endpoint converts database failures to a safe 500 response", async () => {
  const response = await handleEmailEvent(
    request(validPayload()),
    { DB: fakeDb({ fail: true }), N8N_INGEST_TOKEN: INGEST_TOKEN },
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Failed to store email event." });
});
