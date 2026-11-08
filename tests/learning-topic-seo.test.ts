import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [
  { learningTopicMetadata, learningTopicPages },
  { default: sitemap },
  { default: learningRagSources, learningCatalogItems },
  { automationTrackOptions },
] = await Promise.all([
  import("../app/learning-topic-seo.ts"),
  import("../app/sitemap.ts"),
  import("../content/learning-rag-registry.ts"),
  import("../content/automation-learning/tracks.ts"),
]);

type Item = Record<string, unknown>;

function catalogFor(key: string): Item[] {
  const source = learningRagSources.find((entry) => entry.key === key);
  assert.ok(source, `${key} is registered`);
  return learningCatalogItems(source.value);
}

function pageAt(path: string) {
  return learningTopicPages().find((page) => page.path === path);
}

const llmTopic = catalogFor("llm-testing").find((item) => item.status === "published")!;
const llmTopicPath = `/learn/llm?topic=${llmTopic.id}`;
const desktopTrack = automationTrackOptions.find((option) => option.id === "real-projects")!;
const desktopModule = desktopTrack.moduleIds.at(-1)!;
const foundationsModule = automationTrackOptions.find((option) => option.id === "foundations")!.moduleIds[1]!;
const csharpTopic = catalogFor("csharp")[0]!;
const apiPlaceholder = catalogFor("api-integration").find((item) => item.status === "under-construction")!;
const sqlCard = catalogFor("sql-quick-reference")[0]!;

test("every learning topic page is a canonical topic link of its route", () => {
  const pages = learningTopicPages();
  assert.ok(pages.length > 0);
  assert.equal(new Set(pages.map((page) => page.path)).size, pages.length, "one page per topic link");
  for (const page of pages) {
    const url = new URL(page.path, "https://gimme-job.com");
    assert.equal(url.pathname, page.route);
    assert.deepEqual([...url.searchParams.keys()], page.track ? ["topic", "track"] : ["topic"], page.path);
    assert.equal(url.searchParams.get("topic"), page.topic);
    assert.ok(page.title && page.description, `${page.path} has a title and description`);
    assert.ok(page.description.length <= 155, `${page.path} description fits a snippet`);
  }
});

test("topics carry the track their page needs to open them", () => {
  assert.ok(pageAt(`/learn/automation?topic=${desktopModule}&track=real-projects`), "automation modules link their own track");
  assert.ok(pageAt(`/learn/programming?topic=${csharpTopic.id}&track=csharp`), "registry tracks are kept");
  assert.equal(learningTopicPages().some((page) => page.route === "/learn/automation" && !page.track), false);
});

test("QA fundamentals topics are canonical on the page that renders them", () => {
  const qaPages = learningTopicPages().filter((page) => page.topic && catalogFor("qa-fundamentals").some((item) => item.id === page.topic));
  assert.ok(qaPages.length > 0);
  assert.ok(qaPages.every((page) => page.route === "/learn/qa-fundamentals"));
  assert.equal(learningTopicPages().some((page) => page.route.startsWith("/reference/")), false);
});

test("placeholders and quick-reference cards are not topic pages", () => {
  assert.equal(pageAt(`/learn/api?topic=${apiPlaceholder.id}`), undefined);
  assert.equal(learningTopicPages().some((page) => page.topic === sqlCard.id), false);
});

test("a topic request is self-canonical and named after its topic", () => {
  const metadata = learningTopicMetadata("/learn/llm", { topic: String(llmTopic.id), section: "any-section" });
  assert.equal(metadata.alternates?.canonical, llmTopicPath, "a section stays on its topic's canonical page");
  assert.ok(String(metadata.title).startsWith(`${llmTopic.label} — `));
  assert.ok(metadata.description);
});

test("requests that do not open the topic keep the section metadata", () => {
  const cases: Array<[string, Record<string, string>]> = [
    ["/learn/llm", {}],
    ["/learn/llm", { topic: "unknown-topic" }],
    ["/learn/api", { topic: String(apiPlaceholder.id) }],
    ["/learn/automation", { topic: desktopModule }],
    ["/learn/automation", { topic: desktopModule, track: "foundations" }],
    ["/learn/programming", { topic: String(csharpTopic.id), track: "python" }],
    ["/learn/docker", { topic: String(llmTopic.id) }],
  ];
  for (const [route, searchParams] of cases) {
    assert.deepEqual(learningTopicMetadata(route, searchParams), {}, `${route} ${JSON.stringify(searchParams)}`);
  }
});

test("legacy automation track aliases resolve to the canonical track", () => {
  const metadata = learningTopicMetadata("/learn/automation", { topic: foundationsModule, track: "architecture" });
  assert.equal(metadata.alternates?.canonical, `/learn/automation?topic=${foundationsModule}&track=foundations`);
});

test("the sitemap lists every learning topic page exactly once", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.equal(new Set(urls).size, urls.length, "no duplicate sitemap URLs");
  const listed = new Set(urls);
  for (const page of learningTopicPages()) {
    assert.ok(listed.has(new URL(page.path, "https://gimme-job.com").toString()), `${page.path} is in the sitemap`);
  }
});
