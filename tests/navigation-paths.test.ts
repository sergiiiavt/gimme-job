import assert from "node:assert/strict";
import test from "node:test";
import { sectionFromPathname, sectionNavigationHref } from "../app/navigation-paths.ts";

const expectedRoutes: Record<string, string> = {
  about: "/about",
  jobs: "/vacancies",
  resume: "/resume",
  interview: "/interview",
  "python-interview": "/interview/python",
  trends: "/trends",
  certifications: "/learn/certifications",
  api: "/learn/api",
  programming: "/learn/programming",
  automation: "/learn/automation",
  devops: "/learn/cloud-devops",
  news: "/news",
  rewild: "/fight-ai-slop",
};

test("public and authenticated navigation share canonical query-free routes", () => {
  for (const [section, expected] of Object.entries(expectedRoutes)) {
    assert.equal(sectionNavigationHref(section, "public"), expected);
    assert.equal(sectionNavigationHref(section, "personal"), expected);
    assert.equal(expected.includes("?"), false);
  }
});

test("canonical route paths resolve directly to their site sections", () => {
  assert.equal(sectionFromPathname("/about"), "about");
  assert.equal(sectionFromPathname("/vacancies"), "jobs");
  assert.equal(sectionFromPathname("/resume"), "resume");
  assert.equal(sectionFromPathname("/interview"), "interview");
  assert.equal(sectionFromPathname("/interview/python"), "python-interview");
  assert.equal(sectionFromPathname("/learn/api"), "api");
  assert.equal(sectionFromPathname("/learn/cloud-devops"), "devops");
  assert.equal(sectionFromPathname("/news"), "news");
  assert.equal(sectionFromPathname("/fight-ai-slop"), "rewild");
  assert.equal(sectionFromPathname("/unknown"), null);
});
