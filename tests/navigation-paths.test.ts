import assert from "node:assert/strict";
import test from "node:test";
import { sectionNavigationHref } from "../app/navigation-paths.ts";

test("public navigation stays on stable public routes", () => {
  assert.equal(sectionNavigationHref("about", "public"), "/learn#about");
  assert.equal(sectionNavigationHref("jobs", "public"), "/workspace");
  assert.equal(sectionNavigationHref("interview", "public"), "/learn#interview");
  assert.equal(sectionNavigationHref("trends", "public"), "/learn#trends");
  assert.equal(sectionNavigationHref("certifications", "public"), "/learn#certifications");
  assert.equal(sectionNavigationHref("programming", "public"), "/learn/programming");
  assert.equal(sectionNavigationHref("automation", "public"), "/learn/automation");
  assert.equal(sectionNavigationHref("devops", "public"), "/learn/cloud-devops");
});

test("personal navigation keeps private destinations except public About", () => {
  assert.equal(sectionNavigationHref("about", "personal"), "/learn#about");
  assert.equal(sectionNavigationHref("jobs", "personal"), "/workspace");
  assert.equal(sectionNavigationHref("interview", "personal"), "/workspace/learn?section=interview");
  assert.equal(sectionNavigationHref("programming", "personal"), "/workspace/learn/programming");
  assert.equal(sectionNavigationHref("automation", "personal"), "/workspace/learn/automation");
  assert.equal(sectionNavigationHref("devops", "personal"), "/workspace/learn/cloud-devops");
});
