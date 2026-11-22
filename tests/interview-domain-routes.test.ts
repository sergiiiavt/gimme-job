import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERVIEW_DOMAIN_ROUTES,
  interviewDomainRouteById,
  interviewDomainRouteBySlug,
  canonicalInterviewDomainPath,
  interviewDomainRouteFromPathname,
} from "../content/interview/domain-routes.ts";
import { register as registerLoader } from "node:module";
import { register as registerTsx } from "tsx/esm/api";
import { isIndexableSeoPage, LEARNING_SEO, PUBLIC_SITEMAP_PATHS, REFERENCE_SEO } from "../app/seo.ts";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);
const { learningTopicPages } = await import("../app/learning-topic-seo.ts");

const sitemapPaths = new Set<string>(PUBLIC_SITEMAP_PATHS);

test("interview domain routes are unique and included in the sitemap", () => {
  assert.equal(new Set(INTERVIEW_DOMAIN_ROUTES.map((route) => route.id)).size, INTERVIEW_DOMAIN_ROUTES.length);
  assert.equal(new Set(INTERVIEW_DOMAIN_ROUTES.map((route) => route.slug)).size, INTERVIEW_DOMAIN_ROUTES.length);
  assert.equal(new Set(INTERVIEW_DOMAIN_ROUTES.map((route) => route.path)).size, INTERVIEW_DOMAIN_ROUTES.length);

  for (const route of INTERVIEW_DOMAIN_ROUTES) {
    assert.equal(interviewDomainRouteById(route.id), route);
    assert.equal(interviewDomainRouteBySlug(route.slug), route);
    assert.equal(interviewDomainRouteFromPathname(route.path), route);
    assert.equal(interviewDomainRouteFromPathname(`${route.path}/`), route);
    const canonicalPath = canonicalInterviewDomainPath(route);
    assert.equal(sitemapPaths.has(canonicalPath), true, `${canonicalPath} should be discoverable from sitemap.xml`);
    assert.equal(sitemapPaths.has(route.path), canonicalPath === route.path, `${route.path} must be listed only when it is canonical`);
    assert.match(route.title, /Interview Questions/i);
    assert.ok(route.description.length > 80);
    assert.ok(route.relatedLinks.length >= 2);
  }
});

test("related links open published learning material, never an under-construction page", () => {
  const indexablePages = new Set([...Object.values(LEARNING_SEO), ...Object.values(REFERENCE_SEO)]
    .filter(isIndexableSeoPage)
    .map((page) => page.path));
  const topicPages = new Set(learningTopicPages().map((page) => page.path));

  for (const route of INTERVIEW_DOMAIN_ROUTES) {
    for (const link of route.relatedLinks) {
      const opensMaterial = link.href.includes("?") ? topicPages.has(link.href) : indexablePages.has(link.href);
      assert.ok(opensMaterial, `${route.id} links "${link.label}" to ${link.href}, which is not published learning material`);
    }
  }
});

test("unknown interview domain routes do not resolve", () => {
  assert.equal(interviewDomainRouteById("unknown"), undefined);
  assert.equal(interviewDomainRouteBySlug("unknown"), undefined);
  assert.equal(interviewDomainRouteFromPathname("/interview/unknown"), undefined);
});
