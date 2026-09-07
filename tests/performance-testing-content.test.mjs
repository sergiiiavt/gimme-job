import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("publishes a dedicated source-backed performance interview domain", async () => {
  const [core, practical, domains, subtopics, catalogSource, routeSource, ukRouteSource, navigationSource, seoSource, switcherSource] = await Promise.all([
    readJson("content/interview/performance-testing-core-qa.json"),
    readJson("content/interview/performance-testing-practical-qa.json"),
    readJson("content/interview/domains.json"),
    readJson("content/interview/performance-testing-subtopics.json"),
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/domain-routes.ts"), "utf8"),
    readFile(projectFile("content/interview/ukrainian-routes.ts"), "utf8"),
    readFile(projectFile("app/navigation-paths.ts"), "utf8"),
    readFile(projectFile("app/seo.ts"), "utf8"),
    readFile(projectFile("app/interview-domain-switcher-overlay.tsx"), "utf8"),
  ]);

  const questions = [...core.questions, ...practical.questions];
  assert.equal(questions.length, 22);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.ok(questions.every((question) => question.category === "Performance Testing"));

  assert.equal(domains.categoryToDomain["Performance and resilience"], "Performance Testing");
  assert.equal(Object.prototype.hasOwnProperty.call(domains.categoryToDomain, "Performance Testing"), false);
  assert.ok(domains.taxonomy.some((domain) => domain.id === "performance-testing" && domain.category === "Performance Testing"));
  assert.ok(subtopics.taxonomy.length >= 8);

  assert.match(catalogSource, /researchedPerformanceQuestions/);
  assert.match(catalogSource, /category: "Performance and resilience"/);
  assert.match(catalogSource, /performanceTestingCore\.questions/);
  assert.match(catalogSource, /performanceTestingPractical\.questions/);
  assert.match(catalogSource, /performanceTestingSources/);
  assert.match(routeSource, /id: "performance-testing"/);
  assert.match(routeSource, /path: "\/interview\/performance"/);
  assert.match(ukRouteSource, /performance:\s*\{/);
  assert.match(navigationSource, /"web-api", "performance", "mobile"/);
  assert.match(seoSource, /"\/interview\/performance"/);
  assert.match(seoSource, /"\/uk\/interview\/performance"/);
  assert.match(switcherSource, /id: "performance-testing"/);
  assert.match(switcherSource, /"\/interview\/performance"/);
});

test("publishes the methodical performance learning path with Ukrainian localization and the real GimmeJob Locust walkthrough", async () => {
  const [learning, localization, locustEn, locustUk, locustExecution, locustSources, catalogSource, pageSource, publicRouteSource, privateRouteSource, ragSource, packageSource] = await Promise.all([
    readJson("content/performance-testing/catalog.json"),
    readJson("content/performance-testing/localization.uk.json"),
    readJson("content/performance-testing/gimmejob-locust.en.json"),
    readJson("content/performance-testing/gimmejob-locust.uk.json"),
    readJson("content/performance-testing/gimmejob-locust-execution.json"),
    readJson("content/performance-testing/sources-gimmejob-locust.json"),
    readFile(projectFile("content/performance-testing/catalog.ts"), "utf8"),
    readFile(projectFile("app/performance-testing-page.tsx"), "utf8"),
    readFile(projectFile("app/learn/performance/page.tsx"), "utf8"),
    readFile(projectFile("app/workspace/learn/performance/page.tsx"), "utf8"),
    readFile(projectFile("content/learning-rag-registry.ts"), "utf8"),
    readFile(projectFile("package.json"), "utf8"),
  ]);

  assert.deepEqual(
    learning.chapters.map((chapter) => chapter.id),
    [
      "foundations",
      "workload-model",
      "metrics-objectives",
      "environment-scripts-data",
      "jmeter-workflow",
      "k6-locust",
      "diagnosis-resilience",
      "ci-reporting",
    ],
  );
  assert.ok(learning.sources.length >= 10);
  assert.ok(learning.sources.every((source) => source.kind.startsWith("Official")));
  assert.doesNotMatch(learning.chapters.map((chapter) => chapter.markdown).join("\n"), /practice exercise/i);

  assert.equal(localization.chapters.length, 9);
  assert.equal(localization.chapters.at(-1)?.id, "locust-performance-testing");
  assert.ok(localization.title.includes("продуктивності"));

  const ukChapterFiles = await Promise.all(
    Array.from({ length: 8 }, (_, index) => readJson(`content/performance-testing/chapter-${String(index + 1).padStart(2, "0")}.uk.json`)),
  );
  assert.deepEqual(ukChapterFiles.map((chapter) => chapter.id), learning.chapters.map((chapter) => chapter.id));
  assert.ok(ukChapterFiles.every((chapter) => chapter.markdownUk?.trim().length >= 1500));

  for (const markdown of [locustEn.markdown, locustUk.markdownUk]) {
    assert.match(markdown, /tests\/performance\/gimmejob\/locustfile\.py/);
    assert.match(markdown, /GET \/api\/health/);
    assert.match(markdown, /GET \/api\/public\/jobs/);
    assert.match(markdown, /GET \/api\/dashboard/);
    assert.match(markdown, /between\(2, 5\)/);
    assert.match(markdown, /LOCUST_TAGS=smoke/);
    assert.match(markdown, /2\.82/);
  }

  for (const markdown of [locustExecution.en, locustExecution.uk]) {
    assert.match(markdown, /Azure Load Testing engine/);
    assert.match(markdown, /LOCUST_TAGS=public-read/);
    assert.match(markdown, /gimmejob-db/);
    assert.match(markdown, /Cloudflare/);
  }

  assert.ok(locustSources.some((source) => source.url === "https://github.com/sergiiiavt/gimme-job/blob/main/tests/performance/gimmejob/locustfile.py"));
  assert.ok(locustSources.some((source) => source.url === "https://github.com/sergiiiavt/gimme-job/blob/main/tests/performance/gimmejob/README.md"));
  assert.ok(locustSources.some((source) => source.url === "https://developers.cloudflare.com/workers/observability/metrics-and-analytics/"));
  assert.ok(locustSources.some((source) => source.url === "https://developers.cloudflare.com/d1/observability/metrics-analytics/"));

  assert.match(catalogSource, /gimmejob-locust\.en\.json/);
  assert.match(catalogSource, /gimmejob-locust\.uk\.json/);
  assert.match(catalogSource, /gimmejob-locust-execution\.json/);
  assert.match(catalogSource, /obsoleteLocustSectionsPattern/);
  assert.match(catalogSource, /prepareGimmeJobLocustMarkdown/);
  assert.match(catalogSource, /repoPathPattern/);
  assert.match(catalogSource, /github\.com\/\$\{GIMMEJOB_REPO\}\/blob\/main\/\$\{path\}/);
  assert.match(catalogSource, /chapters: \[\.\.\.localizedBaseChapters, gimmeJobLocustChapter\]/);

  assert.match(pageSource, /LearningDocumentPage/);
  assert.match(pageSource, /section="performance"/);
  assert.match(pageSource, /titleUk: performanceTestingCatalog\.titleUk/);
  assert.match(pageSource, /languages=\{\["en", "uk"\]\}/);
  assert.match(publicRouteSource, /PerformanceTestingPage mode="public"/);
  assert.match(privateRouteSource, /PerformanceTestingPage mode="personal"/);
  assert.match(ragSource, /key: "performance-testing", route: "\/learn\/performance"/);
  assert.match(packageSource, /validate-performance-testing-content\.mjs/);
});
