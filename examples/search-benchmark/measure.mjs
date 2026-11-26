import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { prepareDocuments, oramaEngine, typesenseEngine } from "./engines.mjs";
import { percentile, scoreCase, summarize, uniqueHits } from "./model.mjs";
import { checkControls, controlDocuments } from "./controls.mjs";

const [engineName, profile, inputPath, outputPath] = process.argv.slice(2);
const input = JSON.parse(await readFile(inputPath, "utf8"));
const aliases = JSON.parse(await readFile(new URL("./aliases.json", import.meta.url), "utf8"));
global.gc?.();
const before = process.memoryUsage();
const prepareStart = performance.now();
const prepared = prepareDocuments(input.documents, aliases, profile === "assisted");
const prepareMs = performance.now() - prepareStart;
const indexStart = performance.now();
const engine = engineName === "orama"
  ? await oramaEngine(prepared.documents, prepared.normalize)
  : await typesenseEngine(prepared.documents, prepared.normalize, process.env.SEARCH_BENCHMARK_URL,
    process.env.TYPESENSE_API_KEY, `benchmark_${profile}`);
const indexMs = performance.now() - indexStart;
global.gc?.();
const afterIndex = process.memoryUsage();

// Preserve original titles in evidence; engines index exactly the same prepared strings.
const originals = new Map(input.documents.map((document) => [document.id, document]));
const find = async (query) => (await engine.search(query)).map((hit) => originals.get(hit.id));
for (const item of input.cases.slice(0, 10)) await find(item.query);
const cpuStart = process.cpuUsage();
const samples = [];
const rows = [];
for (const item of input.cases) {
  let hits;
  // Three complete uncached searches per query. Latency includes localhost HTTP for Typesense.
  for (let repetition = 0; repetition < input.repetitions; repetition += 1) {
    const start = performance.now();
    hits = await find(item.query);
    samples.push(performance.now() - start);
  }
  rows.push(scoreCase(item, hits));
}
const nodeCpu = process.cpuUsage(cpuStart);
const negatives = [];
for (const query of input.negativeQueries) negatives.push({ query, hits: uniqueHits(await find(query)).map(({ id }) => id) });
if (negatives.some(({ hits }) => hits.length)) throw new Error("A negative-control query returned a document");
global.gc?.();
const afterQuery = process.memoryUsage();
const queryPeakRssBytes = process.resourceUsage().maxRSS * 1024;
let snapshot = null;
if (engineName === "orama") {
  const serialized = engine.snapshot();
  snapshot = { bytes: Buffer.byteLength(serialized), sha256: createHash("sha256").update(serialized).digest("hex") };
  engine.unload();
  global.gc?.();
  const start = performance.now();
  engine.restore(serialized);
  snapshot.restoreMs = performance.now() - start;
  const restored = scoreCase(input.cases[0], await find(input.cases[0].query));
  if (JSON.stringify(restored.top) !== JSON.stringify(rows[0].top)) throw new Error("Restored Orama index changed the result");
}
const preparedControls = prepareDocuments(controlDocuments, aliases, profile === "assisted");
const controlEngine = engineName === "orama"
  ? await oramaEngine(preparedControls.documents, preparedControls.normalize)
  : await typesenseEngine(preparedControls.documents, preparedControls.normalize,
    process.env.SEARCH_BENCHMARK_URL, process.env.TYPESENSE_API_KEY, `controls_${profile}`);
const controls = await checkControls(controlEngine);
if (controls.some((control) => !control.passed)) throw new Error(`Technical-token controls failed: ${JSON.stringify(controls.filter((control) => !control.passed))}`);
const grouped = (field) => Object.fromEntries([...new Set(rows.map((row) => row[field]))]
  .map((value) => [value, summarize(rows.filter((row) => row[field] === value))]));
await writeFile(outputPath, JSON.stringify({ engine: engineName, profile, prepareMs, indexMs,
  memory: { before, afterIndex, afterQuery, queryPeakRssBytes, overallPeakRssBytes: process.resourceUsage().maxRSS * 1024 },
  nodeCpuMs: (nodeCpu.user + nodeCpu.system) / 1000,
  latencyMs: { samples: samples.length, p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) },
  snapshot, quality: summarize(rows), byCategory: grouped("category"), byLanguage: grouped("language"),
  bySplit: grouped("split"), negatives, controls, rows,
}, null, 2) + "\n");
