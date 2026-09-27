import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("learning headers keep only structural context", async () => {
  const [hero, sharedPage, topicPage, css] = await Promise.all([
    read("app/learning-document-ui.tsx"),
    read("app/learning-document-page.tsx"),
    read("app/topic-learning-page.tsx"),
    read("app/qa-fundamentals-page.module.css"),
  ]);

  assert.match(hero, /LearningHero\(\{ eyebrow, title \}/);
  assert.doesNotMatch(hero, /description: string|meta: string\[\]|styles\.meta|<p>\{description\}<\/p>/);
  assert.doesNotMatch(sharedPage, /heroMeta/);
  assert.doesNotMatch(topicPage, /defaultMeta|publishedTopicMeta/);
  assert.doesNotMatch(css, /\.meta\s*\{/);

  const heroBlock = css.match(/\.hero\s*\{[\s\S]*?\}/)?.[0] ?? "";
  assert.doesNotMatch(heroBlock, /border-bottom|padding-bottom/);
});

test("all published learning surfaces use the minimal shared header", async () => {
  const paths = [
    "app/cloud-devops-page.tsx",
    "app/testing-tools-page.tsx",
    "app/performance-testing-page.tsx",
    "app/qa-fundamentals-page.tsx",
    "app/data-learning-page.tsx",
    "app/metrics-estimation-page.tsx",
    "app/programming-learning-page.tsx",
    "app/networking-page.tsx",
    "app/api-integration-page.tsx",
    "app/embedded-iot-page.tsx",
    "app/istqb-ai-testing-page.tsx",
    "app/agentic-learning-page.tsx",
  ];

  for (const path of paths) {
    const source = await read(path);
    assert.doesNotMatch(source, /heroMeta=/, `${path} must not add marketing metadata to the header`);
    assert.doesNotMatch(source, /<LearningHero[^>]*(?:description|meta)=/, `${path} must not put descriptions or badges in the header`);
  }
});
