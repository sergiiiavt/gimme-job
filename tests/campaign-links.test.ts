import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_LINKS, resolveCampaignLink } from "../app/campaign-links.ts";

test("every short link redirects to a site path tagged with its campaign", () => {
  assert.ok(CAMPAIGN_LINKS.size > 0);
  for (const slug of CAMPAIGN_LINKS.keys()) {
    const link = resolveCampaignLink(slug);
    assert.ok(link, `expected /go/${slug} to resolve`);
    assert.match(slug, /^[a-z0-9][a-z0-9_-]*$/, `slug must be lowercase: ${slug}`);
    const target = new URL(link.href, "https://gimme-job.com");
    assert.ok(link.href.startsWith("/") && !link.href.startsWith("//"), `target must stay on the site: ${link.href}`);
    assert.notEqual(target.pathname, "/go", "a short link must not redirect to another short link");
    assert.ok(!target.pathname.startsWith("/go/"), "a short link must not redirect to another short link");
    assert.equal(target.searchParams.get("utm_source"), link.tags.source);
    assert.equal(target.searchParams.get("utm_medium"), link.tags.medium);
    assert.ok(["organic_social", "community", "referral", "share"].includes(link.tags.medium), `unknown utm_medium for ${slug}: ${link.tags.medium}`);
  }
});

test("the DOU resource link lands on the Ukrainian interview index", () => {
  assert.equal(
    resolveCampaignLink("dou")?.href,
    "/uk/interview?utm_source=dou&utm_medium=community&utm_campaign=dou_resource",
  );
});

test("unknown and inherited slugs do not resolve", () => {
  for (const slug of ["", "missing", "DOU", "constructor", "__proto__", "toString", "dou/extra"]) {
    assert.equal(resolveCampaignLink(slug), null, `expected ${JSON.stringify(slug)} to be unknown`);
  }
});
