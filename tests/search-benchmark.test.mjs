import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { allowedTypos, matchesTarget, normalizer, percentile, scoreCase, summarize, tokens, uniqueHits, validateCases } from "../examples/search-benchmark/model.mjs";
import { oramaEngine, prepareDocuments, typesenseEngine } from "../examples/search-benchmark/engines.mjs";
import { checkControls, controlDocuments } from "../examples/search-benchmark/controls.mjs";
import { canonicalCorpus } from "../examples/search-benchmark/corpus.mjs";

const aliases = JSON.parse(await readFile(new URL("../examples/search-benchmark/aliases.json", import.meta.url), "utf8"));

test("search normalization preserves technical distinctions and applies shared bilingual equivalents", () => {
  const base = normalizer(aliases, false);
  const assisted = normalizer(aliases, true);
  assert.deepEqual(tokens("C# C++ .NET 401 403"), ["c#", "c++", ".net", "401", "403"]);
  assert.equal(base("C# C++ .NET 401 403"), "csharp cplusplus dotnet 401 403");
  assert.equal(assisted("pytest фікстурами", true), assisted("pytest fixtures", true));
  assert.equal(assisted("SQL з’єднання таблиць", true), assisted("SQL joins", true));
  assert.equal(assisted("k8s", true), assisted("Kubernetes", true));
  assert.equal(assisted("ін’єкція промпту", true), assisted("prompt injection", true));
  assert.notEqual(assisted("authentication"), assisted("authorization"));
  assert.notEqual(assisted("regression"), assisted("retest"));
  assert.equal(base("the and як", true), "");
  assert.equal(allowedTypos("C#"), 0);
  assert.equal(allowedTypos("HTTP 401"), 0);
  assert.equal(allowedTypos("API"), 0);
  assert.equal(allowedTypos("fixture"), 1);
  assert.equal(allowedTypos("cardinality"), 2);
});

test("benchmark scores a known target and does not call target-hit rate precision", () => {
  const hits = [{ id: "a", title: "A", path: "/a", topic: "other" },
    { id: "a2", title: "A duplicate", path: "/a", topic: "other" },
    { id: "b", title: "B", path: "/b", topic: "target" }];
  const row = scoreCase({ id: "q", targets: [{ topic: "target" }] }, hits);
  assert.equal(row.rank, 2);
  assert.equal(row.reciprocalRank, 0.5);
  assert.equal(uniqueHits(hits).length, 2);
  assert.equal(uniqueHits(hits, 1).length, 1);
  const miss = scoreCase({ id: "missing", targets: [{ topic: "absent" }] }, hits);
  assert.equal(miss.rank, null);
  assert.deepEqual(summarize([row, miss]), { count: 2, hitAt5: 0.5, mrrAt5: 0.25 });
  assert.deepEqual(summarize([]), { count: 0, hitAt5: null, mrrAt5: null });
  assert.equal(percentile([4, 1, 2, 3], 0.95), 4);
  assert.equal(percentile([], 0.95), null);
  assert.equal(matchesTarget(hits[0], { topic: "target" }), false);
  const query = { id: "q", query: "target", targets: [{ topic: "target" }] };
  assert.doesNotThrow(() => validateCases([query], hits));
  assert.throws(() => validateCases([query, query], hits), /duplicate/);
  assert.throws(() => validateCases([{ ...query, targets: [{ topic: "missing" }] }], hits), /Missing corpus target/);
  assert.throws(() => validateCases([{ ...query, targets: [{}] }], hits), /Missing corpus target/);
});

for (const assisted of [false, true]) {
  test(`Orama ${assisted ? "assisted" : "base"} preserves technical tokens, AND matching and snapshot results`, async () => {
    const prepared = prepareDocuments(controlDocuments, aliases, assisted);
    const engine = await oramaEngine(prepared.documents, prepared.normalize);
    const controls = await checkControls(engine);
    assert.deepEqual(controls.filter((row) => !row.passed), []);
    assert.deepEqual(await engine.search("the and як"), []);
    const before = await engine.search("C#");
    const snapshot = engine.snapshot();
    engine.unload();
    engine.restore(snapshot);
    assert.deepEqual(await engine.search("C#"), before);
  });
}

test("Orama really retrieves prefixes, misspellings and Ukrainian equivalents from the same documents", async () => {
  const documents = [{ id: "fixture", title: "Pytest fixtures", body: "Scoped fixture setup teardown", path: "/fixtures" },
    { id: "other", title: "SQL joins", body: "Relational tables", path: "/joins" }];
  const prepared = prepareDocuments(documents, aliases, true);
  const engine = await oramaEngine(prepared.documents, prepared.normalize);
  for (const query of ["pytest fixt", "fixtuer", "pytest фікстурами"]) {
    assert.equal((await engine.search(query))[0]?.id, "fixture", query);
  }
});

test("benchmark corpus comes from canonical public discovery and every relevance label resolves", async () => {
  const { documents, sourceRowCount, collisions } = await canonicalCorpus();
  const cases = JSON.parse(await readFile(new URL("../examples/search-benchmark/queries.json", import.meta.url), "utf8"));
  assert.equal(documents.length + collisions.length, sourceRowCount);
  assert.equal(new Set(documents.map(({ id }) => id)).size, documents.length);
  assert.ok(documents.every((document) => ["learning", "question"].includes(document.kind)));
  assert.ok(documents.length > 3000);
  assert.doesNotThrow(() => validateCases(cases, documents));
  assert.equal(cases.length, 110);
  assert.equal(new Set(cases.map(({ intent }) => intent)).size, 20);
  assert.deepEqual(new Set(cases.map(({ split }) => split)), new Set(["development", "holdout"]));
});

test("Typesense adapter reports server/import failures and protects numeric queries without token dropping", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (String(url).includes("/import")) return new Response('{"success":true}\n');
      if (String(url).includes("/search")) return Response.json({ hits: [{ document: controlDocuments[3] }] });
      return Response.json({});
    };
    const engine = await typesenseEngine(controlDocuments, normalizer(aliases, false), "http://127.0.0.1:18108", "test-only", "controls");
    assert.deepEqual(await engine.search(""), []);
    assert.equal((await engine.search("HTTP 401"))[0].id, "401");
    const url = new URL(calls.at(-1).url);
    assert.equal(url.searchParams.get("num_typos"), "0");
    assert.equal(url.searchParams.get("drop_tokens_threshold"), "0");
    global.fetch = async () => new Response("not available", { status: 503 });
    await assert.rejects(() => typesenseEngine([], String, "http://127.0.0.1", "test-only", "bad"), /Typesense 503/);
    global.fetch = async (url) => String(url).includes("/import") ? new Response('{"success":false,"error":"schema"}') : Response.json({});
    await assert.rejects(() => typesenseEngine([], String, "http://127.0.0.1", "test-only", "bad"), /import failed/);
  } finally { global.fetch = originalFetch; }
});
