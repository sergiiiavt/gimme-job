import assert from "node:assert/strict";
import test from "node:test";
import { INTERVIEW_DOMAIN_ROUTES } from "../content/interview/domain-routes.ts";
import {
  UK_INTERVIEW_INDEX,
  UK_PYTHON_INTERVIEW,
  UKRAINIAN_INTERVIEW_DOMAIN_ROUTES,
  ukrainianInterviewDomainRouteBySlug,
  ukrainianInterviewPath,
} from "../content/interview/ukrainian-routes.ts";

test("Ukrainian interview routes mirror every canonical English domain exactly once", () => {
  assert.equal(UKRAINIAN_INTERVIEW_DOMAIN_ROUTES.length, INTERVIEW_DOMAIN_ROUTES.length);
  assert.equal(new Set(UKRAINIAN_INTERVIEW_DOMAIN_ROUTES.map((route) => route.path)).size, INTERVIEW_DOMAIN_ROUTES.length);

  for (const englishRoute of INTERVIEW_DOMAIN_ROUTES) {
    const route = ukrainianInterviewDomainRouteBySlug(englishRoute.slug);
    assert.ok(route);
    assert.equal(route.englishPath, englishRoute.path);
    assert.equal(route.path, `/uk${englishRoute.path}`);
    assert.ok(route.ukTitle.length > 10);
    assert.ok(route.ukDescription.length > 30);
  }
});

test("Ukrainian interview index and Python route are canonical locale pairs", () => {
  assert.equal(UK_INTERVIEW_INDEX.path, "/uk/interview");
  assert.equal(UK_INTERVIEW_INDEX.englishPath, "/interview");
  assert.equal(UK_PYTHON_INTERVIEW.path, "/uk/interview/python");
  assert.equal(UK_PYTHON_INTERVIEW.englishPath, "/interview/python");
  assert.equal(ukrainianInterviewPath("/interview/sql"), "/uk/interview/sql");
  assert.equal(ukrainianInterviewPath("interview/sql"), "/uk/interview/sql");
});
