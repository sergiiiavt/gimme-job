import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";

registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);

const {
  handleRagReindexRequest,
  handleRagSearchRequest,
  reindexRagBatch,
  searchRagDocuments,
  semanticSearch,
  staticRagDocuments,
} = await import("../worker/rag.ts");

function makeEnv() {
  const calls: {
    models: string[];
    embeddedTexts: string[][];
    upserts: Array<Array<Record<string, unknown>>>;
    queries: Array<Record<string, unknown>>;
  } = { models: [], embeddedTexts: [], upserts: [], queries: [] };

  const job = {
    id: "job-1",
    title: "Senior QA Automation Engineer",
    company: "Example",
    location: "Kyiv",
    remote: 0,
    url: "https://example.test/job-1",
    description: "Python, Playwright, SQL, API testing and test strategy.",
    salary_text: null,
    source: "DOU",
    posted_at: "2026-08-22T10:00:00.000Z",
    updated_at: "2026-08-22T10:00:00.000Z",
  };
  const questionDocument = staticRagDocuments().find((document) => document.kind === "question")!;
  const learningDocument = staticRagDocuments().find((document) => document.kind === "learning")!;

  const env = {
    DB: {
      prepare() {
        return {
          async all<T>() { return { results: [job] as T[] }; },
        };
      },
    },
    AI: {
      async run(model: string, input: { text: string[] }) {
        calls.models.push(model);
        calls.embeddedTexts.push(input.text);
        return { data: input.text.map((_text, index) => [index + 0.1, index + 0.2]) };
      },
    },
    RAG_INDEX: {
      async upsert(vectors: Array<Record<string, unknown>>) { calls.upserts.push(vectors); },
      async query(_vector: number[], options: Record<string, unknown>) {
        calls.queries.push(options);
        return {
          matches: [
            { id: questionDocument.id, score: 0.91, metadata: questionDocument.metadata },
            { id: learningDocument.id, score: 0.88, metadata: learningDocument.metadata },
          ],
        };
      },
    },
  };

  return { env, calls };
}

test("static RAG corpus contains QA, Python interview, and learning documents with compact IDs", () => {
  const documents = staticRagDocuments();
  const kinds = new Set(documents.map((document) => document.kind));
  const tracks = new Set(documents.filter((document) => document.kind === "question").map((document) => document.metadata.track));

  assert.ok(documents.length > 100);
  assert.equal(kinds.has("question"), true);
  assert.equal(kinds.has("learning"), true);
  assert.equal(tracks.has("qa"), true);
  assert.equal(tracks.has("python"), true);
  assert.ok(documents.every((document) => new TextEncoder().encode(document.id).byteLength <= 64));
  assert.ok(documents.every((document) => document.metadata.refId === document.refId));
});

test("semantic search embeds with multilingual BGE-M3 and filters by document kind", async () => {
  const { env, calls } = makeEnv();
  const results = await semanticSearch(env as never, "Playwright API testing", ["question"], 5);

  assert.equal(calls.models[0], "@cf/baai/bge-m3");
  assert.deepEqual(calls.embeddedTexts[0], ["Playwright API testing"]);
  assert.deepEqual(calls.queries[0], { topK: 20, returnMetadata: "all" });
  assert.equal(results.length, 1);
  assert.equal(results[0].metadata.kind, "question");
  assert.equal(results[0].score, 0.91);
});

test("canonical RAG materializes authoritative documents after Vectorize retrieval", async () => {
  const { env } = makeEnv();
  const result = await searchRagDocuments(env as never, "Python testing", ["question", "learning"], 5);

  assert.equal(result.retrieval, "vectorize");
  assert.equal(result.embeddingModel, "@cf/baai/bge-m3");
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every((item) => item.text.length > 0));
  assert.ok(result.results.every((item) => item.route?.startsWith("/")));
});

test("canonical RAG owns lexical degradation when Vectorize is unavailable", async () => {
  const pythonDocument = staticRagDocuments().find(
    (document) => document.kind === "question" && document.metadata.track === "python" && document.title.toLowerCase().includes("async"),
  ) ?? staticRagDocuments().find((document) => document.kind === "question" && document.metadata.track === "python")!;
  const query = pythonDocument.title.split(/\s+/).slice(0, 3).join(" ");
  const result = await searchRagDocuments({ DB: makeEnv().env.DB } as never, query, ["question"], 5);

  assert.equal(result.retrieval, "lexical-fallback");
  assert.ok(result.results.length > 0);
  assert.ok(result.results.some((item) => item.metadata.track === "python"));
});

test("RAG reindex batches static content and D1 jobs without making Vectorize authoritative", async () => {
  const { env, calls } = makeEnv();
  const staticCount = staticRagDocuments().length;

  const first = await reindexRagBatch(env as never, 0, 2);
  assert.equal(first.indexed, 2);
  assert.equal(first.total, staticCount + 1);
  assert.equal(first.counts.job, 1);
  assert.ok(first.counts.question > 0);
  assert.ok(first.counts.learning > 0);
  assert.equal(calls.upserts[0].length, 2);

  const jobOnly = await reindexRagBatch(env as never, staticCount, 1);
  assert.equal(jobOnly.indexed, 1);
  assert.equal(jobOnly.nextCursor, null);
  assert.equal(calls.upserts[1][0].metadata && (calls.upserts[1][0].metadata as Record<string, unknown>).kind, "job");
  assert.equal((calls.upserts[1][0].metadata as Record<string, unknown>).refId, "job-1");
});

test("RAG search HTTP handler validates request and returns bounded canonical results", async () => {
  const { env } = makeEnv();
  const wrongMethod = await handleRagSearchRequest(new Request("https://example.test/internal/rag/search"), env as never);
  assert.equal(wrongMethod.status, 405);

  const malformed = await handleRagSearchRequest(
    new Request("https://example.test/internal/rag/search", { method: "POST", body: "{" }),
    env as never,
  );
  assert.equal(malformed.status, 400);

  const success = await handleRagSearchRequest(
    new Request("https://example.test/internal/rag/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Python testing", kinds: ["learning", "question"], limit: 4 }),
    }),
    env as never,
  );
  assert.equal(success.status, 200);
  const payload = await success.json() as Record<string, unknown>;
  assert.equal(payload.ok, true);
  assert.equal(payload.retrieval, "vectorize");
});

test("RAG reindex HTTP handler validates method, configuration and payload", async () => {
  const { env } = makeEnv();
  const wrongMethod = await handleRagReindexRequest(new Request("https://example.test/internal/rag/reindex"), env as never);
  assert.equal(wrongMethod.status, 405);

  const unavailable = await handleRagReindexRequest(
    new Request("https://example.test/internal/rag/reindex", { method: "POST", body: "{}" }),
    { DB: env.DB } as never,
  );
  assert.equal(unavailable.status, 503);

  const malformed = await handleRagReindexRequest(
    new Request("https://example.test/internal/rag/reindex", { method: "POST", body: "{" }),
    env as never,
  );
  assert.equal(malformed.status, 400);

  const success = await handleRagReindexRequest(
    new Request("https://example.test/internal/rag/reindex", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cursor: 0, limit: 1 }),
    }),
    env as never,
  );
  assert.equal(success.status, 200);
  const payload = await success.json() as Record<string, unknown>;
  assert.equal(payload.ok, true);
  assert.equal(payload.indexed, 1);
});
