import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LEARNING_SEO,
  PUBLIC_SITEMAP_PATHS,
  REFERENCE_SEO,
  SITE_NAME,
  SITE_ORIGIN,
  UKRAINIAN_SITEMAP_PATHS,
  bilingualLanguageAlternates,
  createPageMetadata,
  learningSectionMetadata,
  legacyReferenceMetadata,
  noIndexMetadata,
  referenceSectionMetadata,
} from "../app/seo.ts";

const canonical = (metadata: ReturnType<typeof createPageMetadata>) => metadata.alternates?.canonical;

test("SEO metadata helpers create branded canonical metadata", () => {
  const metadata = createPageMetadata({
    title: "API Testing",
    description: "Practical API testing guidance.",
    path: "/learn/api",
  });

  assert.equal(metadata.title, `API Testing | ${SITE_NAME}`);
  assert.equal(metadata.description, "Practical API testing guidance.");
  assert.equal(canonical(metadata), "/learn/api");
  assert.equal(metadata.openGraph?.url, "/learn/api");
  assert.equal(metadata.twitter?.title, `API Testing | ${SITE_NAME}`);
});

test("bilingual metadata keeps reciprocal English, Ukrainian, and x-default alternates", () => {
  const languages = bilingualLanguageAlternates("/interview/sql", "/uk/interview/sql");
  const metadata = createPageMetadata({
    title: "SQL interview questions",
    description: "SQL interview preparation.",
    path: "/interview/sql",
  }, languages);
  const ukrainianMetadata = createPageMetadata({
    title: "SQL питання для співбесіди",
    description: "Підготовка до SQL співбесіди.",
    path: "/uk/interview/sql",
  }, languages);

  assert.deepEqual(languages, {
    en: "/interview/sql",
    uk: "/uk/interview/sql",
    "x-default": "/interview/sql",
  });
  assert.deepEqual(metadata.alternates?.languages, languages);
  assert.equal(canonical(metadata), "/interview/sql");
  assert.deepEqual(ukrainianMetadata.alternates?.languages, languages);
  assert.equal(canonical(ukrainianMetadata), "/uk/interview/sql");
  assert.equal(bilingualLanguageAlternates("interview/sql").uk, "/uk/interview/sql");
});

test("learning metadata covers known and fallback routes", () => {
  assert.equal(canonical(learningSectionMetadata("automation")), LEARNING_SEO.automation.path);
  assert.equal(canonical(learningSectionMetadata("data")), LEARNING_SEO.data.path);
  assert.equal(canonical(learningSectionMetadata("release-readiness")), "/learn/release-readiness");
  assert.equal(learningSectionMetadata("release-readiness").title, "Release Readiness Learning | GimmeJob");

  const sparseSlug = learningSectionMetadata("--release--readiness--");
  assert.equal(sparseSlug.title, "Release Readiness Learning | GimmeJob");
});

test("reference metadata covers known, fallback, and legacy routes", () => {
  assert.equal(canonical(referenceSectionMetadata("data")), REFERENCE_SEO.data.path);
  assert.equal(canonical(referenceSectionMetadata("debugging")), "/reference/debugging");
  assert.equal(referenceSectionMetadata("debugging").title, "Debugging Reference | GimmeJob");
  assert.equal(canonical(legacyReferenceMetadata("programming")), "/reference/programming");
});

test("noindex metadata is explicit and non-cacheable", () => {
  const privateMetadata = noIndexMetadata("Private workspace", "Private data.");
  assert.equal(privateMetadata.title, "Private workspace | GimmeJob");
  assert.equal(privateMetadata.description, "Private data.");
  assert.deepEqual(privateMetadata.robots, { index: false, follow: false, nocache: true });
});

test("public sitemap source is generated only from the canonical route registry", async () => {
  const source = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");

  assert.ok(source.includes("PUBLIC_SITEMAP_PATHS.map"));
  assert.ok(source.includes("new URL(path, SITE_ORIGIN).toString()"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/interview"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/interview/python"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/interview/performance"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/learn/automation"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/learn/data"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/learn/performance"));
  assert.ok(PUBLIC_SITEMAP_PATHS.includes("/reference/data"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.includes("/uk/interview"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.includes("/uk/interview/python"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.includes("/uk/interview/performance"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.every((path) => PUBLIC_SITEMAP_PATHS.includes(path)));
  assert.equal(PUBLIC_SITEMAP_PATHS.some((path) => path.includes("/workspace")), false);
  assert.equal(new Set(PUBLIC_SITEMAP_PATHS).size, PUBLIC_SITEMAP_PATHS.length);
});

test("robots source blocks service endpoints but leaves noindex workspace crawlable", async () => {
  const source = await readFile(new URL("../app/robots.ts", import.meta.url), "utf8");

  assert.match(source, /["']\/api\/["']/);
  assert.match(source, /["']\/auth\/?["']/);
  assert.doesNotMatch(source, /["']\/workspace\/?["']/);
  assert.ok(source.includes('sitemap: `${SITE_ORIGIN}/sitemap.xml`'));
  assert.ok(source.includes("host: SITE_ORIGIN"));
  assert.equal(SITE_ORIGIN, "https://gimme-job.com");
});
