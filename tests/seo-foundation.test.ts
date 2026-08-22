import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots.ts";
import {
  LEARNING_SEO,
  PUBLIC_SITEMAP_PATHS,
  REFERENCE_SEO,
  SITE_NAME,
  SITE_ORIGIN,
  createPageMetadata,
  learningSectionMetadata,
  legacyReferenceMetadata,
  noIndexMetadata,
  referenceSectionMetadata,
} from "../app/seo.ts";
import sitemap from "../app/sitemap.ts";

const canonical = (metadata: ReturnType<typeof createPageMetadata>) => metadata.alternates?.canonical;

test("SEO metadata helpers create branded canonical metadata", () => {
  const metadata = createPageMetadata({
    title: "API Testing",
    description: "Practical API testing guidance.",
    path: "/learn/api",
  });

  assert.equal(metadata.title, `API Testing | ${SITE_NAME}`);
  assert.equal(metadata.description, "Practical API testing guidance.");
  assert.equal(canonical(metadata), "/learn/api");
  assert.equal(metadata.openGraph?.url, "/learn/api");
  assert.equal(metadata.twitter?.title, `API Testing | ${SITE_NAME}`);
});

test("learning metadata covers known and fallback routes", () => {
  assert.equal(canonical(learningSectionMetadata("automation")), LEARNING_SEO.automation.path);
  assert.equal(canonical(learningSectionMetadata("release-readiness")), "/learn/release-readiness");
  assert.equal(learningSectionMetadata("release-readiness").title, "Release Readiness Learning | GimmeJob");

  const sparseSlug = learningSectionMetadata("--release--readiness--");
  assert.equal(sparseSlug.title, "Release Readiness Learning | GimmeJob");
});

test("reference metadata covers known, fallback, and legacy routes", () => {
  assert.equal(canonical(referenceSectionMetadata("data")), REFERENCE_SEO.data.path);
  assert.equal(canonical(referenceSectionMetadata("debugging")), "/reference/debugging");
  assert.equal(referenceSectionMetadata("debugging").title, "Debugging Reference | GimmeJob");
  assert.equal(canonical(legacyReferenceMetadata("programming")), "/reference/programming");
});

test("noindex metadata is explicit and non-cacheable", () => {
  const privateMetadata = noIndexMetadata("Private workspace", "Private data.");
  assert.equal(privateMetadata.title, "Private workspace | GimmeJob");
  assert.equal(privateMetadata.description, "Private data.");
  assert.deepEqual(privateMetadata.robots, { index: false, follow: false, nocache: true });
});

test("sitemap publishes canonical public URLs only", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  assert.equal(entries.length, PUBLIC_SITEMAP_PATHS.length);
  assert.ok(urls.includes(`${SITE_ORIGIN}/interview`));
  assert.ok(urls.includes(`${SITE_ORIGIN}/interview/python`));
  assert.ok(urls.includes(`${SITE_ORIGIN}/learn/automation`));
  assert.ok(urls.includes(`${SITE_ORIGIN}/reference/data`));
  assert.equal(urls.some((url) => url.includes("/workspace")), false);
  assert.equal(urls.some((url) => url.endsWith("/learn/data")), false);
  assert.equal(new Set(urls).size, urls.length);
});

test("robots blocks service endpoints but leaves noindex pages crawlable", () => {
  const policy = robots();
  assert.equal(policy.sitemap, `${SITE_ORIGIN}/sitemap.xml`);
  assert.equal(policy.host, SITE_ORIGIN);

  const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;
  assert.equal(rule.userAgent, "*");
  assert.equal(rule.allow, "/");
  assert.deepEqual(rule.disallow, ["/api/", "/auth/"]);
  assert.equal((rule.disallow as string[]).includes("/workspace/"), false);
});
