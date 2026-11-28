import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CAMPAIGN_ANALYTICS_BINDING,
  CAMPAIGN_ANALYTICS_DATASET,
  campaignDataPoint,
  campaignLinkResponse,
  campaignTags,
  isPreviewBot,
  recordCampaignVisit,
  type CampaignDataPoint,
} from "../worker/campaign-analytics.ts";

const TAGGED_URL = "https://gimme-job.com/uk/interview?question=delete-retry&utm_source=threads&utm_medium=organic_social&utm_campaign=profile&utm_content=bio";
const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 350.0";

function recorder() {
  const points: CampaignDataPoint[] = [];
  const pending: Promise<unknown>[] = [];
  return {
    points,
    env: { CAMPAIGN_ANALYTICS: { writeDataPoint: (point: CampaignDataPoint) => { points.push(point); } } },
    ctx: { waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } },
    settled: () => Promise.all(pending),
  };
}

const visit = (url = TAGGED_URL, init: RequestInit = {}, cf?: Record<string, unknown>) => {
  const request = new Request(url, { ...init, headers: { "user-agent": BROWSER_UA, ...init.headers } });
  if (cf) Object.defineProperty(request, "cf", { value: cf });
  return request;
};
const page = (init: ResponseInit = {}) => new Response("<!doctype html><html></html>", {
  status: 200,
  ...init,
  headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
});

test("utm tags are read lowercase and trimmed, and missing tags stay empty", () => {
  assert.deepEqual(campaignTags(new URL(TAGGED_URL)), { source: "threads", medium: "organic_social", campaign: "profile", content: "bio" });
  assert.deepEqual(
    campaignTags(new URL("https://gimme-job.com/?utm_source=%20Telegram%20")),
    { source: "telegram", medium: "", campaign: "", content: "" },
  );
  assert.deepEqual(campaignTags(new URL("https://gimme-job.com/?utm_id=42")), { source: "", medium: "", campaign: "", content: "" });
  assert.equal(campaignTags(new URL("https://gimme-job.com/uk/interview?question=delete-retry")), null);
  assert.equal(campaignTags(new URL("https://gimme-job.com/?source=threads")), null);
  assert.equal(campaignTags(new URL(`https://gimme-job.com/?utm_content=${"x".repeat(500)}`))?.content.length, 100);
});

