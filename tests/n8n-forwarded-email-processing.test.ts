import assert from "node:assert/strict";
import test from "node:test";
import {
  handleEmailClassificationUpdate,
  handlePendingEmailEvents,
} from "../app/internal/n8n/email-events/route.ts";

const TOKEN = "test-ingest-token-that-is-long-enough";

type PendingRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_message_id: string;
  received_at: string;
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
  processing_status: string;
  processing_attempts: number;
};

type FakeDbOptions = {
  rows?: PendingRow[];
  existingClassification?: string | null;
  fail?: boolean;
};

function authorizedRequest(
  url = "https://gimme-job.com/internal/n8n/email-events",
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Request {
  const headers = new Headers();
  const token = options.token === undefined ? TOKEN : options.token;
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");

  return new Request(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function fakeDb(options: FakeDbOptions = {}) {
  const state = {
    allSql: [] as string[],
    allBindings: [] as unknown[][],
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
        async all<T>() {
          if (options.fail) throw new Error("database unavailable");
          state.allSql.push(sql);
          state.allBindings.push(values);
          return { success: true, results: (options.rows ?? []) as T[] };
        },
        async first<T>() {
          if (options.fail) throw new Error("database unavailable");
          if (sql.includes("SELECT classification FROM user_email_events")) {
            if (options.existingClassification === undefined || options.existingClassification === null) return null;
            return { classification: options.existingClassification } as T;
          }
          return null;
        },
        async run() {
          if (options.fail) throw new Error("database unavailable");
          state.runSql.push(sql);
          state.runBindings.push(values);
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  return { db, state };
}

test("pending-email endpoint exposes only due work and bounded structured email data", async () => {
  const { db, state } = fakeDb({
    rows: [{
      id: "evt_123",
      user_id: "user_123",
      provider: "email_forwarding",
      provider_message_id: "message-123",
      received_at: "2026-08-16T00:30:00.000Z",
      sender_name: null,
      sender_email: "recruiter@example.com",
      subject: "Interview invitation",
      text_excerpt: "Please join us for a technical interview next Tuesday.",
      processing_status: "PENDING",
      processing_attempts: 0,
    }],
  });

  const response = await handlePendingEmailEvents(
    authorizedRequest("https://gimme-job.com/internal/n8n/email-events?limit=500"),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    events: [{
      id: "evt_123",
      userId: "user_123",
      provider: "email_forwarding",
      providerMessageId: "message-123",
      receivedAt: "2026-08-16T00:30:00.000Z",
      senderName: null,
      senderEmail: "recruiter@example.com",
      subject: "Interview invitation",
      textExcerpt: "Please join us for a technical interview next Tuesday.",
      processingStatus: "PENDING",
      processingAttempts: 0,
    }],
  });
  assert.match(state.allSql[0] ?? "", /processing_status IN \('PENDING', 'RETRY', 'HOLD'\)/);
  assert.equal(state.allBindings[0]?.at(-1), 100);
});

test("pending-email endpoint fails closed and validates the limit", async () => {
  const { db } = fakeDb();

  const missingToken = await handlePendingEmailEvents(
    authorizedRequest(undefined, { token: null }),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(missingToken.status, 401);

  const missingConfiguration = await handlePendingEmailEvents(
    authorizedRequest(),
    { DB: db },
  );
  assert.equal(missingConfiguration.status, 503);

  for (const value of ["0", "abc", "-1"] as const) {
    const response = await handlePendingEmailEvents(
      authorizedRequest(`https://gimme-job.com/internal/n8n/email-events?limit=${value}`),
      { DB: db, N8N_INGEST_TOKEN: TOKEN },
    );
    assert.equal(response.status, 400);
  }
});

test("legacy PATCH endpoint still stores structured classification and finalizes processing state", async () => {
  const { db, state } = fakeDb({ existingClassification: "UNCLASSIFIED" });
  const response = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: {
        userId: "user_123",
        id: "evt_123",
        classification: "interview",
        confidence: 0.96,
        source: "OPENAI:gpt-5.6",
        summary: "Technical interview invitation for Senior QA Engineer.",
        company: "Example Corp",
        jobTitle: "Senior QA Engineer",
        recruiterName: "Anna Smith",
        action: "PREPARE_INTERVIEW",
      },
    }),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.classification, "INTERVIEW");
  assert.equal(payload.changed, true);
  assert.match(state.runSql[0] ?? "", /processing_status = 'CLASSIFIED'/);
  const values = state.runBindings[0]!;
  assert.equal(values[0], "INTERVIEW");
  assert.equal(values[1], 0.96);
  assert.equal(values[2], "OPENAI:gpt-5.6");
  assert.equal(values[10], "user_123");
  assert.equal(values[11], "evt_123");
  assert.equal(values[12], "INTERVIEW");
});

test("classification endpoint accepts NON_JOB and remains idempotent", async () => {
  const first = fakeDb({ existingClassification: "UNCLASSIFIED" });
  const response = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: { userId: "user_123", id: "evt_123", classification: "NON_JOB", action: "NO_ACTION" },
    }),
    { DB: first.db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(response.status, 200);

  const repeated = fakeDb({ existingClassification: "NON_JOB" });
  const repeatedResponse = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: { userId: "user_123", id: "evt_123", classification: "NON_JOB", action: "NO_ACTION" },
    }),
    { DB: repeated.db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(repeatedResponse.status, 200);
  assert.equal((await repeatedResponse.json()).changed, false);
});

test("classification endpoint never overwrites a different classification", async () => {
  const conflict = fakeDb({ existingClassification: "REJECTION" });
  const response = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: { userId: "user_123", id: "evt_123", classification: "INTERVIEW" },
    }),
    { DB: conflict.db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "Email event is already classified." });
  assert.equal(conflict.state.runBindings.length, 0);
});
