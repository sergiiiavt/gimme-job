import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERVIEW_DOMAIN_ROUTES,
  interviewDomainRouteById,
  interviewDomainRouteBySlug,
  interviewDomainRouteFromPathname,
} from "../content/interview/domain-routes.ts";
import { PUBLIC_SITEMAP_PATHS } from "../app/seo.ts";

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
    assert.equal(sitemapPaths.has(route.path), true, `${route.path} should be discoverable from sitemap.xml`);
    assert.match(route.title, /Interview Questions/i);
    assert.ok(route.description.length > 80);
    assert.ok(route.relatedLinks.length >= 2);
  }
});

test("unknown interview domain routes do not resolve", () => {
  assert.equal(interviewDomainRouteById("unknown"), undefined);
  assert.equal(interviewDomainRouteBySlug("unknown"), undefined);
  assert.equal(interviewDomainRouteFromPathname("/interview/unknown"), undefined);
});
