import assert from "node:assert/strict";
import test from "node:test";
import { handleForwardedEmail } from "../worker/email-forwarding.ts";

function fakeDb() {
  const state = { inserted: [] as unknown[][], verifications: [] as unknown[][] };
  const db = {
    prepare(sql: string) {
      const text = sql.replace(/\s+/g, " ").trim();
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) { statement.values = values; return statement; },
        async first() {
          if (text.includes("FROM email_ingest_aliases")) return { user_id: "user-a" };
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

function message(options: { from: string; subject: string; raw: string }) {
  const state = { rejected: "" };
  return {
    state,
    value: {
      from: options.from,
      to: "jobs+abc123def456@gimme-job.com",
      rawSize: new TextEncoder().encode(options.raw).byteLength,
      raw: new Response(options.raw).body ?? undefined,
      headers: new Headers({
        subject: options.subject,
        date: "Sun, 16 Aug 2026 00:20:00 GMT",
        "message-id": `<${crypto.randomUUID()}@example.com>`,
      }),
      setReject(reason: string) { state.rejected = reason; },
    },
  };
}

test("normal forwarded job email stores a clean bounded text excerpt", async () => {
  const raw = [
    "From: Anna Recruiter <anna@example.com>",
    "Subject: Senior QA Engineer opportunity",
    "Content-Type: multipart/alternative; boundary=alt",
    "",
    "--alt",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hello Sergii,",
    "We have a Senior QA Engineer role at Example Corp and would like to discuss it with you.",
    "",
    "--alt",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<p>HTML duplicate</p>",
    "--alt--",
  ].join("\r\n");
  const { db, state } = fakeDb();
  const incoming = message({ from: "anna@example.com", subject: "Senior QA Engineer opportunity", raw });

  await handleForwardedEmail(incoming.value, { DB: db });

  assert.equal(incoming.state.rejected, "");
  assert.equal(state.inserted.length, 1);
  const excerpt = state.inserted[0]?.[6];
  assert.equal(
    excerpt,
    "Hello Sergii,\nWe have a Senior QA Engineer role at Example Corp and would like to discuss it with you.",
  );
  assert.equal(String(excerpt).includes("HTML duplicate"), false);
});

test("Gmail forwarding confirmation never stores its verification body as the classification excerpt", async () => {
  const raw = [
    "From: Gmail Team <forwarding-noreply@google.com>",
    "Subject: Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Confirmation code: 123456789",
    "https://mail.google.com/mail/vf-token",
    "sensitive verification body",
  ].join("\r\n");
  const { db, state } = fakeDb();
  const incoming = message({
    from: "forwarding-noreply@google.com",
    subject: "Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
    raw,
  });

  await handleForwardedEmail(incoming.value, { DB: db });

  assert.equal(state.inserted.length, 1);
  assert.equal(state.inserted[0]?.[6], null);
  assert.equal(state.verifications.length, 1);
  assert.equal(state.verifications[0]?.[2], "123456789");
});

test("oversized raw messages are not parsed or stored as excerpts", async () => {
  const { db, state } = fakeDb();
  const raw = "Content-Type: text/plain\r\n\r\nThis body should be skipped.";
  const stateMessage = { rejected: "" };
  const value = {
    from: "recruiter@example.com",
    to: "jobs+abc123def456@gimme-job.com",
    rawSize: 1024 * 1024 + 1,
    raw: new Response(raw).body ?? undefined,
    headers: new Headers({ subject: "QA role", "message-id": "<large@example.com>" }),
    setReject(reason: string) { stateMessage.rejected = reason; },
  };

  await handleForwardedEmail(value, { DB: db });

  assert.equal(stateMessage.rejected, "");
  assert.equal(state.inserted[0]?.[6], null);
});
