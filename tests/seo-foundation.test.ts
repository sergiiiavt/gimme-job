import assert from "node:assert/strict";
import test from "node:test";
import AboutLayout, { metadata as aboutMetadata } from "../app/about/layout.tsx";
import FightAiSlopLayout from "../app/fight-ai-slop/layout.tsx";
import InterviewLayout from "../app/interview/layout.tsx";
import PythonInterviewLayout from "../app/interview/python/layout.tsx";
import LearningSectionLayout, { generateMetadata as generateLearningMetadata } from "../app/learn/[section]/layout.tsx";
import AgenticLearningLayout from "../app/learn/agentic/layout.tsx";
import AutomationLearningLayout from "../app/learn/automation/layout.tsx";
import CloudDevopsLearningLayout from "../app/learn/cloud-devops/layout.tsx";
import MetricsEstimationLearningLayout from "../app/learn/metrics-estimation/layout.tsx";
import ProgrammingLearningLayout from "../app/learn/programming/layout.tsx";
import QaFundamentalsLearningLayout from "../app/learn/qa-fundamentals/layout.tsx";
import TestingToolsLearningLayout from "../app/learn/testing-tools/layout.tsx";
import NewsLayout from "../app/news/layout.tsx";
import ReferenceSectionLayout, { generateMetadata as generateReferenceMetadata } from "../app/reference/[section]/layout.tsx";
import ResumeLayout from "../app/resume/layout.tsx";
import TrendsLayout from "../app/trends/layout.tsx";
import VacanciesLayout from "../app/vacancies/layout.tsx";
import robots from "../app/robots.ts";
import {
  LEARNING_SEO,
  PUBLIC_SITEMAP_PATHS,
  REFERENCE_SEO,
  SITE_NAME,
  SITE_ORIGIN,
  createPageMetadata,
  learningSectionMetadata,
  legacyReferenceMetadata,
  noIndexMetadata,
  referenceSectionMetadata,
} from "../app/seo.ts";
import sitemap from "../app/sitemap.ts";

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

test("learning and reference metadata cover known, fallback, and legacy routes", () => {
  assert.equal(canonical(learningSectionMetadata("automation")), LEARNING_SEO.automation.path);
  assert.equal(canonical(learningSectionMetadata("release-readiness")), "/learn/release-readiness");
  assert.equal(learningSectionMetadata("release-readiness").title, "Release Readiness Learning | GimmeJob");

  assert.equal(canonical(referenceSectionMetadata("data")), REFERENCE_SEO.data.path);
  assert.equal(canonical(referenceSectionMetadata("debugging")), "/reference/debugging");
  assert.equal(referenceSectionMetadata("debugging").title, "Debugging Reference | GimmeJob");

  assert.equal(canonical(legacyReferenceMetadata("programming")), "/reference/programming");

  const privateMetadata = noIndexMetadata("Private workspace", "Private data.");
  assert.equal(privateMetadata.title, "Private workspace | GimmeJob");
  assert.deepEqual(privateMetadata.robots, { index: false, follow: false, nocache: true });
});

test("sitemap publishes canonical public URLs only", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);

  assert.equal(entries.length, PUBLIC_SITEMAP_PATHS.length);
  assert.ok(urls.includes(`${SITE_ORIGIN}/interview`));
  assert.ok(urls.includes(`${SITE_ORIGIN}/interview/python`));
  assert.ok(urls.includes(`${SITE_ORIGIN}/reference/data`));
  assert.equal(urls.some((url) => url.includes("/workspace")), false);
  assert.equal(urls.some((url) => url.endsWith("/learn/data")), false);
  assert.equal(new Set(urls).size, urls.length);
});

test("robots blocks service endpoints but leaves noindex pages crawlable", () => {
  const policy = robots();
  assert.equal(policy.sitemap, `${SITE_ORIGIN}/sitemap.xml`);
  assert.equal(policy.host, SITE_ORIGIN);

  const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;
  assert.equal(rule.userAgent, "*");
  assert.equal(rule.allow, "/");
  assert.deepEqual(rule.disallow, ["/api/", "/auth/"]);
  assert.equal((rule.disallow as string[]).includes("/workspace/"), false);
});

test("dynamic route metadata uses canonical targets", async () => {
  const automation = await generateLearningMetadata({ params: Promise.resolve({ section: "automation" }) });
  const legacyData = await generateLearningMetadata({ params: Promise.resolve({ section: "data" }) });
  const dataReference = await generateReferenceMetadata({ params: Promise.resolve({ section: "data" }) });

  assert.equal(canonical(automation), "/learn/automation");
  assert.equal(canonical(legacyData), "/reference/data");
  assert.equal(canonical(dataReference), "/reference/data");
  assert.equal(canonical(aboutMetadata), "/about");
});

test("SEO layout wrappers preserve their child content", () => {
  const child = "seo-child";
  const wrappers = [
    AboutLayout,
    FightAiSlopLayout,
    InterviewLayout,
    PythonInterviewLayout,
    LearningSectionLayout,
    AgenticLearningLayout,
    AutomationLearningLayout,
    CloudDevopsLearningLayout,
    MetricsEstimationLearningLayout,
    ProgrammingLearningLayout,
    QaFundamentalsLearningLayout,
    TestingToolsLearningLayout,
    NewsLayout,
    ReferenceSectionLayout,
    ResumeLayout,
    TrendsLayout,
    VacanciesLayout,
  ];

  for (const Layout of wrappers) {
    assert.equal(Layout({ children: child }), child);
  }
});
