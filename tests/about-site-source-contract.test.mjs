import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("About page keeps its source, architecture cards, and repository contract", async () => {
  const [aboutSource, aboutContentSource, stylesSource] = await Promise.all([
    read("app/about-site.tsx"),
    read("app/about-site-content.ts"),
    read("app/globals.css"),
  ]);

  assert.match(aboutSource, /View source on GitHub/);
  assert.match(aboutSource, /const interviewHref = sectionNavigationHref\("interview", mode\)/);
  assert.doesNotMatch(aboutSource, /#interview/);
  assert.match(aboutSource, /ABOUT_OVERVIEW\.title/);
  assert.match(aboutSource, /DEPLOYMENT\.title/);
  assert.match(aboutSource, /DATABASE\.title/);
  assert.match(aboutSource, /OPENAI\.title/);
  assert.match(aboutSource, /GRAFANA\.title/);
  assert.match(aboutContentSource, /https:\/\/github\.com\/sergiiiavt\/gimme-job/);
  assert.doesNotMatch(aboutContentSource, /sergiiiavt\/gimmejob/);
  assert.match(aboutSource, /about-tech-purpose-grid/);
  assert.match(aboutSource, /about-tech-overview-heading/);
  assert.match(aboutSource, /FlowArrow/);
  assert.match(aboutSource, /TechNode/);
  assert.doesNotMatch(aboutSource, /about-tech-page-header/);
  assert.doesNotMatch(aboutSource, /production pet project/i);
  assert.doesNotMatch(aboutSource, /skills showcase/i);
  assert.doesNotMatch(aboutSource, /researched QA questions/);
  assert.doesNotMatch(aboutSource, /about-hero/);
  assert.match(stylesSource, /\.about-tech-purpose-card p \{[^}]*font-size: 11px/);
});
