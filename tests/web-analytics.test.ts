import assert from "node:assert/strict";
import test from "node:test";
import { withSecurityHeaders } from "../worker/security-headers.ts";
import { WEB_ANALYTICS_BEACON_SRC, webAnalyticsBeacon, withWebAnalytics } from "../worker/web-analytics.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const ENV = { CLOUDFLARE_WEB_ANALYTICS_TOKEN: TOKEN };
const SOCIAL_URL = "https://gimme-job.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=qa_launch&utm_content=bio";

const page = (init: ResponseInit = {}) => new Response("<!doctype html><html><head></head><body></body></html>", {
  status: 200,
  ...init,
  headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
});
const get = (url = SOCIAL_URL, method = "GET") => new Request(url, { method });

test("production pages opened from a social link get the Cloudflare beacon", () => {
  const beacon = webAnalyticsBeacon(get(), page(), ENV);

  assert.ok(beacon, "expected a beacon tag");
  assert.match(beacon, /^<script defer src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js" /);
  const config = /data-cf-beacon='([^']+)'/.exec(beacon)?.[1];
  assert.deepEqual(JSON.parse(config ?? "null"), { token: TOKEN, spa: true });
  assert.ok(webAnalyticsBeacon(get("https://gimme-job.com/interview/qa"), page(), ENV));
});

test("analytics stays off without a valid token", () => {
  assert.equal(webAnalyticsBeacon(get(), page(), {}), null);
  assert.equal(webAnalyticsBeacon(get(), page(), { CLOUDFLARE_WEB_ANALYTICS_TOKEN: " " }), null);
  assert.equal(webAnalyticsBeacon(get(), page(), { CLOUDFLARE_WEB_ANALYTICS_TOKEN: "not-a-token" }), null);
  assert.equal(webAnalyticsBeacon(get(), page(), { CLOUDFLARE_WEB_ANALYTICS_TOKEN: `${TOKEN.slice(1)}'` }), null);
});

test("local dev, previews, and non-page responses never load the beacon", () => {
  assert.equal(webAnalyticsBeacon(get("http://localhost:4173/"), page(), ENV), null);
  assert.equal(webAnalyticsBeacon(get("https://gimmejob.example.workers.dev/"), page(), ENV), null);
  assert.equal(webAnalyticsBeacon(get(SOCIAL_URL, "HEAD"), page(), ENV), null);
  assert.equal(webAnalyticsBeacon(get(SOCIAL_URL, "POST"), page(), ENV), null);
  assert.equal(webAnalyticsBeacon(get(), page({ status: 404 }), ENV), null);
  assert.equal(webAnalyticsBeacon(get(), Response.json({ ok: true }), ENV), null);
});

test("pages with their own strict CSP stay analytics-free", () => {
  const signIn = page({ headers: { "content-security-policy": "default-src 'none'; frame-ancestors 'none'" } });
  assert.equal(webAnalyticsBeacon(get("https://gimme-job.com/login"), signIn, ENV), null);
});

test("the beacon is appended to the document head", () => {
  const appended: Array<{ selector: string; content: string; html?: boolean }> = [];
  class FakeHTMLRewriter {
    private readonly handlers: Array<[string, { element(element: unknown): void }]> = [];
    on(selector: string, handler: { element(element: unknown): void }) {
      this.handlers.push([selector, handler]);
      return this;
    }
    transform(response: Response) {
      for (const [selector, handler] of this.handlers) {
        handler.element({ append: (content: string, options?: { html?: boolean }) => appended.push({ selector, content, html: options?.html }) });
      }
      return response;
    }
  }
  const runtime = globalThis as Record<string, unknown>;
  runtime.HTMLRewriter = FakeHTMLRewriter;
  try {
    withWebAnalytics(get(), page(), ENV);
    withWebAnalytics(get("http://localhost:4173/"), page(), ENV);
  } finally {
    delete runtime.HTMLRewriter;
  }

  assert.deepEqual(appended, [{ selector: "head", content: webAnalyticsBeacon(get(), page(), ENV), html: true }]);
});

test("without HTMLRewriter (Node) the response passes through unchanged", () => {
  const response = page();
  assert.equal(withWebAnalytics(get(), response, ENV), response);
});

test("the baseline CSP lets the beacon load and report", () => {
  const csp = withSecurityHeaders(page()).headers.get("content-security-policy") ?? "";
  const sources = (name: string) => csp.split(";").map((part) => part.trim().split(/\s+/)).find(([key]) => key === name)?.slice(1);
  const allows = (name: string, origin: string) => {
    const values = sources(name) ?? sources("default-src");
    return values === undefined || values.includes(origin) || values.includes("https:") || values.includes("*");
  };

  assert.ok(allows("script-src", new URL(WEB_ANALYTICS_BEACON_SRC).origin), `CSP blocks the beacon script: ${csp}`);
  assert.ok(allows("connect-src", "https://cloudflareinsights.com"), `CSP blocks beacon reports: ${csp}`);
});
