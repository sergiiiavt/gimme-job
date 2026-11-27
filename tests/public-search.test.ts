import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";
import test from "node:test";
import { register as registerTsx } from "tsx/esm/api";
registerTsx();
registerLoader("./helpers/raw-markdown-loader.mjs", import.meta.url);
const { staticRagDocuments, ragSourcePath, searchRagDocuments } = await import("../worker/rag.ts");
const { searchIndexDocuments, searchCorpusRevision, protectedSearchTerms, equivalentTerms } = await import("../worker/search-corpus.ts");
const { handlePublicSearch, searchSnippet } = await import("../worker/public-search.ts");
const { searchService } = await import("../worker/search-client.ts");
const { isPrivateRequest } = await import("../worker/request-policy.ts");
const { publicRateLimitPolicy } = await import("../worker/public-api-rate-limit.ts");
const documents = staticRagDocuments();
const env = { DB: { prepare() { throw new Error("Public search must never read private/runtime rows."); } } } as never;

test("search indexes complete bilingual answers and translated sections with stable canonical identities", () => {
  assert.equal(new Set(documents.map(({ id }) => id)).size, documents.length);
  const en = documents.find((doc) => doc.kind === "learning" && doc.metadata.section && doc.metadata.language === "en" && documents.some((other) => other.refId === doc.refId && other.metadata.catalog === doc.metadata.catalog && other.metadata.language === "uk"))!;
  const uk = documents.find((doc) => doc.refId === en.refId && doc.metadata.catalog === en.metadata.catalog && doc.metadata.language === "uk")!;
  assert.notEqual(en.id, uk.id);
  assert.equal(en.metadata.section, uk.metadata.section);
  assert.equal(new URL(ragSourcePath(uk), "https://example.test").searchParams.get("lang"), "uk");
  const question = documents.find((doc) => doc.refId === "performance-test-types" && doc.metadata.language === "en")!;
  assert.match(question.title, /What types of performance testing/);
  assert.ok(question.text.length > question.title.length + 100);
  assert.equal(new URL(ragSourcePath(question), "https://example.test").searchParams.get("question"), question.refId);
  const indexed = searchIndexDocuments(documents);
  assert.equal(indexed.length, documents.length);
  assert.ok(indexed.filter((doc) => doc.language === "uk").length > 2000);
  assert.ok(indexed.every((doc) => !["job", "resume"].includes(doc.kind)));
});

test("equivalents supplement original text and technical identities remain distinct", async () => {
  assert.deepEqual(protectedSearchTerms("C# C++ .NET HTTP 401 and 403"), ["csharp", "cplusplus", "dotnet", "status401", "status403"]);
  assert.match(equivalentTerms("Kubernetes"), /k8s/);
  assert.match(equivalentTerms("fixtures"), /фікстура/);
  assert.equal(equivalentTerms("authentication authorization health"), "");
  const source = [{ id: "x", kind: "learning", refId: "x", title: "Kubernetes", text: "Original body", metadata: {} }] as never;
  assert.equal(searchIndexDocuments(source)[0].title, "Kubernetes");
  assert.notEqual(await searchCorpusRevision(source), await searchCorpusRevision([]));
  assert.equal(await searchCorpusRevision(source), await searchCorpusRevision(source));
});

test("public search validates filters and returns only canonical public fields in fallback", async () => {
  for (const query of ["q=x", "q=" + "x".repeat(241), "q=pytest&kind=job", "q=pytest&language=ru", "q=pytest&semantic=true"]) {
    assert.equal((await handlePublicSearch(new Request(`https://example.test/api/public/search?${query}`), env)).status, 400);
  }
  const response = await handlePublicSearch(new Request("https://example.test/api/public/search?q=pytest&kind=question&language=uk"), env);
  const result = await response.json();
  assert.equal(result.mode, "fallback");
  assert.ok(result.results.length > 0);
  assert.ok(result.results.every((item: { kind: string; language: string; href: string }) => item.kind === "question" && item.language === "uk" && item.href.startsWith("/interview")));
  assert.deepEqual(Object.keys(result.results[0]).sort(), ["category", "href", "id", "kind", "language", "section", "snippet", "title"]);
  assert.equal(isPrivateRequest(new Request("https://example.test/api/public/search?q=Python")), false);
  assert.equal(isPrivateRequest(new Request("https://example.test/api/public/search", { method: "POST" })), true);
  assert.match(searchSnippet("# Heading\n```python\nsecret code\n```\n" + "a".repeat(320) + " useful needle", "needle"), /….*needle/);
});

test("search requests have separate lexical and paid semantic budgets", () => {
  const normal = publicRateLimitPolicy(new Request("https://example.test/api/public/search?q=pytest"), {});
  const semantic = publicRateLimitPolicy(new Request("https://example.test/api/public/search?q=pytest&semantic=1"), {});
  assert.equal(normal?.routeGroup, "search");
  assert.equal(semantic?.routeGroup, "semantic-search");
  assert.ok(normal!.ipLimit > semantic!.ipLimit);
});

test("gateway rejects stale/malformed responses, fails back, and materializes IDs from current corpus", async () => {
  const fetchBefore = globalThis.fetch;
  const configured = { ...env, GIMMEJOB_AI_URL: "https://ai.example.test", GIMMEJOB_AI_SERVICE_TOKEN: "server-only-token" };
  const revision = await searchCorpusRevision(documents);
  const question = documents.find((doc) => doc.kind === "question" && doc.metadata.language === "en")!;
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.revision, revision);
      assert.equal(new Headers(options?.headers).get("authorization"), "Bearer server-only-token");
      return Response.json({ revision, mode: "hybrid", semanticAvailable: true, candidates: [{ id: "forged-id", score: .9 }, { id: question.id, score: .8 }, { id: question.id, score: -1 }] });
    };
    const response = await handlePublicSearch(new Request("https://example.test/api/public/search?q=Python&semantic=1"), configured);
    const result = await response.json();
    assert.equal(result.mode, "hybrid");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].title, question.title);
    const rag = await searchRagDocuments(configured, "Python", ["question"], 8);
    assert.equal(rag.retrieval, "hybrid");
    assert.equal(rag.results[0].title, question.title);
    globalThis.fetch = async () => Response.json({ revision: "stale", mode: "typesense", candidates: [] });
    assert.equal(await searchService(configured, documents, "Python", { semantic: false, limit: 8 }), null);
    globalThis.fetch = async () => Response.json({ revision, mode: "invalid", candidates: [] });
    assert.equal(await searchService(configured, documents, "Python", { semantic: false, limit: 8 }), null);
    globalThis.fetch = async () => new Response("error", { status: 503 });
    assert.equal(await searchService(configured, documents, "Python", { semantic: false, limit: 8 }), null);
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await searchService(configured, documents, "Python", { semantic: true, limit: 8 }), null);
    assert.equal(await searchService({ ...configured, GIMMEJOB_AI_URL: "http://unsafe.test" }, documents, "Python", { semantic: false, limit: 8 }), null);
  } finally { globalThis.fetch = fetchBefore; }
});
