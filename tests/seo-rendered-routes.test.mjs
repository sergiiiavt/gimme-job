import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const cloudflareWorkersModule = `data:text/javascript,${encodeURIComponent("export const env = globalThis.__gimmejobSeoCloudflareEnv;")}`;
const cloudflareEnv = {};
globalThis.__gimmejobSeoCloudflareEnv = cloudflareEnv;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { shortCircuit: true, url: cloudflareWorkersModule };
    return nextResolve(specifier, context);
  },
});

const context = { waitUntil() {}, passThroughOnException() {} };
const ORIGIN = "https://gimme-job.com";

function publicEnv() {
  return {
    MULTI_USER_ENABLED: "true",
    APP_PASSWORD: "seo-test-password",
    DB: { prepare() { throw new Error("Public SEO routes must not query tenant storage."); } },
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("seo-rendered-routes-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = publicEnv();
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
  Object.assign(cloudflareEnv, env);
  return (path, init) => worker.fetch(new Request(new URL(path, ORIGIN), init), env, context);
}

const fetchRoute = await loadWorker();

function headTag(html, pattern) {
  return html.match(pattern)?.[1];
}

// Normalized so the bare origin and the origin with "/" compare equal.
const canonicalOf = (html) => {
  const href = headTag(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  return href === undefined ? undefined : new URL(href).toString();
};
const alternateHrefOf = (html, language) => {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = tags.find((link) => /\brel="alternate"/i.test(link) && new RegExp(`\\bhreflang="${language}"`, "i").test(link));
  return tag?.match(/\bhref="([^"]+)"/i)?.[1];
};
const robotsOf = (html) => headTag(html, /<meta[^>]+name="robots"[^>]+content="([^"]+)"/);
const titleOf = (html) => headTag(html, /<title>([^<]*)<\/title>/);

test("sitemap.xml and robots.txt come from the canonical Next metadata routes", async () => {
  const sitemap = await fetchRoute("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert.match(xml, /<loc>https:\/\/gimme-job\.com\/learn\/qa-fundamentals<\/loc>/);
  assert.match(xml, /<loc>https:\/\/gimme-job\.com\/learn\/git<\/loc>/);
  assert.match(xml, /<loc>https:\/\/gimme-job\.com\/interview\/sql\?question=relational-versus-nonrelational-databases<\/loc>/);
  assert.match(xml, /<loc>https:\/\/gimme-job\.com\/uk\/interview\?question=severity-versus-priority<\/loc>/);
  assert.doesNotMatch(xml, /<loc>https:\/\/gimme-job\.com\/about<\/loc>/);
  assert.doesNotMatch(xml, /<loc>https:\/\/gimme-job\.com\/learn\/strategy<\/loc>/);

  const robots = await fetchRoute("/robots.txt");
  assert.equal(robots.status, 200);
  const text = await robots.text();
  assert.match(text, /Disallow: \/api\//);
  assert.match(text, /Sitemap: https:\/\/gimme-job\.com\/sitemap\.xml/);
  assert.doesNotMatch(text, /Disallow: \/workspace/);
});

test("plain-HTTP production requests redirect permanently to HTTPS", async () => {
  const response = await fetchRoute("http://gimme-job.com/interview?question=severity-versus-priority");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), `${ORIGIN}/interview?question=severity-versus-priority`);
});

test("interview question pages are self-canonical, bilingual, and titled by the question", async () => {
  const response = await fetchRoute("/interview/generic-qa?question=relational-versus-nonrelational-databases");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(canonicalOf(html), `${ORIGIN}/interview/sql?question=relational-versus-nonrelational-databases`);
  assert.equal(alternateHrefOf(html, "uk"), `${ORIGIN}/uk/interview/sql?question=relational-versus-nonrelational-databases`);
  assert.doesNotMatch(titleOf(html) ?? "", /General QA Interview Questions/);
  assert.match(html, /"@type":"BreadcrumbList"/);

  const ukrainian = await fetchRoute("/uk/interview/sql?question=relational-versus-nonrelational-databases");
  assert.equal(ukrainian.status, 200);
  assert.equal(canonicalOf(await ukrainian.text()), `${ORIGIN}/uk/interview/sql?question=relational-versus-nonrelational-databases`);
});

test("unknown questions and learning sections return 404 instead of indexable soft pages", async () => {
  for (const path of [
    "/interview?question=unknown-question",
    "/interview/python?question=unknown-question",
    "/uk/interview?question=relational-versus-nonrelational-databases",
    "/learn/does-not-exist",
  ]) {
    const response = await fetchRoute(path);
    assert.equal(response.status, 404, `${path} should be a 404`);
  }
});

test("duplicate and placeholder pages declare the right canonical and robots policy", async () => {
  const expectations = [
    ["/about", "/", undefined],
    ["/learn", "/", undefined],
    ["/interview/generic-qa", "/interview", undefined],
    ["/learn/qa-fundamentals", "/learn/qa-fundamentals", undefined],
    ["/learn/networking", "/learn/networking", undefined],
    ["/learn/docker", "/learn/docker", undefined],
    ["/learn/git", "/learn/git", undefined],
    // Without its track the page opens the track's first chapter, so this is not the topic page.
    ["/learn/automation?topic=desktop-automation-ci", "/learn/automation", undefined],
    ["/learn/strategy", "/learn/strategy", "noindex, follow"],
  ];
  for (const [path, canonicalPath, robots] of expectations) {
    const html = await (await fetchRoute(path)).text();
    assert.equal(canonicalOf(html), new URL(canonicalPath, ORIGIN).toString(), `${path} canonical`);
    if (robots) assert.equal(robotsOf(html), robots, `${path} robots`);
    else assert.equal(robotsOf(html), "index, follow", `${path} robots`);
    assert.match(html, /<meta[^>]+property="og:image"[^>]+content="https:\/\/gimme-job\.com\/og-image\.png"/);
  }
});

test("the home page carries the site defaults and a large social preview", async () => {
  const html = await (await fetchRoute("/")).text();
  assert.equal(titleOf(html), "GimmeJob | QA Interview Questions, Learning &amp; Career Tools");
  assert.equal(robotsOf(html), "index, follow");
  assert.match(html, /<meta[^>]+property="og:image"[^>]+content="https:\/\/gimme-job\.com\/og-image\.png"/);
  assert.match(html, /<meta[^>]+name="twitter:card"[^>]+content="summary_large_image"/);
});

test("Git learning is public, marked for review and renders the requested chapter", async () => {
  const response = await fetchRoute("/learn/git?topic=conflict-resolution&section=resolve-the-example-deliberately");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Review required/);
  assert.match(html, /Resolve conflicts without losing intent/);
  assert.match(html, /id="resolve-the-example-deliberately"/);
  assert.match(html, /Git &amp; collaboration/);
  assert.doesNotMatch(html, /This learning track is under construction/);
});

