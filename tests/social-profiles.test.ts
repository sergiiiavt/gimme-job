import assert from "node:assert/strict";
import test from "node:test";
import { SOCIAL_PROFILES, shareLinks, withUtm } from "../app/social-profiles.ts";

test("social profiles are the public @gimmejob_qa accounts over HTTPS", () => {
  assert.deepEqual(SOCIAL_PROFILES.map((profile) => profile.id), ["instagram", "threads", "youtube"]);
  for (const profile of SOCIAL_PROFILES) {
    const url = new URL(profile.url);
    assert.equal(url.protocol, "https:");
    assert.match(url.pathname, /gimmejob_qa/);
  }
});

test("UTM tags are added to site URLs without dropping existing parameters", () => {
  assert.equal(
    withUtm("/uk/interview/web-api?question=delete-retry", { source: "telegram", medium: "community", campaign: "dou_launch", content: "delete-retry" }),
    "https://gimme-job.com/uk/interview/web-api?question=delete-retry&utm_source=telegram&utm_medium=community&utm_campaign=dou_launch&utm_content=delete-retry",
  );
  assert.equal(withUtm("/", { source: "instagram", medium: "organic_social" }), "https://gimme-job.com/?utm_source=instagram&utm_medium=organic_social");
  assert.throws(() => withUtm("/", { source: "Instagram", medium: "organic_social" }), /lowercase/);
  assert.throws(() => withUtm("/", { source: "telegram", medium: "organic social" }), /lowercase/);
});

test("share intents carry the canonical page tagged with the network it was shared to", () => {
  const links = shareLinks("/uk/interview?question=severity-versus-priority", "Severity чи priority?");
  assert.deepEqual(links.map((link) => link.id), ["telegram", "threads", "linkedin"]);

  const telegram = new URL(links[0].href);
  assert.equal(telegram.origin + telegram.pathname, "https://t.me/share/url");
  assert.equal(telegram.searchParams.get("text"), "Severity чи priority?");
  const shared = new URL(telegram.searchParams.get("url") ?? "");
  assert.equal(shared.pathname, "/uk/interview");
  assert.equal(shared.searchParams.get("question"), "severity-versus-priority");
  assert.equal(shared.searchParams.get("utm_source"), "telegram");
  assert.equal(shared.searchParams.get("utm_medium"), "share");

  const threadsText = new URL(links[1].href).searchParams.get("text") ?? "";
  assert.match(threadsText, /^Severity чи priority\?\nhttps:\/\/gimme-job\.com\/uk\/interview\?question=severity-versus-priority&utm_source=threads&/);

  const linkedin = new URL(new URL(links[2].href).searchParams.get("url") ?? "");
  assert.equal(linkedin.searchParams.get("utm_source"), "linkedin");
});
