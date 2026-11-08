import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [
  { default: learningRagSources },
  { searchRagDocuments, staticRagDocuments },
  { automationTrackForModule },
  { learningTopicPages },
] = await Promise.all([
  import("../content/learning-rag-registry.ts"),
  import("../worker/rag.ts"),
  import("../content/automation-learning/tracks.ts"),
  import("../app/learning-topic-seo.ts"),
]);

const env = {
  DB: {
    prepare() {
      return { async all() { return { results: [] }; } };
    },
  },
};

test("canonical learning registry includes current Git-backed learning surfaces", () => {
  const routes = new Set(learningRagSources.map((source) => `${source.route}${source.track ? `#${source.track}` : ""}`));

  assert.ok(routes.has("/learn/api"));
  assert.ok(routes.has("/learn/networking"));
  assert.ok(routes.has("/learn/embedded"));
  assert.ok(routes.has("/learn/programming#python"));
  assert.ok(routes.has("/learn/programming#csharp"));
  assert.ok(routes.has("/learn/certifications#ct-ai-v2"));
});

test("published markdown sections become first-class RAG documents with canonical deep links", async () => {
  const documents = staticRagDocuments().filter((document) => document.kind === "learning");
  const statusCodes = documents.find((document) =>
    document.metadata.route === "/learn/api"
    && document.metadata.topic === "http-foundations"
    && document.metadata.section === "http-status-codes"
  );

  assert.ok(statusCodes);
  assert.equal(statusCodes.title, "HTTP status codes");
  assert.match(statusCodes.text, /200 OK/);

  const result = await searchRagDocuments(env as never, "HTTP status codes", ["learning"], 8);
  const hit = result.results.find((item) => item.sourcePath.includes("section=http-status-codes"));
  assert.ok(hit);
  assert.equal(hit.sourcePath, "/learn/api?topic=http-foundations&section=http-status-codes");
});

test("learning documents preserve track-specific navigation without AI-specific route registration", () => {
  const documents = staticRagDocuments().filter((document) => document.kind === "learning");
  const csharp = documents.find((document) =>
    document.metadata.catalog === "csharp"
    && document.metadata.track === "csharp"
    && typeof document.metadata.section === "string"
  );
  const certification = documents.find((document) =>
    document.metadata.catalog === "istqb-ai-testing"
    && document.metadata.track === "ct-ai-v2"
  );

  assert.ok(csharp);
  assert.ok(certification);
});

test("Test automation deep links carry the track that opens their module", async () => {
  const automation = staticRagDocuments().filter((document) =>
    document.kind === "learning" && document.metadata.route === "/learn/automation");
  assert.ok(automation.length > 0);
  for (const document of automation) {
    assert.equal(document.metadata.track, automationTrackForModule(String(document.metadata.topic)), document.refId);
  }

  // Outside the default track a link without its track opens the first foundations chapter instead.
  const result = await searchRagDocuments(env as never, "Allure pipeline raw results HTML report preserved artifacts", ["learning"], 8);
  const hit = result.results.find((item) => item.sourcePath.startsWith("/learn/automation?topic=desktop-automation-ci&"));
  assert.ok(hit, "the desktop CI chapter is retrievable");
  assert.equal(new URL(hit.sourcePath, "https://gimme-job.com").searchParams.get("track"), "real-projects");
});

test("QA fundamentals deep links open the chapter page, sections included", async () => {
  const qa = staticRagDocuments().filter((document) => document.kind === "learning" && document.metadata.catalog === "qa-fundamentals");
  assert.ok(qa.length > 0);
  assert.ok(qa.every((document) => document.metadata.route === "/learn/qa-fundamentals"));

  const result = await searchRagDocuments(env as never, "boundary value analysis equivalence partitioning test design", ["learning"], 8);
  const hit = result.results.find((item) => item.sourcePath.startsWith("/learn/qa-fundamentals?topic=") && item.sourcePath.includes("&section="));
  assert.ok(hit, "a QA fundamentals section is retrievable with a deep link to its chapter");
});

test("learning deep links open the same topic page search engines index", () => {
  const pages = new Map(learningTopicPages().map((page) => [`${page.route}\n${page.topic}`, page]));
  let compared = 0;
  for (const document of staticRagDocuments().filter((entry) => entry.kind === "learning")) {
    const page = pages.get(`${document.metadata.route}\n${document.metadata.topic}`);
    if (!page) continue;
    compared += 1;
    assert.equal(document.metadata.track, page.track, `${document.refId} links the track its topic page uses`);
  }
  assert.ok(compared > 0);
});

test("AI reliability guarantees are discoverable as a linked learning section", async () => {
  const result = await searchRagDocuments(env as never, "What can actually be guaranteed?", ["learning"], 8);
  const hit = result.results.find((item) => item.sourcePath ===
    "/learn/llm?topic=ai-reliability&section=what-can-actually-be-guaranteed");

  assert.ok(hit, "the new chapter must participate in canonical section retrieval");
});

test("under-construction topic catalogs do not leak placeholder pages into retrieval", () => {
  const documents = staticRagDocuments().filter((document) => document.kind === "learning");

  assert.equal(documents.some((document) => document.metadata.catalog === "api-integration" && document.metadata.topic === "graphql"), false);
  assert.equal(documents.some((document) => document.metadata.catalog === "networking" && document.metadata.topic === "network-diagnostics"), false);
});
