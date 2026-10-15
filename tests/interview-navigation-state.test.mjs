import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readText = (path) => readFile(projectFile(path), "utf8");

test("restores the questions for the selected interview tile after navigation and refresh", async () => {
  const [switcher, catalog, publicSite, domainPage] = await Promise.all([
    readText("app/interview-domain-switcher-overlay.tsx"),
    readText("content/interview/catalog.ts"),
    readText("app/public-site.tsx"),
    readText("app/interview/interview-domain-page-client.tsx"),
  ]);

  // Tile highlighting is route-based; the visible questions must use that same route.
  assert.match(switcher, /import Link from "next\/link"/);
  assert.match(switcher, /scroll=\{false\}/);
  assert.match(switcher, /resetInterviewViewState\(\)/);
  assert.doesNotMatch(switcher, /setInterviewCatalogDomain/);
  assert.doesNotMatch(switcher, /<a\s/);

  // The singleton is a full question index, never a mutable or location-derived view.
  assert.match(catalog, /export function interviewCatalogForDomain/);
  assert.match(catalog, /export const interviewCatalog = buildInterviewCatalog\("generic-qa", false\)/);
  assert.doesNotMatch(catalog, /window\.location\.pathname|Object\.assign\(interviewCatalog/);

  // A cached domain cannot be rendered for a different route (including browser back).
  assert.match(publicSite, /interviewDomainRouteFromPathname\(pathname\)\?\.id \?\? "generic-qa"/);
  assert.match(publicSite, /interviewCatalogState\?\.domainId === interviewDomainId/);
  assert.match(publicSite, /module\.interviewCatalogForDomain\(interviewDomainId\)/);
  assert.match(publicSite, /\[interviewCatalog, interviewDomainId, section\]/);
  assert.doesNotMatch(publicSite, /setInterviewCatalog\(module\.default/);

  // SEO/code overlays use the same domain-scoped questions, not the global index.
  assert.match(domainPage, /interviewDomainRouteBySlug\(domainSlug \?\? ""\)\?\.id \?\? "generic-qa"/);
  assert.match(domainPage, /useMemo\(\(\) => interviewCatalogForDomain\(domainId\), \[domainId\]\)/);
  assert.match(domainPage, /<InterviewQuestionCodeOverlay questions=\{scopedCatalog\.questions\}/);
  assert.match(domainPage, /<SqlInterviewRunnableOverlay questions=\{scopedCatalog\.questions\}/);
  assert.match(domainPage, /<InterviewQuestionLinkOverlay [^>]*questions=\{scopedCatalog\.questions\}/);
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
  assert.match(domainPage, /bilingualLanguageAlternates\(canonicalPath, `\/uk\$\{canonicalPath\}`\)/);
});
