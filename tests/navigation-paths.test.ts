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
  "qa-fundamentals": "/reference/qa-fundamentals",
  programming: "/reference/programming",
  automation: "/learn/automation",
  data: "/reference/data",
  devops: "/learn/cloud-devops",
  news: "/news",
  rewild: "/fight-ai-slop",
};

const interviewDomainPaths = [
  "/interview/generic-qa",
  "/interview/automation",
  "/interview/sql",
  "/interview/web-api",
  "/interview/mobile",
  "/interview/embedded-iot",
  "/interview/ai-llm",
] as const;

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
  for (const path of interviewDomainPaths) {
    assert.equal(sectionFromPathname(path), "interview", `${path} should resolve to the interview section`);
    assert.equal(sectionFromPathname(`${path}/`), "interview", `${path}/ should normalize to the interview section`);
  }
  assert.equal(sectionFromPathname("/interview/unknown-domain"), null);
  assert.equal(sectionFromPathname("/interview/simulator"), null);
  assert.equal(sectionFromPathname("/learn/api"), "api");
  assert.equal(sectionFromPathname("/reference/qa-fundamentals"), "qa-fundamentals");
  assert.equal(sectionFromPathname("/reference/programming"), "programming");
  assert.equal(sectionFromPathname("/reference/data"), "data");
  assert.equal(sectionFromPathname("/reference/automation"), null);
  assert.equal(sectionFromPathname("/learn/cloud-devops"), "devops");
  assert.equal(sectionFromPathname("/news"), "news");
  assert.equal(sectionFromPathname("/fight-ai-slop"), "rewild");
  assert.equal(sectionFromPathname("/unknown"), null);
});
