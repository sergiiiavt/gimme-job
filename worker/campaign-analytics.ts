/**
 * Server-side campaign counting with Workers Analytics Engine.
 *
 * Cloudflare Web Analytics drops query strings, so utm_* tags never reach it.
 * The Worker records one data point when a production HTML page is opened from
 * a tagged link, and one when a `/go/<slug>` short link is followed. Nothing
 * identifies the visitor: no cookie, IP address, or user agent is stored, only
 * the tags, the path, the country, and the referrer's host name.
 *
 * Data point layout (keep in sync with docs/web-analytics.md):
 *   index1  utm_source
 *   blob1   utm_source     blob5  pathname
 *   blob2   utm_medium     blob6  country (request.cf.country)
 *   blob3   utm_campaign   blob7  referrer host
 *   blob4   utm_content    blob8  event: "page" or "go"
 */
import { resolveCampaignLink } from "../app/campaign-links.ts";
import { SITE_ORIGIN } from "../app/seo.ts";

export const CAMPAIGN_ANALYTICS_BINDING = "CAMPAIGN_ANALYTICS";
export const CAMPAIGN_ANALYTICS_DATASET = "gimmejob_campaigns";

export type CampaignDataPoint = { indexes: string[]; blobs: string[] };
export type CampaignAnalyticsEnv = { CAMPAIGN_ANALYTICS?: { writeDataPoint(point: CampaignDataPoint): void } };
type BackgroundContext = { waitUntil(promise: Promise<unknown>): void };

export type CampaignEvent = "page" | "go";
export type CampaignTags = Readonly<{ source: string; medium: string; campaign: string; content: string }>;

const PRODUCTION_HOST = new URL(SITE_ORIGIN).host;
// Link-preview and search crawlers fetch every shared URL; they are not clicks.
const PREVIEW_BOT = /TelegramBot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|Discordbot|Googlebot|bingbot/i;
const MAX_VALUE_LENGTH = 100;
const MAX_PATH_LENGTH = 256;
// Analytics Engine rejects an index longer than 96 bytes.
const MAX_INDEX_BYTES = 96;
const GO_PREFIX = "/go/";

const clean = (value: string | null, maxLength = MAX_VALUE_LENGTH) => (value ?? "").trim().toLowerCase().slice(0, maxLength);

/** The utm_* tags of a URL, lowercased and trimmed, or null when it carries none. */
export function campaignTags(url: URL): CampaignTags | null {
  if (![...url.searchParams.keys()].some((key) => key.startsWith("utm_"))) return null;
  const tag = (key: string) => clean(url.searchParams.get(key));
  return { source: tag("utm_source"), medium: tag("utm_medium"), campaign: tag("utm_campaign"), content: tag("utm_content") };
}

export function isPreviewBot(userAgent: string | null): boolean {
  return PREVIEW_BOT.test(userAgent ?? "");
}

function referrerHost(request: Request): string {
  const referrer = request.headers.get("referer");
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function requestCountry(request: Request): string {
  const country = (request as Request & { cf?: { country?: unknown } }).cf?.country;
  return typeof country === "string" ? country : "";
}

function indexValue(value: string): string {
  const encoder = new TextEncoder();
  let index = value;
  while (encoder.encode(index).byteLength > MAX_INDEX_BYTES) index = index.slice(0, -1);
  return index;
}

export function campaignDataPoint(request: Request, tags: CampaignTags, event: CampaignEvent): CampaignDataPoint {
  const { pathname } = new URL(request.url);
  return {
    indexes: [indexValue(tags.source)],
    blobs: [
      tags.source,
      tags.medium,
      tags.campaign,
      tags.content,
      pathname.slice(0, MAX_PATH_LENGTH),
      requestCountry(request),
      referrerHost(request),
      event,
    ],
  };
}

/** Only real GET visits to the production site count; local dev, previews, and crawlers never do. */
function isCountableRequest(request: Request): boolean {
  return request.method === "GET"
    && new URL(request.url).host === PRODUCTION_HOST
    && !isPreviewBot(request.headers.get("user-agent"));
}

function writeInBackground(env: CampaignAnalyticsEnv, ctx: BackgroundContext, point: CampaignDataPoint): void {
  const dataset = env.CAMPAIGN_ANALYTICS;
  if (!dataset) return;
  ctx.waitUntil(Promise.resolve().then(() => dataset.writeDataPoint(point)).catch((error: unknown) => {
    console.warn({
      schemaVersion: 1,
      service: "gimmejob",
      event: "campaign_analytics_write",
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
  }));
}

/** Counts a production HTML page opened from a utm-tagged link. Never changes the response. */
export function recordCampaignVisit(request: Request, response: Response, env: CampaignAnalyticsEnv, ctx: BackgroundContext): void {
  if (!env.CAMPAIGN_ANALYTICS || !isCountableRequest(request)) return;
  if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) return;
  const tags = campaignTags(new URL(request.url));
  if (tags) writeInBackground(env, ctx, campaignDataPoint(request, tags, "page"));
}

/** Serves `/go/<slug>` short links: a 302 to the tagged page, or 404 for an unknown slug. Null for every other path. */
export function campaignLinkResponse(request: Request, env: CampaignAnalyticsEnv, ctx: BackgroundContext): Response | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(GO_PREFIX)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" } });
  }
  const link = resolveCampaignLink(url.pathname.slice(GO_PREFIX.length).replace(/\/$/, ""));
  if (!link) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  if (isCountableRequest(request)) {
    const { source, medium, campaign = "", content = "" } = link.tags;
    writeInBackground(env, ctx, campaignDataPoint(request, { source, medium, campaign, content }, "go"));
  }
  return new Response(null, {
    status: 302,
    // no-store so every click reaches the Worker instead of a cached redirect.
    headers: { location: new URL(link.href, url).toString(), "cache-control": "no-store" },
  });
}
