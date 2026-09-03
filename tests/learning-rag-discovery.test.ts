import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const [{ default: learningRagSources }, { searchRagDocuments, staticRagDocuments }] = await Promise.all([
  import("../content/learning-rag-registry.ts"),
  import("../worker/rag.ts"),
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

test("under-construction topic catalogs do not leak placeholder pages into retrieval", () => {
  const documents = staticRagDocuments().filter((document) => document.kind === "learning");

  assert.equal(documents.some((document) => document.metadata.catalog === "api-integration" && document.metadata.topic === "graphql"), false);
  assert.equal(documents.some((document) => document.metadata.catalog === "networking" && document.metadata.topic === "network-diagnostics"), false);
});
