import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGmailForwardingVerification,
  forwardingAddress,
  handleForwardedEmail,
} from "../worker/email-forwarding.ts";

function fakeDb(userId: string | null) {
  const state = { inserted: [] as unknown[][], verifications: [] as unknown[][], aliasLookups: 0 };
  const db = {
    prepare(sql: string) {
      const text = sql.replace(/\s+/g, " ").trim();
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; return statement; },
        async first() {
          if (text.includes("FROM email_ingest_aliases")) {
            state.aliasLookups += 1;
            return userId ? { user_id: userId } : null;
          }
          return null;
        },
        async run() {
          if (text.startsWith("INSERT INTO user_email_events")) state.inserted.push(statement.values);
          if (text.startsWith("INSERT INTO email_forwarding_verifications")) state.verifications.push(statement.values);
          return { success: true };
        },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, state };
}

function message(to: string, overrides: { from?: string; headers?: Headers; rawSize?: number; raw?: string } = {}) {
  const state = { rejected: "" };
  return {
    state,
    value: {
      from: overrides.from ?? "recruiter@example.com",
      to,
      rawSize: overrides.rawSize ?? overrides.raw?.length ?? 1234,
      raw: overrides.raw === undefined ? undefined : new Response(overrides.raw).body ?? undefined,
      headers: overrides.headers ?? new Headers({
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
  assert.equal(state.inserted[0]![3], "message-1@example.com");
  assert.equal(state.inserted[0]![4], "2026-08-15T20:00:00.000Z");
  assert.equal(state.inserted[0]![5], "recruiter@example.com");
  assert.equal(state.inserted[0]![6], "QA Engineer interview");
  assert.equal(state.verifications.length, 0);
});

test("Gmail forwarding confirmation is reduced to a temporary link/code without storing the body", async () => {
  const raw = [
    "From: Gmail Team <forwarding-noreply@google.com>",
    "Subject: Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Confirmation code: 123456789",
    "https://mail.google.com/mail/vf-token-part=3Dmore",
    "private body text that must not be stored",
  ].join("\r\n");
  const { db, state } = fakeDb("user-a");
  const incoming = message("jobs+abc123def456@gimme-job.com", {
    from: "forwarding-noreply@google.com",
    raw,
    headers: new Headers({
      subject: "Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
      date: "Sat, 15 Aug 2026 20:00:00 GMT",
      "message-id": "<verification@google.com>",
    }),
  });

  await handleForwardedEmail(incoming.value, { DB: db });
  assert.equal(state.inserted.length, 1);
  assert.equal(state.verifications.length, 1);
  const values = state.verifications[0]!;
  assert.equal(values[0], "user-a");
  assert.equal(values[1], "https://mail.google.com/mail/vf-token-part=more");
  assert.equal(values[2], "123456789");
  assert.equal(values.some((value) => String(value).includes("private body text")), false);
});

test("verification parser handles Gmail confirmation link variants", () => {
  assert.deepEqual(extractGmailForwardingVerification([
    "Confirmation code: 87654321",
    "https://mail.google.com/mail/ca/vf-abc%40example.com-token",
  ].join("\n")), {
    verificationUrl: "https://mail.google.com/mail/ca/vf-abc%40example.com-token",
    confirmationCode: "87654321",
  });
});

test("non-Google mail never causes raw-message verification capture", async () => {
  const { db, state } = fakeDb("user-a");
  const incoming = message("jobs+abc123def456@gimme-job.com", {
    from: "attacker@example.com",
    raw: "https://mail.google.com/mail/vf-fake",
    headers: new Headers({ subject: "Gmail Forwarding Confirmation", "message-id": "<fake@example.com>" }),
  });
  await handleForwardedEmail(incoming.value, { DB: db });
  assert.equal(state.verifications.length, 0);
});

test("unknown forwarding aliases are rejected before storage", async () => {
  const { db, state } = fakeDb(null);
  const incoming = message("jobs+unknownalias12@gimme-job.com");
  await handleForwardedEmail(incoming.value, { DB: db });
  assert.match(incoming.state.rejected, /Unknown GimmeJob forwarding address/);
  assert.equal(state.inserted.length, 0);
  assert.equal(state.aliasLookups, 1);
});

test("invalid recipient forms are rejected without a database lookup", async () => {
  for (const recipient of [
    "jobs@example.com",
    "jobs@gimme-job.com",
    "other+abc123def456@gimme-job.com",
    "jobs+short@gimme-job.com",
    "jobs+bad.token.value@gimme-job.com",
  ]) {
    const { db, state } = fakeDb("user-a");
    const incoming = message(recipient);
    await handleForwardedEmail(incoming.value, { DB: db });
    assert.match(incoming.state.rejected, /Unknown GimmeJob forwarding address/);
    assert.equal(state.aliasLookups, 0);
    assert.equal(state.inserted.length, 0);
  }
});

test("missing D1 rejects the message before tenant resolution", async () => {
  const incoming = message("jobs+abc123def456@gimme-job.com");
  await handleForwardedEmail(incoming.value, {});
  assert.match(incoming.state.rejected, /storage is unavailable/);
});

test("missing optional headers use safe metadata fallbacks without reading the body", async () => {
  const { db, state } = fakeDb("user-b");
  const incoming = message("jobs+abc123def456@gimme-job.com", {
    from: "  SOMEONE@EXAMPLE.COM  ",
    headers: new Headers(),
    rawSize: 55,
  });
  await handleForwardedEmail(incoming.value, { DB: db });
  assert.equal(incoming.state.rejected, "");
  assert.equal(state.inserted.length, 1);
  const values = state.inserted[0]!;
  assert.equal(values[1], "user-b");
  assert.equal(typeof values[2], "string");
  assert.match(String(values[2]), /^[A-Za-z0-9_-]{40,50}$/);
  assert.equal(typeof values[3], "string");
  assert.equal(values[3], String(values[2]).toLowerCase());
  assert.equal(typeof values[4], "string");
  assert.ok(Number.isFinite(Date.parse(String(values[4]))));
  assert.equal(values[5], "someone@example.com");
  assert.equal(values[6], "(no subject)");
});

test("oversized headers are bounded and invalid dates fall back safely", async () => {
  const { db, state } = fakeDb("user-c");
  const longSubject = `hello world${"x".repeat(1200)}`;
  const longMessageId = `<${"m".repeat(1200)}@example.com>`;
  const headers = new Headers({ subject: longSubject, date: "invalid-date", "message-id": longMessageId });
  const incoming = message("jobs+abc123def456@gimme-job.com", { headers });
  await handleForwardedEmail(incoming.value, { DB: db });
  const values = state.inserted[0]!;
  assert.equal(String(values[2]).length, 1000);
  assert.ok(String(values[3]).length > 0 && String(values[3]).length <= 1000);
  assert.equal(String(values[6]).length, 1000);
  assert.ok(Number.isFinite(Date.parse(String(values[4]))));
});