test("every learning topic in the sitemap renders that topic under its own canonical", async () => {
  const xml = await (await fetchRoute("/sitemap.xml")).text();
  const topicUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"))
    .filter((url) => new URL(url).pathname.startsWith("/learn/") && new URL(url).searchParams.has("topic"));
  assert.ok(topicUrls.length > 0, "the sitemap lists learning topic pages");

  for (const url of topicUrls) {
    const { pathname, search } = new URL(url);
    const response = await fetchRoute(`${pathname}${search}`);
    assert.equal(response.status, 200, url);
    const html = (await response.text()).replaceAll("&amp;", "&");
    assert.equal(canonicalOf(html), url, `${url} is self-canonical`);
    assert.equal(robotsOf(html), "index, follow", `${url} is indexable`);
    // The page opened this topic rather than its section's default: the active contents link is the topic's own.
    const activeContentsLink = html.match(/<a\b[^>]*aria-current="location"[^>]*>/)?.[0].match(/href="([^"]+)"/)?.[1];
    assert.ok(activeContentsLink?.startsWith(`${pathname}${search}#`), `${url} renders its own topic (active contents link: ${activeContentsLink})`);
  }
});

test("English interview lists render their heading in the initial HTML", async () => {
  const html = await (await fetchRoute("/interview/sql")).text();
  assert.match(html, /<h1>SQL &amp; Databases interview questions<\/h1>/);
});
