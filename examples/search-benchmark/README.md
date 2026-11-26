# Search engine comparison

An offline prototype comparing actual **Typesense 30.2** and **Orama 3.1.18** on
GimmeJob's canonical public corpus. It does not add a public search endpoint,
change existing search/RAG behavior, or deploy a search server.

## Reproduce

Requirements: Node 22.22+, root `npm ci --ignore-scripts`, and a Linux amd64
machine for the pinned Typesense binary. The GitHub **Search engine benchmark**
workflow performs the same run without production credentials.

Download the official binary into a temporary directory, verify its pinned
archive digest, and extract it:

```bash
mkdir -p /tmp/gimmejob-typesense-30.2
curl --fail --location --max-time 180 \
  https://dl.typesense.org/releases/30.2/typesense-server-30.2-linux-amd64.tar.gz \
  --output /tmp/gimmejob-typesense-30.2/server.tar.gz
printf '%s  %s\n' \
  cd791605e7c6cc7be457794f534cd4b9f9d361781adb10e40020efc22840ebc3 \
  /tmp/gimmejob-typesense-30.2/server.tar.gz | sha256sum --check
tar -xzf /tmp/gimmejob-typesense-30.2/server.tar.gz -C /tmp/gimmejob-typesense-30.2
```

From the repository root:

```bash
node --test tests/search-benchmark.test.mjs
npm run benchmark:search -- \
  --typesense-bin=/tmp/gimmejob-typesense-30.2/typesense-server \
  --output=artifacts/search-benchmark
```

The runner creates temporary local Typesense instances on **127.0.0.1:18108**
(peering 18107), waits for both version and health readiness, uses random
disposable credentials, and removes its instances/data when finished. It never
connects to an existing Typesense service. Set `--port=18118` to use another API
port and the preceding peering port. `--repetitions=3` is the default; 1–20 are
accepted. No Docker daemon, model account or production token is needed.

`results.json` contains versions, corpus/query/dictionary hashes, resource
measurements and every labelled query's expected target and top five results.
`results.md` provides a readable summary. The checked-in `results/` directory is
one dated observation; the workflow uploads fresh evidence as an artifact.

## Corpus and labels

- `corpus.mjs` calls `staticRagDocuments()` and `ragSourcePath()` from
  `worker/rag.ts`, which discovers learning content through the existing
  `content/learning-rag-registry.ts`. No second catalog, D1 queries, vacancies or
  private information are introduced.
- Duplicate canonical IDs use explicit last-write-wins, matching Vectorize
  upsert behavior. All collisions are retained in the report. The experiment
  does not change source question IDs or titles.
- `queries.json` has **110** labelled queries: 20 intents with complete-word,
  prefix, typo, equivalent/morphology and natural-language variants, plus ten
  infix probes. Variants are correlated; 110 does not mean 110 independent
  information needs. The first twelve intents are development and the remaining
  eight holdout. The same author supplied both; this is not independent review.
- Every target is validated against the exported corpus before either engine
  runs. Most labels require a specific section; three intentionally accept a
  chapter/topic. These are known-target retrieval labels, not exhaustive
  judgements about all relevant pages.
- **Hit@5** means a labelled target appears in the first five unique canonical
  URLs. **MRR@5** is the reciprocal of its first rank, zero for a miss. Neither
  metric is precision. Results sharing a URL are deduplicated before scoring,
  from the same maximum 30 candidates per engine.
- Six empty/unknown-query controls use the actual corpus. Ten additional
  synthetic controls separately verify `C#`/`C++`/`.NET`, `401`/`403`,
  authentication/authorization and all-term matching. These are not included in
  relevance scores; a control failure fails the run.

## Profiles and measurement boundaries

Both engines receive identical documents and shared normalization. **Base**
does Unicode/case normalization, technical-symbol preservation and query
stop-word removal. **Assisted** additionally applies EN/UK stemming and the
small, versioned `aliases.json` dictionary to both documents and queries.
Equivalents are canonical rewrites, not generative expansion. Native Typesense
synonym sets and native language analyzers are not compared in this experiment.
The dictionary, settings and labels were fixed before the successful comparison;
there are no query-ID-specific ranking rules.

Title/body weights are 4/1. All retained query terms are required; Typesense
token dropping is disabled. Typo distance is restricted by word length and
disabled for numbers, short acronyms and protected symbols. Orama's distance
and prefix behavior are not identical to Typesense's. Typesense infix is enabled
only on titles for single-term queries of at least four characters; Orama is
not given a custom substring implementation to hide that capability difference.

Each engine/profile runs in a fresh Node process and indexes all documents.
Preparation and index-building durations are separate. Ten warmup queries are
excluded; every labelled query is then run three times sequentially with
Typesense's response cache disabled. Reported latency includes localhost HTTP
for Typesense and is in-process for Orama. It is not production end-to-end
latency or concurrent-load evidence.

Memory includes the full child Node process and source corpus; Typesense also
has a separate server RSS/high-water measurement on Linux. Node heap, RSS and
serialized-index size are different measurements. Query-phase Node peak is
captured before Orama snapshot round-trip. Node CPU excludes the Typesense
server and cannot compare total engine CPU. A Node run does not certify
Cloudflare Worker startup time, CPU or its 128 MB isolate limit.

No live embeddings, semantic retrieval or reranker runs. The natural-language
category deliberately exposes the lexical gap. The current canonical corpus
does not publish separate Ukrainian section documents; missing language
coverage can limit either engine. See [the decision and next design](../../docs/SEARCH-DESIGN.md).
