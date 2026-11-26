# Global search: prototype decision

Status: **Typesense is the preferred lexical candidate; production integration
is not implemented.** This decision is based on the reproducible pilot in
[`examples/search-benchmark`](../examples/search-benchmark/README.md), not a
claim that the complete hybrid search has been validated.

## Observed comparison

The dated report and complete per-query evidence are in
[`results/`](../examples/search-benchmark/results/). The run uses 3,316 unique
canonical public documents, 110 queries across 20 related intent families,
and two profiles. The source corpus has 3,317 rows; one duplicate ID is resolved
last-write-wins and disclosed in the report.

| Retrieval goal | Orama base Hit@5 | Typesense base Hit@5 |
| --- | --- | --- |
| Complete words | 85% | 85% |
| Prefixes | 75% | 75% |
| Typos | 30% | 65% |
| Infix probes | 30% | 90% |
| Equivalent/morphology queries | 0% | 0% |
| Natural-language questions | 0% | 0% |

With the combined shared stemming/equivalents profile, equivalent/morphology Hit@5 becomes
50% for Orama and 65% for Typesense. However, typo retrieval and overall MRR
decline. This is evidence **against replacing every original token with its
stem**. This experiment does not isolate stemming from the dictionary or its
interaction with typo thresholds. The improved aggregate Hit@5 does not justify
the loss of exactness.

The base Orama index uses about 81 MiB of Node heap after indexing, including
the input corpus, with higher process RSS. Its serialized snapshot is about
26 MiB. That is a meaningful share of a 128 MB Worker isolate before the
application and concurrent work. This does not prove that Orama cannot run in
a Worker; a separate, production-like memory/CPU/startup check is required.

Typesense's separate server reaches roughly 240 MiB peak RSS on this host.
Loopback p95 searches are around 3–5 ms for both engines; this excludes the
Cloudflare-to-server network and production concurrency. Exact measurements,
machine details and boundaries are in the report.

These are small, authored, correlated samples. Holdout intents are reported
separately, but are not independently authored. Some labels accept a chapter,
others a specific section. No statistical generalization or exhaustive precision
claim is supported.

## Proposed architecture

Keep the existing **canonical corpus and Worker retrieval boundary**. Global
search and the AI Advisor must use the same discovery, source identifiers and
deep links. Typesense would be the lexical index, not a new content authority.
Vectorize/BGE-M3 remains the existing semantic candidate provider. Public search
starts with public learning/reference material and questions; private progress,
resume data and application state do not enter its index.

1. Derive a search document for a section, reference card or question from the
   canonical registry. Preserve original text separately from normalized fields.
2. Index original titles/headings/technical terms with high weight; index
   optional normalized equivalents with lower weight. Curated aliases may be
   directional; related concepts must not automatically become synonyms.
3. Send autocomplete to the lexical path. After a completed query or pause,
   retrieve lexical and semantic candidates in parallel where appropriate.
4. Fuse ranks, prefer exact technical/title matches, deduplicate and diversify
   sections from one parent article. Preserve a lexical-only degradation path.
5. Return a snippet, content type, language and a canonical section link. Search
   does not need a generated answer to be useful.

Typesense also supports native hybrid retrieval, but moving vector ownership
would be a separate migration. Do not introduce a second independently
maintained corpus, manual publishing step or competing semantic source.

## Preconditions before implementation

- **Corpus integrity:** resolve the existing duplicate `performance-test-types`
  identity without silently changing public IDs/titles. Decide how distinct
  questions are uniquely linked; current RAG question routes are catalog-level,
  so URL deduplication can collapse unrelated questions.
- **Bilingual sections:** emit English and Ukrainian search documents with a
  shared canonical section identity and language-specific text. Existing
  title-first truncation and English-only section splitting are not a suitable
  complete bilingual search representation. Measure coverage before embedding.
- **Exactness:** keep `C#`, `C++`, `.NET`, versions, HTTP status codes and
  identifiers distinct. Do not silently discard user terms to manufacture hits.
- **Equivalents:** benchmark native synonym sets or query expansion while
  preserving the original exact query. Do not carry over the pilot's aggressive
  global stemming as the production default.
- **Semantics:** evaluate actual BGE-M3/Vectorize results and fusion against
  reviewed EN/UK information needs. Lexical-only misses do not prove a model
  will solve them. Existing live binding/credential readiness is unverified by
  this offline run.
- **Operations:** measure available Hetzner RAM and concurrent load before
  choosing co-location. Set search timeouts, bounded responses and lexical
  fallback. Update both derived indexes through the normal release lifecycle,
  including deletions, freshness/version tracking and rollback.
- **Evaluation:** add independently reviewed queries and graded relevance,
  measure p95 from the deployed Worker and memory/CPU under concurrent load.

## Technology references

- [Typesense search parameters](https://typesense.org/docs/30.2/api/search.html)
- [Typesense synonym sets](https://typesense.org/docs/30.2/api/synonyms.html)
- [Typesense system requirements](https://typesense.org/docs/guide/system-requirements.html)
- [Orama](https://github.com/oramasearch/orama)
- [Orama language stemmers](https://docs.orama.com/docs/orama-js/text-analysis/stemming)
- [Cloudflare Worker limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare AI Search hybrid retrieval](https://developers.cloudflare.com/ai-search/configuration/indexing/hybrid-search/)

Cloudflare AI Search is a managed alternative worth a separate comparison if
running a search server is undesirable. It and Meilisearch were researched but
were not executed in this experiment; the report makes no performance claim
about either.
