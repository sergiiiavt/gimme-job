import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [
  { default: agenticCatalog },
  { default: llmTestingCatalog },
  { staticRagDocuments },
  { learningTopicMetadata, learningTopicPages },
  { isRunnablePythonSource },
] = await Promise.all([
  import("../content/agentic-learning/catalog.ts"),
  import("../content/llm-testing/catalog.ts"),
  import("../worker/rag.ts"),
  import("../app/learning-topic-seo.ts"),
  import("../app/interview-python-execution.ts"),
]);

type Topic = (typeof agenticCatalog.topics)[number];

const publishedIds = ["how-agents-work", "tool-design", "model-context-protocol"];
const plannedIds = ["state-memory-rag", "human-approval", "coding-agents-for-qa", "agent-observability", "agent-projects-lab"];
const published = agenticCatalog.topics.filter((topic: Topic) => topic.status === "published");

function fencedBlocks(markdown: string, languages: readonly string[]) {
  const blocks: Array<{ language: string; source: string }> = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^```([\w-]*)\s*$/);
    if (!opening) continue;
    let end = index + 1;
    while (end < lines.length && !/^```\s*$/.test(lines[end])) end += 1;
    if (languages.includes(opening[1])) blocks.push({ language: opening[1], source: lines.slice(index + 1, end).join("\n") });
    index = end;
  }
  return blocks;
}

test("written chapters come first and reserved chapters stay placeholders", () => {
  assert.deepEqual(agenticCatalog.topics.map((topic: Topic) => topic.id), [...publishedIds, ...plannedIds]);
  for (const topic of agenticCatalog.topics) {
    assert.ok(topic.label && topic.labelUk && topic.description && topic.descriptionUk, `${topic.id} needs bilingual labels and descriptions`);
  }
  assert.deepEqual(published.map((topic: Topic) => topic.id), publishedIds);
});

