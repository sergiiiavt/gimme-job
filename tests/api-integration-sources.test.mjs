import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const readJson = (path) => readFile(projectFile(path), "utf8").then(JSON.parse);

test("API integration uses the shared learning source registry pattern", async () => {
  const [catalog, sources, topicPage, learningUi] = await Promise.all([
    readFile(projectFile("content/api-integration/catalog.ts"), "utf8"),
    readJson("content/api-integration/sources.json"),
    readFile(projectFile("app/topic-learning-page.tsx"), "utf8"),
    readFile(projectFile("app/learning-document-ui.tsx"), "utf8"),
  ]);

  assert.match(catalog, /import sourcesData from "\.\/sources\.json"/);
  assert.match(catalog, /sourceIds: \[/);
  assert.match(catalog, /sources,/);

  const sourceIds = new Set(sources.map((source) => source.id));
  for (const id of [
    "rfc-9110",
    "rfc-8259",
    "openapi-3-2",
    "rfc-9700",
    "rfc-6455",
  ]) {
    assert.ok(sourceIds.has(id), `Missing API registry source ${id}`);
  }

  for (const source of sources) {
    assert.ok(source.id?.trim(), "Every source needs an id");
    assert.ok(source.title?.trim(), `${source.id} needs a title`);
    assert.ok(source.publisher?.trim(), `${source.id} needs a publisher`);
    assert.ok(source.kind?.trim(), `${source.id} needs a kind`);
    assert.ok(source.role?.trim(), `${source.id} needs a role`);
    assert.match(source.url, /^https:\/\//, `${source.id} needs an external HTTPS URL`);
  }

  assert.match(topicPage, /LearningSourceRegistry/);
  assert.match(topicPage, /stripSourceSections/);
  assert.match(topicPage, /sourceSectionIds/);
  assert.match(topicPage, /MarkdownDocument markdown=\{renderedMarkdown\}/);
  assert.match(topicPage, /topicSources\.map/);

  assert.match(learningUi, /id="source-registry"/);
  assert.match(learningUi, /Source registry/);
  assert.match(learningUi, /References/);
});

test("published API topics map their legacy source lists into one registry", async () => {
  const catalog = await readFile(projectFile("content/api-integration/catalog.ts"), "utf8");

  for (const topicId of [
    "http-foundations",
    "data-formats",
    "contracts-and-schemas",
    "identity-and-authorization",
    "websocket",
  ]) {
    assert.match(
      catalog,
      new RegExp(`id: "${topicId}"[\\s\\S]*?sourceIds: \\[`),
      `${topicId} must declare sourceIds`,
    );
  }

  assert.match(catalog, /underConstruction[\s\S]*sourceIds: \[\]/);
});
