import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots.ts";
import {
  DEFAULT_OG_IMAGE,
  HOME_TITLE,
  LEARNING_SEO,
  PUBLIC_SITEMAP_PATHS,
  REFERENCE_SEO,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_PAGE_SEO,
  UKRAINIAN_SITEMAP_PATHS,
  bilingualLanguageAlternates,
  breadcrumbJsonLd,
  createPageMetadata,
  isIndexableSeoPage,
  learningSectionMetadata,
  metaDescription,
  noIndexMetadata,
  referenceSectionMetadata,
} from "../app/seo.ts";

const canonical = (metadata: ReturnType<typeof createPageMetadata>) => metadata.alternates?.canonical;
const openGraphField = (metadata: ReturnType<typeof createPageMetadata>, field: "locale" | "alternateLocale") =>
  (metadata.openGraph as Record<string, unknown> | undefined)?.[field];

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
  assert.equal(metadata.robots, undefined);
});

test("page metadata always carries a large social preview image", () => {
  const metadata = createPageMetadata(SITE_PAGE_SEO.home);
  const ukrainian = createPageMetadata(
    { title: "SQL", description: "SQL.", path: "/uk/interview/sql" },
    bilingualLanguageAlternates("/interview/sql"),
  );

  assert.equal(metadata.title, HOME_TITLE);
  assert.equal(canonical(metadata), "/");
  assert.deepEqual(metadata.openGraph?.images, [DEFAULT_OG_IMAGE]);
  assert.deepEqual(metadata.twitter?.images, [DEFAULT_OG_IMAGE.url]);
  assert.equal((metadata.twitter as Record<string, unknown> | undefined)?.card, "summary_large_image");
  assert.equal(openGraphField(metadata, "locale"), "en_US");
  assert.equal(openGraphField(ukrainian, "locale"), "uk_UA");
  assert.equal(openGraphField(ukrainian, "alternateLocale"), "en_US");
});

test("under-construction pages stay crawlable but are not indexed", () => {
  const metadata = createPageMetadata(SITE_PAGE_SEO.trends);

  assert.equal(isIndexableSeoPage(SITE_PAGE_SEO.trends), false);
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.equal(canonical(metadata), "/trends");
});

test("duplicate introduction surfaces canonicalize to the home page", () => {
  assert.equal(canonical(createPageMetadata(SITE_PAGE_SEO.about)), "/");
});

test("meta descriptions are trimmed on a word boundary to snippet length", () => {
  const long = `Use \`EXPLAIN\` to read the plan. ${"Indexes trade write cost for faster selective reads. ".repeat(6)}`;
  const description = metaDescription(long);

  assert.ok(description.length <= 155);
  assert.ok(description.startsWith("Use EXPLAIN to read the plan."));
  assert.match(description, /\S…$/);
  assert.equal(metaDescription("  Short   answer. "), "Short answer.");
});

test("breadcrumb structured data uses absolute canonical URLs", () => {
  assert.deepEqual(breadcrumbJsonLd([
    { name: "Interview questions", path: "/interview" },
    { name: "SQL", path: "/interview/sql?question=joins" },
  ]), {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Interview questions", item: `${SITE_ORIGIN}/interview` },
      { "@type": "ListItem", position: 2, name: "SQL", item: `${SITE_ORIGIN}/interview/sql?question=joins` },
    ],
  });
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

test("reference metadata covers known and fallback routes", () => {
  assert.equal(canonical(referenceSectionMetadata("data")), REFERENCE_SEO.data.path);
  assert.equal(canonical(referenceSectionMetadata("debugging")), "/reference/debugging");
  assert.equal(referenceSectionMetadata("debugging").title, "Debugging Reference | GimmeJob");
});

test("learning paths and quick references keep separate self-canonical URLs", () => {
  for (const section of ["qa-fundamentals", "programming", "data"]) {
    assert.equal(canonical(learningSectionMetadata(section)), `/learn/${section}`);
    assert.equal(canonical(referenceSectionMetadata(section)), `/reference/${section}`);
    assert.notEqual(LEARNING_SEO[section].title, REFERENCE_SEO[section].title);
  }
});

test("noindex metadata is explicit and non-cacheable", () => {
  const privateMetadata = noIndexMetadata("Private workspace", "Private data.");
  assert.equal(privateMetadata.title, "Private workspace | GimmeJob");
  assert.equal(privateMetadata.description, "Private data.");
  assert.deepEqual(privateMetadata.robots, { index: false, follow: false, nocache: true });
});

test("public sitemap lists only canonical, indexable landing pages", () => {
  const paths = new Set(PUBLIC_SITEMAP_PATHS);

  for (const path of [
    "/",
    "/interview",
    "/interview/python",
    "/interview/performance",
    "/learn/automation",
    "/learn/data",
    "/learn/performance",
    "/learn/qa-fundamentals",
    "/learn/programming",
    "/reference/data",
    "/playgrounds/databases",
  ]) {
    assert.ok(paths.has(path), `${path} should be in the sitemap`);
  }
  for (const path of ["/about", "/learn", "/interview/generic-qa", "/uk/interview/generic-qa", "/trends", "/news", "/learn/strategy"]) {
    assert.equal(paths.has(path), false, `${path} is a duplicate or placeholder and must stay out of the sitemap`);
  }
  assert.ok(UKRAINIAN_SITEMAP_PATHS.includes("/uk/interview"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.includes("/uk/interview/python"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.includes("/uk/interview/performance"));
  assert.ok(UKRAINIAN_SITEMAP_PATHS.every((path) => paths.has(path)));
  assert.equal(PUBLIC_SITEMAP_PATHS.some((path) => path.includes("/workspace")), false);
  assert.equal(paths.size, PUBLIC_SITEMAP_PATHS.length);
  for (const page of Object.values(LEARNING_SEO)) {
    assert.equal(paths.has(page.path), isIndexableSeoPage(page), `${page.path} sitemap membership must follow its maturity`);
  }
});

test("robots policy blocks service endpoints but leaves noindex workspace crawlable", () => {
  const policy = robots();
  const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
  const disallow = rules.flatMap((rule) => rule.disallow ?? []);

  assert.deepEqual(disallow, ["/api/", "/auth", "/internal/", "/mcp"]);
  assert.equal(disallow.some((path) => path.startsWith("/workspace")), false);
  assert.equal(policy.sitemap, `${SITE_ORIGIN}/sitemap.xml`);
  assert.equal(policy.host, SITE_ORIGIN);
  assert.equal(SITE_ORIGIN, "https://gimme-job.com");
});
