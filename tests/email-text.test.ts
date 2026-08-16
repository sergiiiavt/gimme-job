import assert from "node:assert/strict";
import test from "node:test";
import { extractEmailTextExcerpt } from "../worker/email-text.ts";

test("email text extraction prefers text/plain in multipart alternative", () => {
  const raw = [
    "From: recruiter@example.com",
    "Subject: Interview",
    "Content-Type: multipart/alternative; boundary=alt-123",
    "",
    "--alt-123",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hello Sergii,",
    "We would like to invite you to a technical interview for Senior QA Engineer.",
    "",
    "--alt-123",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<p>HTML duplicate that should not win.</p>",
    "--alt-123--",
  ].join("\r\n");

  const excerpt = extractEmailTextExcerpt(raw);
  assert.match(excerpt ?? "", /technical interview for Senior QA Engineer/);
  assert.doesNotMatch(excerpt ?? "", /HTML duplicate/);
});

test("email text extraction decodes quoted printable UTF-8", () => {
  const raw = [
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Thank you for applying.=0AWe received your application for QA Lead.",
  ].join("\r\n");

  assert.equal(
    extractEmailTextExcerpt(raw),
    "Thank you for applying.\nWe received your application for QA Lead.",
  );
});

test("email text extraction decodes base64 plain text", () => {
  const body = "Your interview is scheduled for Monday at 10:00.";
  const raw = [
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(body),
  ].join("\r\n");

  assert.equal(extractEmailTextExcerpt(raw), body);
});

test("email text extraction falls back to readable HTML text", () => {
  const raw = [
    "Content-Type: text/html; charset=utf-8",
    "",
    "<html><style>.x{display:none}</style><body><h1>Job offer</h1><p>We are pleased to offer you the role of QA Lead &amp; Automation Lead.</p></body></html>",
  ].join("\r\n");

  const excerpt = extractEmailTextExcerpt(raw);
  assert.match(excerpt ?? "", /Job offer/);
  assert.match(excerpt ?? "", /QA Lead & Automation Lead/);
  assert.doesNotMatch(excerpt ?? "", /display:none/);
});

test("email text extraction ignores script and style bodies with spaced closing tags", () => {
  const raw = [
    "Content-Type: text/html; charset=utf-8",
    "",
    '<html><body><script>window.payload = "<p>hidden</p>";</script ><style>.secret{display:none}</style ><p data-note="1 > 0">Visible interview invitation</p></body></html>',
  ].join("\r\n");

  const excerpt = extractEmailTextExcerpt(raw);
  assert.match(excerpt ?? "", /Visible interview invitation/);
  assert.doesNotMatch(excerpt ?? "", /window\.payload|hidden|secret|display:none/);
});

test("email text excerpts are hard-bounded", () => {
  const raw = `Content-Type: text/plain\r\n\r\n${"x".repeat(10_000)}`;
  const excerpt = extractEmailTextExcerpt(raw, 1_000);
  assert.equal(excerpt?.length, 1_000);
  assert.ok(excerpt?.endsWith("…"));
});
