import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readText = (path) => readFile(projectFile(path), "utf8");

test("switches interview domains client-side without losing the scoped catalog", async () => {
  const [switcher, catalog] = await Promise.all([
    readText("app/interview-domain-switcher-overlay.tsx"),
    readText("content/interview/catalog.ts"),
  ]);

  assert.match(switcher, /import Link from "next\/link"/);
  assert.match(switcher, /scroll=\{false\}/);
  assert.match(switcher, /setInterviewCatalogDomain\(domain\.id\)/);
  assert.match(switcher, /resetInterviewViewState\(\)/);
  assert.doesNotMatch(switcher, /<a\s/);

  assert.match(catalog, /export function interviewCatalogForDomain/);
  assert.match(catalog, /export function setInterviewCatalogDomain/);
  assert.match(catalog, /Object\.assign\(interviewCatalog, interviewCatalogForDomain\(domainId\)\)/);
});

test("remembers the last interview domain across primary-site navigation", async () => {
  const [layout, memory, state] = await Promise.all([
    readText("app/layout.tsx"),
    readText("app/interview-navigation-memory.ts"),
    readText("app/interview-navigation-state.tsx"),
  ]);

  assert.match(layout, /<InterviewNavigationState\/>/);
  assert.match(memory, /localStorage\.setItem\(LAST_INTERVIEW_PATH_KEY/);
  assert.match(memory, /localStorage\.getItem\(LAST_INTERVIEW_PATH_KEY\)/);
  assert.match(state, /Interview questions/);
  assert.match(state, /router\.push\(rememberedPath\)/);
  assert.match(state, /data-interview-return-link|dataset\.interviewReturnLink/);
});

test("removes the visible page language switch while keeping SEO language alternates", async () => {
  const [overlay, domainPage] = await Promise.all([
    readText("app/interview-seo-overlay.tsx"),
    readText("app/interview/[domain]/page.tsx"),
  ]);

  assert.doesNotMatch(overlay, /iq-seo-language/);
  assert.doesNotMatch(overlay, /Page language/);
  assert.doesNotMatch(overlay, />Language</);
  assert.match(domainPage, /bilingualLanguageAlternates\(route\.path, `\/uk\$\{route\.path\}`\)/);
});
