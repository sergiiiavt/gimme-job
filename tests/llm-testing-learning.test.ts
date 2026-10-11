import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [
  { default: llmTestingCatalog },
  { default: learningRagSources },
  { staticRagDocuments },
  { sectionNavigationHref },
  { isRunnablePythonSource },
] = await Promise.all([
  import("../content/llm-testing/catalog.ts"),
  import("../content/learning-rag-registry.ts"),
  import("../worker/rag.ts"),
  import("../app/navigation-paths.ts"),
  import("../app/interview-python-execution.ts"),
]);

type Topic = (typeof llmTestingCatalog.topics)[number];

// Only chapters with content are listed; planned chapters are added when they are written.
const expectedTopicIds = [
  "llm-testing-problem-space",
  "llm-foundations",
  "embeddings-similarity",
  "llm-application-anatomy",
  "prompts-as-artifacts",
  "structured-output-validation",
  "testing-without-the-model",
  "evaluation-fundamentals",
  "model-graded-evaluation",
  "rag-testing",
  "agent-testing",
  "security-red-teaming",
  "production-quality",
  "pro-practice",
];

// Chapters rewritten as full study material (explanations, worked examples, runnable code, references).
const courseFormatTopicIds = [
  "llm-testing-problem-space",
  "llm-foundations",
  "embeddings-similarity",
  "llm-application-anatomy",
  "prompts-as-artifacts",
  "structured-output-validation",
  "testing-without-the-model",
];

const levelOrder = ["beginner", "intermediate", "advanced", "pro"];
const topicIds = new Set(llmTestingCatalog.topics.map((topic: Topic) => topic.id));

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

test("the LLM testing course lists its written chapters in learning order from beginner to pro", () => {
  assert.deepEqual(llmTestingCatalog.topics.map((topic: Topic) => topic.id), expectedTopicIds);

  const levels = llmTestingCatalog.topics.map((topic: Topic) => levelOrder.indexOf(topic.level));
  assert.ok(levels.every((level: number) => level >= 0), "every chapter has a known level");
  assert.deepEqual([...levels].sort((a, b) => a - b), levels, "levels never step backwards");
  assert.equal(llmTestingCatalog.topics[0].level, "beginner");
  assert.equal(llmTestingCatalog.topics.at(-1)?.level, "pro");

  for (const topic of llmTestingCatalog.topics) {
    assert.equal(topic.status, "published", `${topic.id} must have content; planned chapters are not listed`);
    assert.ok(topic.label && topic.labelUk && topic.description && topic.descriptionUk, `${topic.id} needs bilingual labels and descriptions`);
  }
});

