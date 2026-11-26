import { createHash, randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rm, open } from "node:fs/promises";
import { tmpdir, cpus, platform, arch } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { canonicalCorpus } from "./corpus.mjs";
import { validateCases } from "./model.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf("=");
  if (!arg.startsWith("--") || separator < 0) throw new Error(`Use --name=value: ${arg}`);
  return [arg.slice(2, separator), arg.slice(separator + 1)];
}));
if (!options["typesense-bin"]) throw new Error("Supply --typesense-bin=/absolute/path/to/typesense-server (30.2).");
const root = fileURLToPath(new URL("../../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "gimmejob-search-benchmark-"));
const output = path.resolve(options.output ?? path.join(root, "artifacts/search-benchmark"));
const repetitions = Number(options.repetitions ?? 3);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20) throw new Error("repetitions must be between 1 and 20");
const port = Number(options.port ?? 18108);
if (!Number.isInteger(port) || port < 1025 || port > 65534) throw new Error("Invalid local API port");

function processMemory(pid) {
  return readFile(`/proc/${pid}/status`, "utf8").then((status) => ({
    rssBytes: Number(status.match(/^VmRSS:\s+(\d+)/mu)?.[1] ?? 0) * 1024,
    peakRssBytes: Number(status.match(/^VmHWM:\s+(\d+)/mu)?.[1] ?? 0) * 1024,
  })).catch(() => null);
}

async function startServer(profile) {
  const data = path.join(temporary, `typesense-${profile}`);
  await mkdir(data);
  const log = await open(path.join(temporary, `typesense-${profile}.log`), "w");
  const key = randomBytes(24).toString("hex");
  const endpoint = `http://127.0.0.1:${port}`;
  const server = spawn(path.resolve(options["typesense-bin"]), [], { stdio: ["ignore", log.fd, log.fd], env: {
    ...process.env, TYPESENSE_DATA_DIR: data, TYPESENSE_API_KEY: key, TYPESENSE_API_ADDRESS: "127.0.0.1",
    TYPESENSE_API_PORT: String(port), TYPESENSE_PEERING_ADDRESS: "127.0.0.1", TYPESENSE_PEERING_PORT: String(port - 1),
  } });
  let startupError;
  server.on("error", (error) => { startupError = error; });
  const exit = new Promise((resolve) => { server.once("exit", resolve); server.once("error", resolve); });
  const stop = async () => {
    if (server.exitCode === null && server.signalCode === null && server.pid) {
      server.kill("SIGTERM");
      await Promise.race([exit, delay(5000, null, { ref: false })]);
      if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
      await exit;
    }
    await log.close();
  };
  try {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (startupError) throw startupError;
      if (server.exitCode !== null) throw new Error(`Local Typesense exited: ${await readFile(path.join(temporary, `typesense-${profile}.log`), "utf8")}`);
      try {
        const result = await fetch(`${endpoint}/debug`, { headers: { "X-TYPESENSE-API-KEY": key }, signal: AbortSignal.timeout(500) });
        if (result.ok) {
          const debug = await result.json();
          if (debug.version !== "30.2") throw new Error(`Expected Typesense 30.2, got ${debug.version}`);
          const health = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(500) });
          if (health.ok && (await health.json()).ok === true) {
            return { server, key, endpoint, stop, version: debug.version, baselineMemory: await processMemory(server.pid) };
          }
        }
      } catch (error) {
        if (error.message.startsWith("Expected Typesense")) throw error;
      }
      await delay(250);
    }
    throw new Error("Local Typesense did not become ready within 30 seconds");
  } catch (error) { await stop(); throw error; }
}

function render(report) {
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  const mb = (bytes) => (bytes / 1024 ** 2).toFixed(1);
  const lines = ["# Search engine benchmark", "", `Generated: ${report.generatedAt}. Corpus source: ${report.sourceCommit}.`, "",
    `${report.corpus.count} public Git-backed documents (${report.corpus.bytes} JSON bytes), ${report.queryCount} labelled queries, ${report.intentCount} intent families.`, "",
    "| Engine | Profile | Hit@5 | MRR@5 | p50 ms | p95 ms | Prepare / index ms | Query peak process RSS MiB |", "| --- | --- | --- | --- | --- | --- | --- | --- |"];
  for (const run of report.runs) lines.push(`| ${run.engine} | ${run.profile} | ${percent(run.quality.hitAt5)} | ${run.quality.mrrAt5.toFixed(3)} | ${run.latencyMs.p50.toFixed(2)} | ${run.latencyMs.p95.toFixed(2)} | ${run.prepareMs.toFixed(0)} / ${run.indexMs.toFixed(0)} | ${mb(run.memory.queryPeakRssBytes)}${run.serverMemory ? ` + server ${mb(run.serverMemory.peakRssBytes)}` : ""} |`);
  lines.push("", "RSS is the complete isolated Node process, including the input corpus and engine. Typesense also has a separate server process. It is not Cloudflare Worker memory.", "",
    "## Categories", "", "| Engine / profile | Category | Queries | Hit@5 | MRR@5 |", "| --- | --- | --- | --- | --- |");
  for (const run of report.runs) for (const [name, metrics] of Object.entries(run.byCategory)) lines.push(`| ${run.engine} / ${run.profile} | ${name} | ${metrics.count} | ${percent(metrics.hitAt5)} | ${metrics.mrrAt5.toFixed(3)} |`);
  lines.push("", "## Limits", "", ...report.limitations.map((line) => `- ${line}`), "",
    "The adjacent JSON includes every query's top five documents, target rank, category, language, split, versions, hashes, memory and latency evidence.", "");
  return lines.join("\n");
}

