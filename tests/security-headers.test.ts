import assert from "node:assert/strict";
import test from "node:test";
import { withSecurityHeaders } from "../worker/security-headers.ts";

test("every document response gets the baseline security headers", async () => {
  const response = withSecurityHeaders(new Response("<!doctype html><p>ok</p>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'self'/);
  assert.match(response.headers.get("content-security-policy") ?? "", /object-src 'none'/);
  assert.match(response.headers.get("permissions-policy") ?? "", /microphone=\(self\)/);
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.equal(await response.text(), "<!doctype html><p>ok</p>");
});

test("routes with a stricter policy keep it", () => {
  const response = withSecurityHeaders(new Response("", {
    headers: {
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    },
  }));

  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("redirects and errors are covered too", () => {
  const redirect = withSecurityHeaders(new Response(null, { status: 303, headers: { location: "/login" } }));
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get("location"), "/login");
  assert.equal(redirect.headers.get("x-frame-options"), "SAMEORIGIN");

  const limited = withSecurityHeaders(Response.json({ error: "Too many requests." }, { status: 429 }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("strict-transport-security"), "max-age=31536000");
});

test("WebSocket upgrade responses pass through untouched", () => {
  // Node's Response cannot represent 101; the Worker runtime can.
  const upgrade = { status: 101, headers: new Headers() } as unknown as Response;
  assert.equal(withSecurityHeaders(upgrade), upgrade);
});