test("every chapter is bilingual, substantive and shares identical code in both languages", () => {
  for (const topic of llmTestingCatalog.topics) {
    for (const [language, markdown] of [["en", topic.markdown], ["uk", topic.markdownUk]] as const) {
      assert.ok(markdown.length > 4000, `${topic.id} (${language}) must contain real material`);
      assert.ok((markdown.match(/^## /gm) ?? []).length >= 5, `${topic.id} (${language}) must have sections`);
    }
    assert.notEqual(topic.markdown, topic.markdownUk, `${topic.id} needs a distinct Ukrainian translation`);

    const codeLanguages = ["python", "yaml", "json", "bash", "typescript", "javascript", "sql", "diff"];
    assert.deepEqual(
      fencedBlocks(topic.markdownUk, codeLanguages),
      fencedBlocks(topic.markdown, codeLanguages),
      `${topic.id} must contain the same code in English and Ukrainian`,
    );
  }
});

test("chapters are study material, not a learning plan: no practice, exercise or capstone sections", () => {
  const planSection = /^## (?:\d+\. )?(?:Practice|Exercises|Вправи|Capstone|Career and portfolio|Кар'єра і portfolio)\s*$/m;
  for (const topic of llmTestingCatalog.topics) {
    for (const markdown of [topic.markdown, topic.markdownUk]) {
      assert.doesNotMatch(markdown, planSection, `${topic.id} contains a learner-task section`);
      assert.doesNotMatch(markdown, /\*\*Exit check:\*\*/, `${topic.id} contains an exit check`);
      assert.doesNotMatch(markdown, /\*\*(?:After this chapter you can|Після цього chapter ви вмієте):\*\*/, `${topic.id} contains a learning-objectives list`);
    }
  }
});

test("rewritten chapters follow the course format with worked examples, runnable code and references", () => {
  for (const id of courseFormatTopicIds) {
    const topic = llmTestingCatalog.topics.find((candidate: Topic) => candidate.id === id) as Topic;
    const en = topic.markdown;
    const uk = topic.markdownUk;

    assert.match(en, /^# \S/m, `${id} needs a chapter title`);
    assert.match(uk, /^# \S/m, `${id} (uk) needs a chapter title`);
    assert.match(en, /\*\*Prerequisites:\*\*/);
    assert.match(en, /^## Common mistakes$/m);
    assert.match(en, /^## Summary$/m);
    assert.match(uk, /^## Типові помилки$/m);
    assert.match(uk, /^## Підсумок$/m);
    assert.ok((en.match(/^```diagram$|^\| .* \|$/gm) ?? []).length >= 3, `${id} needs flows or tables`);

    const runnable = fencedBlocks(en, ["python"]).filter((block) => isRunnablePythonSource("python", block.source));
    assert.ok(runnable.length >= 1, `${id} needs at least one example that runs in the page`);

    assert.ok(topic.sourceIds.length >= 5, `${id} must cite its references`);
    assert.doesNotMatch(en, /^## Sources$/m, `${id} uses the source registry instead of an inline Sources section`);
  }
});

test("rewritten chapters link a runnable example project that exists and has tests", () => {
  const projectLink = /\]\(https:\/\/github\.com\/sergiiiavt\/gimme-job\/tree\/main\/(examples\/llm-testing\/[\w-]+)\)/;
  for (const id of courseFormatTopicIds) {
    const topic = llmTestingCatalog.topics.find((candidate: Topic) => candidate.id === id) as Topic;
    const link = topic.markdown.match(projectLink);
    assert.ok(link, `${id} must link its example project`);
    assert.ok(topic.markdownUk.includes(`(https://github.com/sergiiiavt/gimme-job/tree/main/${link[1]})`), `${id} (uk) must link the same project`);

    const folder = new URL(`../${link[1]}/`, import.meta.url);
    assert.ok(existsSync(folder), `${link[1]} must exist in the repository`);
    const files = readdirSync(folder);
    assert.ok(files.includes("README.md"), `${link[1]} needs a README`);
    assert.ok(files.some((name) => /^test_.+\.py$/.test(name)), `${link[1]} needs a test suite`);
  }
});

test("the source registry is complete, unique and fully referenced", () => {
  const sources = llmTestingCatalog.sources;
  const ids = sources.map((source: { id: string }) => source.id);
  assert.equal(new Set(ids).size, ids.length, "source ids are unique");

  for (const source of sources) {
    assert.match(source.url, /^https:\/\//, `${source.id} needs an https URL`);
    for (const field of ["title", "publisher", "kind", "role", "checkedAt"] as const) {
      assert.ok(source[field], `${source.id} needs ${field}`);
    }
  }

  const cited = new Set(llmTestingCatalog.topics.flatMap((topic: Topic) => topic.sourceIds));
  for (const sourceId of cited) assert.ok(ids.includes(sourceId), `unknown source ${sourceId}`);
  for (const sourceId of ids) assert.ok(cited.has(sourceId), `source ${sourceId} is not cited by any chapter`);
});

test("links between chapters always point to chapters of the course", () => {
  for (const topic of llmTestingCatalog.topics) {
    for (const markdown of [topic.markdown, topic.markdownUk]) {
      for (const match of markdown.matchAll(/\]\(\/learn\/llm\?topic=([a-z0-9-]+)/g)) {
        assert.ok(topicIds.has(match[1]), `${topic.id} links to unknown chapter ${match[1]}`);
      }
    }
  }
});

test("the course is the canonical /learn/llm surface and every chapter is retrievable", () => {
  assert.equal(sectionNavigationHref("llm", "public"), "/learn/llm");
  assert.ok(learningRagSources.some((source: { key: string; route: string; track?: string }) =>
    source.key === "llm-testing" && source.route === "/learn/llm" && !source.track));

  const documents = staticRagDocuments().filter((document) => document.kind === "learning" && document.metadata.route === "/learn/llm");
  for (const topic of llmTestingCatalog.topics) {
    const sections = documents.filter((document) => document.metadata.topic === topic.id && typeof document.metadata.section === "string");
    assert.ok(sections.length > 0, `${topic.id} sections must be retrievable`);
  }

  const sampling = documents.find((document) => document.metadata.topic === "llm-foundations" && /temperature, top-k and top-p/i.test(document.title));
  assert.ok(sampling, "a rewritten section is its own retrieval unit");
  assert.match(sampling.text, /nucleus sampling/);
});