test("link-preview and search crawlers are not counted as visitors", () => {
  for (const userAgent of [
    "TelegramBot (like TwitterBot)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "WhatsApp/2.23.20.0",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  ]) {
    assert.equal(isPreviewBot(userAgent), true, userAgent);
  }
  assert.equal(isPreviewBot(BROWSER_UA), false);
  assert.equal(isPreviewBot(null), false);
});

test("a data point carries the tags, path, country, referrer host, and event", () => {
  const request = visit(TAGGED_URL, { headers: { referer: "https://L.Threads.com/?u=https%3A%2F%2Fgimme-job.com%2F" } }, { country: "UA" });
  assert.deepEqual(campaignDataPoint(request, campaignTags(new URL(request.url))!, "page"), {
    indexes: ["threads"],
    blobs: ["threads", "organic_social", "profile", "bio", "/uk/interview", "UA", "l.threads.com", "page"],
  });

  const bare = campaignDataPoint(visit("https://gimme-job.com/?utm_medium=share", { headers: { referer: "not a url" } }), campaignTags(new URL("https://gimme-job.com/?utm_medium=share"))!, "page");
  assert.deepEqual(bare.blobs.slice(4), ["/", "", "", "page"]);
  assert.deepEqual(bare.indexes, [""]);
});

test("the index stays within the Analytics Engine 96-byte limit", () => {
  const source = "д".repeat(100);
  const [index] = campaignDataPoint(visit(), { source, medium: "", campaign: "", content: "" }, "page").indexes;
  assert.ok(new TextEncoder().encode(index).byteLength <= 96);
  assert.ok(source.startsWith(index) && index.length === 48);
});

test("a tagged production HTML page is counted once, in the background", async () => {
  const analytics = recorder();
  recordCampaignVisit(visit(TAGGED_URL, {}, { country: "PL" }), page(), analytics.env, analytics.ctx);
  assert.equal(analytics.points.length, 0, "the write must not run before the response is returned");
  await analytics.settled();
  assert.equal(analytics.points.length, 1);
  assert.deepEqual(analytics.points[0].blobs.slice(0, 6), ["threads", "organic_social", "profile", "bio", "/uk/interview", "PL"]);
});

test("untagged, non-page, non-production, and crawler requests are not counted", async () => {
  const analytics = recorder();
  const skipped: Array<[Request, Response]> = [
    [visit("https://gimme-job.com/uk/interview"), page()],
    [visit(TAGGED_URL, { method: "HEAD" }), page()],
    [visit(TAGGED_URL, { method: "POST", body: "{}" }), page()],
    [visit(TAGGED_URL.replace("https://gimme-job.com", "https://gimmejob.example.workers.dev")), page()],
    [visit(TAGGED_URL.replace("https://gimme-job.com", "http://localhost:4173")), page()],
    [visit(TAGGED_URL), page({ status: 404 })],
    [visit(TAGGED_URL), new Response(null, { status: 302, headers: { location: "/uk/interview" } })],
    [visit(TAGGED_URL), Response.json({ ok: true })],
    [visit(TAGGED_URL, { headers: { "user-agent": "TelegramBot (like TwitterBot)" } }), page()],
  ];
  for (const [request, response] of skipped) recordCampaignVisit(request, response, analytics.env, analytics.ctx);
  await analytics.settled();
  assert.deepEqual(analytics.points, []);
});

test("without the binding (local dev, tests) nothing is scheduled", () => {
  let scheduled = 0;
  recordCampaignVisit(visit(), page(), {}, { waitUntil: () => { scheduled += 1; } });
  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/go/dou"), {}, { waitUntil: () => { scheduled += 1; } })?.status, 302);
  assert.equal(scheduled, 0);
});

test("a failing write is logged and never rejects the request", async () => {
  const pending: Promise<unknown>[] = [];
  const warnings: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (entry: unknown) => { warnings.push(entry); };
  try {
    const env = { CAMPAIGN_ANALYTICS: { writeDataPoint: () => { throw new Error("dataset unavailable"); } } };
    recordCampaignVisit(visit(), page(), env, { waitUntil: (promise) => { pending.push(promise); } });
    await Promise.all(pending);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(JSON.stringify(warnings[0]), /campaign_analytics_write.*dataset unavailable/);
});

test("a short link redirects to its tagged page and counts the click", async () => {
  const analytics = recorder();
  const response = campaignLinkResponse(visit("https://gimme-job.com/go/dou", {}, { country: "UA" }), analytics.env, analytics.ctx);
  assert.equal(response?.status, 302);
  assert.equal(response.headers.get("location"), "https://gimme-job.com/uk/interview?utm_source=dou&utm_medium=community&utm_campaign=dou_resource");
  assert.equal(response.headers.get("cache-control"), "no-store");
  await analytics.settled();
  assert.deepEqual(analytics.points, [{
    indexes: ["dou"],
    blobs: ["dou", "community", "dou_resource", "", "/go/dou", "UA", "", "go"],
  }]);

  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/go/dou/"), analytics.env, analytics.ctx)?.status, 302);
});

test("short links redirect on every host but count only real production clicks", async () => {
  const analytics = recorder();
  const local = campaignLinkResponse(visit("http://localhost:4173/go/tg"), analytics.env, analytics.ctx);
  assert.equal(local?.headers.get("location"), "http://localhost:4173/uk/interview?utm_source=telegram&utm_medium=organic_social&utm_campaign=tg_daily");
  campaignLinkResponse(visit("https://gimme-job.com/go/tg", { headers: { "user-agent": "TelegramBot (like TwitterBot)" } }), analytics.env, analytics.ctx);
  campaignLinkResponse(visit("https://gimme-job.com/go/tg", { method: "HEAD" }), analytics.env, analytics.ctx);
  await analytics.settled();
  assert.deepEqual(analytics.points, []);
});

test("unknown short links are 404, other methods 405, and other paths are not handled", async () => {
  const analytics = recorder();
  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/go/missing"), analytics.env, analytics.ctx)?.status, 404);
  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/go/"), analytics.env, analytics.ctx)?.status, 404);
  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/go/constructor"), analytics.env, analytics.ctx)?.status, 404);
  const post = campaignLinkResponse(visit("https://gimme-job.com/go/dou", { method: "POST", body: "" }), analytics.env, analytics.ctx);
  assert.equal(post?.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/uk/interview"), analytics.env, analytics.ctx), null);
  assert.equal(campaignLinkResponse(visit("https://gimme-job.com/golang"), analytics.env, analytics.ctx), null);
  await analytics.settled();
  assert.deepEqual(analytics.points, []);
});

test("the production deploy binds the dataset the Worker writes to", async () => {
  const deployScript = await readFile(new URL("../scripts/deploy-cloudflare.mjs", import.meta.url), "utf8");
  assert.ok(
    deployScript.includes(`deployConfig.analytics_engine_datasets = [{ binding: "${CAMPAIGN_ANALYTICS_BINDING}", dataset: "${CAMPAIGN_ANALYTICS_DATASET}" }];`),
    "scripts/deploy-cloudflare.mjs must bind CAMPAIGN_ANALYTICS to the campaign dataset",
  );
});
