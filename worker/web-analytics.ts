/**
 * Cloudflare Web Analytics for the production site.
 *
 * The beacon is cookieless, so it needs no consent banner, and the data stays
 * with Cloudflare, which already serves every request. The Worker adds it only
 * to production HTML documents, and only when the deploy configures
 * CLOUDFLARE_WEB_ANALYTICS_TOKEN. Local dev, previews, and tests never load it.
 */
import { SITE_ORIGIN } from "../app/seo.ts";

export type WebAnalyticsEnv = { CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string };

export const WEB_ANALYTICS_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

const PRODUCTION_HOST = new URL(SITE_ORIGIN).host;
// Site tokens are 32 hex characters. Rejecting anything else keeps the value safe to splice into HTML.
const TOKEN_PATTERN = /^[0-9a-f]{32}$/i;

/** The beacon tag for this document, or null when the response must stay untouched. */
export function webAnalyticsBeacon(request: Request, response: Response, env: WebAnalyticsEnv): string | null {
  const token = env.CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim() ?? "";
  if (!TOKEN_PATTERN.test(token)) return null;
  if (request.method !== "GET" || new URL(request.url).host !== PRODUCTION_HOST) return null;
  if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) return null;
  // Hand-written pages (sign-in, OAuth) send their own strict CSP and stay analytics-free.
  if (response.headers.has("content-security-policy")) return null;
  // `spa` counts client-side route changes as page views.
  const config = JSON.stringify({ token, spa: true });
  return `<script defer src="${WEB_ANALYTICS_BEACON_SRC}" data-cf-beacon='${config}'></script>`;
}

export function withWebAnalytics(request: Request, response: Response, env: WebAnalyticsEnv): Response {
  const beacon = webAnalyticsBeacon(request, response, env);
  if (!beacon || typeof HTMLRewriter === "undefined") return response;
  return new HTMLRewriter()
    .on("head", { element(element) { element.append(beacon, { html: true }); } })
    .transform(response);
}