test("every written chapter is bilingual, substantive and shares identical code in both languages", () => {
  const codeLanguages = ["python", "yaml", "json", "bash", "typescript", "javascript", "sql", "diff"];
  for (const topic of published) {
    for (const [language, markdown] of [["en", topic.markdown], ["uk", topic.markdownUk]] as const) {
      assert.ok(markdown.length > 4000, `${topic.id} (${language}) must contain real material`);
      assert.ok((markdown.match(/^## /gm) ?? []).length >= 5, `${topic.id} (${language}) must have sections`);
      assert.match(markdown, /^# \S/m, `${topic.id} (${language}) needs a chapter title`);
    }
    assert.notEqual(topic.markdown, topic.markdownUk, `${topic.id} needs a distinct Ukrainian translation`);
    assert.deepEqual(fencedBlocks(topic.markdownUk, codeLanguages), fencedBlocks(topic.markdown, codeLanguages), `${topic.id} must contain the same code in English and Ukrainian`);
  }
});

test("written chapters follow the course format with examples that run in the page and cited references", () => {
  for (const topic of published) {
    assert.match(topic.markdown, /\*\*Prerequisites:\*\*/);
    assert.match(topic.markdownUk, /\*\*Передумови:\*\*/);
    assert.match(topic.markdown, /^## Common mistakes$/m);
    assert.match(topic.markdown, /^## Summary$/m);
    assert.match(topic.markdownUk, /^## Типові помилки$/m);
    assert.match(topic.markdownUk, /^## Підсумок$/m);
    assert.ok((topic.markdown.match(/^```diagram$|^\| .* \|$/gm) ?? []).length >= 3, `${topic.id} needs flows or tables`);
    assert.doesNotMatch(topic.markdown, /^## Sources$/m, `${topic.id} uses the source registry instead of an inline Sources section`);

    const python = fencedBlocks(topic.markdown, ["python"]);
    assert.ok(python.length >= 1, `${topic.id} needs a Python example`);
    for (const block of python) assert.ok(isRunnablePythonSource("python", block.source), `${topic.id} has a Python example that cannot run in the page`);
    assert.ok(topic.sourceIds.length >= 5, `${topic.id} must cite its references`);
  }
});

test("the source registry is complete, unique and fully referenced", () => {
  const ids = agenticCatalog.sources.map((source: { id: string }) => source.id);
  assert.equal(new Set(ids).size, ids.length, "source ids are unique");
  for (const source of agenticCatalog.sources) {
    assert.match(source.url, /^https:\/\//, `${source.id} needs an https URL`);
    for (const field of ["title", "publisher", "kind", "role", "checkedAt"] as const) assert.ok(source[field], `${source.id} needs ${field}`);
  }
  const cited = new Set(agenticCatalog.topics.flatMap((topic: Topic) => topic.sourceIds));
  for (const sourceId of cited) assert.ok(ids.includes(sourceId), `unknown source ${sourceId}`);
  for (const sourceId of ids) assert.ok(cited.has(sourceId), `source ${sourceId} is not cited by any chapter`);
});

test("chapter links open published learning topics and existing sections", () => {
  const sectionsByTopic = new Map<string, Set<string>>();
  for (const document of staticRagDocuments().filter((entry) => entry.kind === "learning")) {
    const key = `${document.metadata.route}?${document.metadata.topic}`;
    const sections = sectionsByTopic.get(key) ?? new Set<string>();
    if (typeof document.metadata.section === "string") sections.add(document.metadata.section);
    sectionsByTopic.set(key, sections);
  }

  let checked = 0;
  for (const topic of published) {
    for (const markdown of [topic.markdown, topic.markdownUk]) {
      for (const [, route, query] of markdown.matchAll(/\]\((\/learn\/(?:agentic|llm))\?([^)#]+)\)/g)) {
        const params = new URLSearchParams(query);
        const sections = sectionsByTopic.get(`${route}?${params.get("topic")}`);
        assert.ok(sections, `${topic.id} links an unpublished topic: ${route}?${query}`);
        const section = params.get("section");
        if (section) assert.ok(sections.has(section), `${topic.id} links a missing section: ${route}?${query}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0);
});

test("the testing chapter of the LLM course and this section link to each other", () => {
  const agentTesting = llmTestingCatalog.topics.find((topic: { id: string }) => topic.id === "agent-testing");
  assert.ok(agentTesting);
  assert.match(agentTesting.markdown, /\(\/learn\/agentic\?topic=how-agents-work\)/);
  assert.match(agentTesting.markdownUk, /\(\/learn\/agentic\?topic=how-agents-work\)/);
  assert.ok(published.some((topic: Topic) => topic.markdown.includes("(/learn/llm?topic=agent-testing")));
});

test("written chapters are retrievable section by section; placeholders and the video page are not", () => {
  const documents = staticRagDocuments().filter((document) => document.kind === "learning" && document.metadata.route === "/learn/agentic");
  const topics = new Set(documents.map((document) => document.metadata.topic));
  assert.deepEqual([...topics].sort(), [...publishedIds].sort());
  for (const id of publishedIds) {
    assert.ok(documents.some((document) => document.metadata.topic === id && typeof document.metadata.section === "string"), `${id} sections are retrievable`);
  }
});

test("each written chapter is a topic page; placeholders and the video page keep the section metadata", () => {
  const pages = learningTopicPages().filter((page) => page.route === "/learn/agentic");
  assert.deepEqual(pages.map((page) => page.path), publishedIds.map((id) => `/learn/agentic?topic=${id}`));
  assert.equal(learningTopicMetadata("/learn/agentic", { topic: "model-context-protocol" }).alternates?.canonical, "/learn/agentic?topic=model-context-protocol");
  assert.deepEqual(learningTopicMetadata("/learn/agentic", { topic: plannedIds[0] }), {});
  assert.deepEqual(learningTopicMetadata("/learn/agentic", { topic: "learning-videos" }), {});
});
