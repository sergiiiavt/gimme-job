import assert from "node:assert/strict";
import test from "node:test";
import {
  handleEmailClassificationUpdate,
  handlePendingEmailEvents,
} from "../app/internal/n8n/email-events/route.ts";

const TOKEN = "test-ingest-token-that-is-long-enough";

type FakeDbOptions = {
  rows?: Array<{
    id: string;
    user_id: string;
    provider: string;
    provider_message_id: string;
    received_at: string;
    sender_name: string | null;
    sender_email: string | null;
    subject: string;
  }>;
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
    allBindings: [] as unknown[][],
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
          state.runBindings.push(values);
          return { success: true };
        },
      };
      return statement;
    },
  } as unknown as D1Database;

  return { db, state };
}

test("n8n pending-email endpoint returns only structured forwarded-email metadata", async () => {
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
    }],
  });
  assert.deepEqual(state.allBindings, [[100]]);
});

test("n8n pending-email endpoint fails closed and validates the limit", async () => {
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

test("n8n classification endpoint resolves an unclassified tenant event", async () => {
  const { db, state } = fakeDb({ existingClassification: "UNCLASSIFIED" });
  const response = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: { userId: "user_123", id: "evt_123", classification: "interview" },
    }),
    { DB: db, N8N_INGEST_TOKEN: TOKEN },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    id: "evt_123",
    classification: "INTERVIEW",
    changed: true,
  });
  assert.equal(state.runBindings.length, 1);
  assert.equal(state.runBindings[0]?.[0], "INTERVIEW");
  assert.equal(state.runBindings[0]?.[2], "user_123");
  assert.equal(state.runBindings[0]?.[3], "evt_123");
});

test("n8n classification endpoint is idempotent and never overwrites another classification", async () => {
  const same = fakeDb({ existingClassification: "REJECTION" });
  const repeated = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: { userId: "user_123", id: "evt_123", classification: "REJECTION" },
    }),
    { DB: same.db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), {
    ok: true,
    id: "evt_123",
    classification: "REJECTION",
    changed: false,
  });
  assert.equal(same.state.runBindings.length, 0);

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

test("n8n classification endpoint rejects unresolved, unsupported, missing and unknown events", async () => {
  const { db, state } = fakeDb({ existingClassification: "UNCLASSIFIED" });

  for (const classification of ["UNCLASSIFIED", "SPAM"] as const) {
    const response = await handleEmailClassificationUpdate(
      authorizedRequest(undefined, {
        method: "PATCH",
        body: { userId: "user_123", id: "evt_123", classification },
      }),
      { DB: db, N8N_INGEST_TOKEN: TOKEN },
    );
    assert.equal(response.status, 400);
  }
  assert.equal(state.runBindings.length, 0);

  const unknown = fakeDb({ existingClassification: null });
  const response = await handleEmailClassificationUpdate(
    authorizedRequest(undefined, {
      method: "PATCH",
      body: { userId: "user_123", id: "evt_missing", classification: "OTHER" },
    }),
    { DB: unknown.db, N8N_INGEST_TOKEN: TOKEN },
  );
  assert.equal(response.status, 404);
});