try {
  const { documents, sourceRowCount, collisions } = await canonicalCorpus();
  const casesText = await readFile(new URL("./queries.json", import.meta.url), "utf8");
  const cases = JSON.parse(casesText);
  validateCases(cases, documents);
  const corpusText = JSON.stringify(documents);
  const input = path.join(temporary, "input.json");
  await writeFile(input, JSON.stringify({ documents, cases, repetitions,
    negativeQueries: ["qxzvnotarealterm", "фжщнеіснуючетермін", "zxqv 98273645", "", "   ", "the and як"] }));
  const runs = [];
  for (const engine of ["orama", "typesense"]) for (const profile of ["base", "assisted"]) {
    console.log(`Benchmarking ${engine}/${profile}: ${documents.length} documents, ${cases.length} queries`);
    const service = engine === "typesense" ? await startServer(profile) : null;
    try {
      const runOutput = path.join(temporary, `${engine}-${profile}.json`);
      const child = spawn(process.execPath, ["--expose-gc", fileURLToPath(new URL("./measure.mjs", import.meta.url)), engine, profile, input, runOutput], {
        stdio: "inherit", env: { ...process.env, ...(service ? { SEARCH_BENCHMARK_URL: service.endpoint, TYPESENSE_API_KEY: service.key } : {}) },
      });
      const [status] = await once(child, "exit");
      if (status !== 0) throw new Error(`${engine}/${profile} failed (${status})`);
      const run = JSON.parse(await readFile(runOutput, "utf8"));
      if (service) Object.assign(run, { serverVersion: service.version, serverBaselineMemory: service.baselineMemory, serverMemory: await processMemory(service.server.pid) });
      runs.push(run);
    } finally { await service?.stop(); }
  }
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const implementationSha256 = Object.fromEntries(await Promise.all(
    ["corpus", "model", "engines", "measure", "run", "controls"].map(async (name) =>
      [`${name}.mjs`, hash(await readFile(new URL(`./${name}.mjs`, import.meta.url), "utf8"))]),
  ));
  const report = {
    generatedAt: new Date().toISOString(), sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    versions: { node: process.version, orama: manifest.devDependencies["@orama/orama"], stemmers: manifest.devDependencies["@orama/stemmers"], typesense: "30.2" },
    host: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length },
    corpus: { count: documents.length, sourceRowCount, collisions, bytes: Buffer.byteLength(corpusText), sha256: hash(corpusText),
      questionCount: documents.filter((document) => document.kind === "question").length,
      learningCount: documents.filter((document) => document.kind === "learning").length,
      documentsWithCyrillic: documents.filter((document) => /\p{Script=Cyrillic}/u.test(document.body)).length },
    queryCount: cases.length, intentCount: new Set(cases.map((item) => item.intent)).size,
    queriesSha256: hash(casesText), aliasesSha256: hash(await readFile(new URL("./aliases.json", import.meta.url), "utf8")), implementationSha256, repetitions,
    limitations: [
      "Lexical comparison only: no live Vectorize, embeddings, reranker, paid model calls or private data. Natural-language cases measure the lexical gap, not semantic quality.",
      "Twenty authored intent families have five correlated variants each, plus ten infix probes. This is a pilot, not a representative sample of production traffic or an exhaustive relevance judgement.",
      "Labels accept the documented target route/topic/section. Hit@5 and MRR@5 measure finding that target; they do not measure precision or the relevance of every other result.",
      "All settings and the shared alias dictionary are fixed across development and holdout intents. The holdout is authored by the same person, not an independent evaluation.",
      "Both engines receive the same canonical corpus and normalization. Assisted adds shared EN/UK stemming and curated equivalents; it is not a comparison of default language analyzers.",
      "Canonical content is preserved. Duplicate IDs are reported and resolved last-write-wins to mirror Vectorize upserts. Separate Ukrainian section documents are not currently published; missing translation coverage can limit Ukrainian retrieval regardless of engine.",
      "Orama searches in-process; Typesense timings include localhost HTTP. Network latency from Cloudflare to Hetzner, concurrent load, cold Worker startup and Worker CPU/memory are unmeasured.",
      "Typesense enables infix on short title fields for single-term queries; Orama uses prefix matching. This feature difference is intentional and is not hidden by a substring workaround.",
      "Node CPU metrics exclude the separate Typesense server and must not be used to compare total engine CPU. RSS and index times depend on this machine.",
    ], runs,
  };
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(path.join(output, "results.md"), render(report));
  console.log(render(report).split("## Categories")[0]);
  console.log(`Full evidence: ${output}`);
} finally { await rm(temporary, { recursive: true, force: true }); }
