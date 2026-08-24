import assert from "node:assert/strict";
import test from "node:test";

import { hasRagServiceToken, ragServiceAuthFailure } from "../worker/rag-auth.ts";

test("canonical RAG service token requires the exact private header value", () => {
  const configured = "0123456789abcdef0123456789abcdef";
  const good = new Request("https://example.test/internal/rag/search", {
    headers: { "x-gimmejob-rag-token": configured },
  });
  const bad = new Request("https://example.test/internal/rag/search", {
    headers: { "x-gimmejob-rag-token": `${configured}x` },
  });
  const missing = new Request("https://example.test/internal/rag/search");

  assert.equal(hasRagServiceToken(good, configured), true);
  assert.equal(hasRagServiceToken(bad, configured), false);
  assert.equal(hasRagServiceToken(missing, configured), false);
  assert.equal(hasRagServiceToken(good, undefined), false);
});

test("canonical RAG token comparison handles UTF-8 without accepting a different value", () => {
  const configured = "токен-🔐-0123456789abcdef0123456789abcdef";
  const exact = new Request("https://example.test/internal/rag/search", {
    headers: { "x-gimmejob-rag-token": configured },
  });
  const different = new Request("https://example.test/internal/rag/search", {
    headers: { "x-gimmejob-rag-token": configured.replace("🔐", "🔑") },
  });

  assert.equal(hasRagServiceToken(exact, configured), true);
  assert.equal(hasRagServiceToken(different, configured), false);
});

test("canonical RAG auth failure distinguishes missing config from bad credentials", async () => {
  const unconfigured = ragServiceAuthFailure(false);
  assert.equal(unconfigured.status, 503);
  assert.match(await unconfigured.text(), /not configured/);
  assert.equal(unconfigured.headers.get("cache-control"), "no-store");

  const unauthorized = ragServiceAuthFailure(true);
  assert.equal(unauthorized.status, 401);
  assert.match(await unauthorized.text(), /required/);
  assert.equal(unauthorized.headers.get("cache-control"), "no-store");
});
