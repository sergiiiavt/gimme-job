import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("publishes a dedicated source-backed performance interview domain", async () => {
  const [core, practical, domains, subtopics, catalogSource, routeSource, ukRouteSource, navigationSource, seoSource] = await Promise.all([
    readJson("content/interview/performance-testing-core-qa.json"),
    readJson("content/interview/performance-testing-practical-qa.json"),
    readJson("content/interview/domains.json"),
    readJson("content/interview/performance-testing-subtopics.json"),
    readFile(projectFile("content/interview/catalog.ts"), "utf8"),
    readFile(projectFile("content/interview/domain-routes.ts"), "utf8"),
    readFile(projectFile("content/interview/ukrainian-routes.ts"), "utf8"),
    readFile(projectFile("app/navigation-paths.ts"), "utf8"),
    readFile(projectFile("app/seo.ts"), "utf8"),
  ]);

  const questions = [...core.questions, ...practical.questions];
  assert.equal(questions.length, 22);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.ok(questions.every((question) => question.category === "Performance Testing"));

  assert.equal(domains.categoryToDomain["Performance and resilience"], "Performance Testing");
  assert.equal(domains.categoryToDomain["Performance Testing"], "Performance Testing");
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
});

test("publishes the methodical performance learning path and retrieval registration", async () => {
  const [learning, pageSource, publicRouteSource, privateRouteSource, ragSource, packageSource] = await Promise.all([
    readJson("content/performance-testing/catalog.json"),
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

  assert.match(pageSource, /LearningDocumentPage/);
  assert.match(pageSource, /section="performance"/);
  assert.match(pageSource, /languages=\{\["en"\]\}/);
  assert.match(publicRouteSource, /PerformanceTestingPage mode="public"/);
  assert.match(privateRouteSource, /PerformanceTestingPage mode="personal"/);
  assert.match(ragSource, /key: "performance-testing", route: "\/learn\/performance"/);
  assert.match(packageSource, /validate-performance-testing-content\.mjs/);
});
