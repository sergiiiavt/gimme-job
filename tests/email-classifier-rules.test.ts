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

test("GitHub PR notification wins over job-alert phrases inside the forwarded body", () => {
  const result = preAiClassification(email({
    sender_email: "forwarder@example.com",
    subject: "Re: [sergiiiavt/gimme-job] Build Automation V2 email processing foundation (PR #100)",
    text_excerpt: "The pull request changes the job alert classifier and mentions recommended jobs for you in test data.",
  }));
  assert.equal(result?.classification, "SERVICE_MESSAGE");
  assert.equal(result?.action, "NO_ACTION");
  assert.equal(result?.source, "RULE:developer-notification");
});

test("SonarQube content is gated even when forwarding obscures the sender", () => {
  const result = preAiClassification(email({
    sender_email: "forwarder@example.com",
    subject: "Quality Gate failed on Pull Request #103",
    text_excerpt: "SonarQube Cloud reports new-code coverage and reliability issues.",
  }));
  assert.equal(result?.classification, "SERVICE_MESSAGE");
  assert.equal(result?.source, "RULE:developer-notification");
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

test("pre-AI gate classifies obvious job alerts without inventing an employer", () => {
  const result = preAiClassification(email({
    sender_email: "jobalerts-noreply@linkedin.com",
    subject: "Job alert: QA Lead in Kyiv",
    text_excerpt: "Recommended jobs for you",
  }));
  assert.equal(result?.classification, "JOB_ALERT");
  assert.equal(result?.company, null);
  assert.equal(result?.action, "REVIEW_JOB_ALERT");
});

test("pre-AI gate classifies Work.ua saved-search alerts without AI", () => {
  const result = preAiClassification(email({
    sender_email: "jobs@work.ua",
    subject: "1 new QA Lead vacancy in Kyiv",
    text_excerpt: "New vacancy matching your saved search.",
  }));
  assert.equal(result?.classification, "JOB_ALERT");
  assert.equal(result?.source, "RULE:job-alert");
});

test("pre-AI gate classifies delivery transactions from known consumer platforms as NON_JOB", () => {
  const result = preAiClassification(email({
    sender_email: "info@prom.ua",
    subject: "Замовлення №421404445 доставлено",
    text_excerpt: "Ваше замовлення доставлено до відділення Нової пошти.",
  }));
  assert.equal(result?.classification, "NON_JOB");
  assert.equal(result?.company, "Prom.ua");
  assert.equal(result?.action, "NO_ACTION");
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
