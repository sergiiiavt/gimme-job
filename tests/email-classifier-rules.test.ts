import assert from "node:assert/strict";
import test from "node:test";
import { fallbackClassification, preAiClassification } from "../app/internal/n8n/email-classify/rules.ts";

function email(overrides: Partial<{
  sender_name: string | null;
  sender_email: string | null;
  subject: string;
  text_excerpt: string | null;
}> = {}) {
  return {
    sender_name: null,
    sender_email: "person@example.com",
    subject: "Hello",
    text_excerpt: null,
    ...overrides,
  };
}

test("pre-AI gate classifies developer notifications without AI", () => {
  const result = preAiClassification(email({
    sender_email: "notifications@github.com",
    subject: "[sergiiiavt/gimme-job] CI and Cloudflare deploy workflow run failed",
  }));
  assert.equal(result?.classification, "SERVICE_MESSAGE");
  assert.equal(result?.action, "NO_ACTION");
  assert.match(result?.source ?? "", /^RULE:/);
});

test("pre-AI gate classifies consumer promotions as NON_JOB", () => {
  const result = preAiClassification(email({
    sender_email: "news@gog.com",
    subject: "Games on your wishlist are 75% off",
    text_excerpt: "Big summer sale. Save 75% on games from your wishlist.",
  }));
  assert.equal(result?.classification, "NON_JOB");
  assert.equal(result?.company, "GOG.com");
  assert.equal(result?.action, "NO_ACTION");
});

test("pre-AI gate classifies obvious job alerts without AI", () => {
  const result = preAiClassification(email({
    sender_email: "jobalerts-noreply@linkedin.com",
    subject: "Job alert: QA Lead in Kyiv",
    text_excerpt: "Recommended jobs for you",
  }));
  assert.equal(result?.classification, "JOB_ALERT");
  assert.equal(result?.company, "LinkedIn");
  assert.equal(result?.action, "REVIEW_JOB_ALERT");
});

test("pre-AI gate leaves ambiguous potentially relevant email for AI", () => {
  const result = preAiClassification(email({
    sender_name: "Anna",
    sender_email: "anna@company.example",
    subject: "Quick follow-up",
    text_excerpt: "Hi Sergii, are you free tomorrow to discuss what we spoke about?",
  }));
  assert.equal(result, null);
});

test("fallback classifier handles strong hiring-stage signals after AI failure", () => {
  const result = fallbackClassification(email({
    subject: "Update on your application",
    text_excerpt: "Unfortunately, we will not be moving forward with your application.",
  }));
  assert.equal(result?.classification, "REJECTION");
  assert.equal(result?.action, "NO_ACTION");
});
