import assert from "node:assert/strict";
import test from "node:test";
import { forwardingAddress, handleForwardedEmail } from "../worker/email-forwarding.ts";

function fakeDb(userId: string | null) {
  const state = { inserted: [] as unknown[][] };
  const db = {
    prepare(sql: string) {
      const text = sql.replace(/\s+/g, " ").trim();
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; return statement; },
        async first() {
          if (text.includes("FROM email_ingest_aliases")) return userId ? { user_id: userId } : null;
          return null;
        },
        async run() {
          if (text.startsWith("INSERT INTO user_email_events")) state.inserted.push(statement.values);
          return { success: true };
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, state };
}

function message(to: string) {
  const state = { rejected: "" };
  return {
    state,
    value: {
      from: "recruiter@example.com",
      to,
      rawSize: 1234,
      headers: new Headers({
        subject: "QA Engineer interview",
        date: "Sat, 15 Aug 2026 20:00:00 GMT",
        "message-id": "<message-1@example.com>",
      }),
      setReject(reason: string) { state.rejected = reason; },
    },
  };
}

test("forwarding aliases use one shared subaddressing route", () => {
  assert.equal(forwardingAddress("abc123def456"), "jobs+abc123def456@gimme-job.com");
});

test("forwarded email metadata is written only to the resolved tenant", async () => {
  const { db, state } = fakeDb("user-a");
  const incoming = message("jobs+abc123def456@gimme-job.com");
  await handleForwardedEmail(incoming.value, { DB: db });
  assert.equal(incoming.state.rejected, "");
  assert.equal(state.inserted.length, 1);
  assert.equal(state.inserted[0]![1], "user-a");
  assert.equal(state.inserted[0]![2], "<message-1@example.com>");
  assert.equal(state.inserted[0]![4], "recruiter@example.com");
  assert.equal(state.inserted[0]![5], "QA Engineer interview");
});

test("unknown forwarding aliases are rejected before storage", async () => {
  const { db, state } = fakeDb(null);
  const incoming = message("jobs+unknownalias12@gimme-job.com");
  await handleForwardedEmail(incoming.value, { DB: db });
  assert.match(incoming.state.rejected, /Unknown GimmeJob forwarding address/);
  assert.equal(state.inserted.length, 0);
});
