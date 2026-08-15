import assert from "node:assert/strict";
import test from "node:test";
import {
  EmailEventValidationError,
  bearerToken,
  constantTimeEqual,
  normalizeEmailEvent,
} from "../app/internal/n8n/email-events/email-event.ts";

test("normalizeEmailEvent creates a stable Gmail event without storing message body", () => {
  const event = normalizeEmailEvent({
    providerMessageId: "18fabc123",
    threadId: "18fabc000",
    receivedAt: "2026-08-15T12:30:00+03:00",
    senderName: "Recruiter",
    senderEmail: "Recruiter@Example.com",
    subject: "Senior QA Engineer",
  });

  assert.equal(event.id, "gmail:18fabc123");
  assert.equal(event.provider, "gmail");
  assert.equal(event.receivedAt, "2026-08-15T09:30:00.000Z");
  assert.equal(event.senderEmail, "recruiter@example.com");
  assert.equal(event.classification, "UNCLASSIFIED");
  assert.equal(event.summary, null);
});

test("normalizeEmailEvent rejects raw email content", () => {
  assert.throws(
    () => normalizeEmailEvent({
      providerMessageId: "18fabc123",
      receivedAt: "2026-08-15T12:30:00Z",
      subject: "Hello",
      text: "full private email body",
    }),
    (error: unknown) => error instanceof EmailEventValidationError && /not accepted/.test(error.message),
  );
});

test("normalizeEmailEvent validates classification and dates", () => {
  assert.throws(
    () => normalizeEmailEvent({
      providerMessageId: "18fabc123",
      receivedAt: "not-a-date",
      subject: "Hello",
    }),
    EmailEventValidationError,
  );

  assert.throws(
    () => normalizeEmailEvent({
      providerMessageId: "18fabc123",
      receivedAt: "2026-08-15T12:30:00Z",
      subject: "Hello",
      classification: "SPAM_THE_RECRUITER",
    }),
    EmailEventValidationError,
  );
});

test("Bearer-token helpers reject malformed or mismatched credentials", () => {
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("Basic abc"), null);
  assert.equal(bearerToken("Bearer secret-token"), "secret-token");
  assert.equal(constantTimeEqual("same-secret", "same-secret"), true);
  assert.equal(constantTimeEqual("same-secret", "different-secret"), false);
});
