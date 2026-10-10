import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [{ default: llmTestingCatalog }, { default: learningRagSources }, { staticRagDocuments }, { sectionNavigationHref }] = await Promise.all([
  import("../content/llm-testing/catalog.ts"),
  import("../content/learning-rag-registry.ts"),
  import("../worker/rag.ts"),
  import("../app/navigation-paths.ts"),
]);

const expectedTopicIds = [
  "llm-foundations",
  "llm-application-anatomy",
  "evaluation-fundamentals",
  "model-graded-evaluation",
  "rag-testing",
  "agent-testing",
  "security-red-teaming",
  "production-quality",
  "pro-practice",
];

const levelOrder = ["beginner", "intermediate", "advanced", "pro"];

test("LLM testing path publishes nine chapters in learning order from beginner to pro", () => {
  assert.deepEqual(llmTestingCatalog.topics.map((topic) => topic.id), expectedTopicIds);
  assert.ok(llmTestingCatalog.topics.every((topic) => topic.status === "published"));

  const levels = llmTestingCatalog.topics.map((topic) => levelOrder.indexOf(topic.level));
  assert.ok(levels.every((level) => level >= 0), "every chapter has a known level");
  assert.deepEqual([...levels].sort((a, b) => a - b), levels, "levels never step backwards");
  assert.equal(llmTestingCatalog.topics[0].level, "beginner");
  assert.equal(llmTestingCatalog.topics.at(-1)?.level, "pro");
});

test("every LLM testing chapter is bilingual with practice, an exit check and sources", () => {
  for (const topic of llmTestingCatalog.topics) {
    for (const [language, markdown] of [["en", topic.markdown], ["uk", topic.markdownUk]] as const) {
      const where = `${topic.id} (${language})`;
      assert.ok(markdown.length > 4000, `${where} must contain real material`);
      assert.match(markdown, /^## 1\. /m, `${where} must start a numbered sequence`);
      assert.match(markdown, /^## \d+\. QA quick reference$/m, `${where} must include a QA quick reference`);
      assert.match(markdown, /^## \d+\. Practice$/m, `${where} must include practice`);
      assert.match(markdown, /\*\*Exit check:\*\*/, `${where} must define when the chapter is done`);
      assert.match(markdown, /^## Sources$/m, `${where} must include sources`);
      assert.ok(markdown.indexOf("## Sources") > markdown.indexOf("## 1. "), `${where} sources must follow the material`);
      assert.match(markdown, /^- \[[^\]]+\]\(https:\/\//m, `${where} must cite at least one external source`);
    }
    assert.notEqual(topic.markdown, topic.markdownUk, `${topic.id} must have a distinct Ukrainian translation`);
  }
});

test("LLM testing path covers the core evaluation, RAG, agent, security and governance concepts", () => {
  const all = llmTestingCatalog.topics.map((topic) => topic.markdown).join("\n").toLowerCase();

  for (const concept of [
    "token", "temperature", "embedding", "hallucination", "structured output", "tool calling", "model context protocol",
    "golden dataset", "error analysis", "llm-as-a-judge", "cohen's kappa", "metamorphic", "pass@k", "pass^k",
    "recall@k", "ndcg", "faithfulness", "ragas", "trajectory", "simulated user", "fault injection",
    "prompt injection", "indirect prompt injection", "lethal trifecta", "jailbreak", "guardrail", "mitre atlas",
    "opentelemetry", "ttft", "model migration", "confidence interval", "bootstrap", "contamination",
    "nist ai rmf", "eu ai act", "iso/iec 42001", "promptfoo", "deepeval", "garak", "pyrit", "langfuse",
  ]) {
    assert.ok(all.includes(concept), `Missing LLM testing concept ${concept}`);
  }

  assert.match(all, /temperature 0 is not deterministic/);
  assert.match(all, /owasp top 10 for llm applications \(2025\)/);
});

test("LLM testing path is the canonical /learn/llm surface and is discoverable by canonical RAG", () => {
  assert.equal(sectionNavigationHref("llm", "public"), "/learn/llm");
  assert.ok(learningRagSources.some((source) => source.key === "llm-testing" && source.route === "/learn/llm" && !source.track));

  const documents = staticRagDocuments().filter((document) => document.kind === "learning" && document.metadata.route === "/learn/llm");
  for (const topicId of expectedTopicIds) {
    assert.ok(documents.some((document) => document.metadata.topic === topicId && typeof document.metadata.section === "string"), `${topicId} sections must be retrievable`);
  }

  const triad = documents.find((document) => document.metadata.topic === "rag-testing" && /RAG triad/.test(document.title));
  assert.ok(triad, "RAG triad section must be its own retrieval unit");
  assert.match(triad.text, /groundedness/i);
});
