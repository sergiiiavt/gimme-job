# Search engine benchmark

Generated: 2026-11-26T20:10:00.095Z. Corpus source: 794e1c4ef4b0afdb505268811b53f5c82bcc0c50.

3316 public Git-backed documents (5922283 JSON bytes), 110 labelled queries, 20 intent families.

| Engine | Profile | Hit@5 | MRR@5 | p50 ms | p95 ms | Prepare / index ms | Query peak process RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| orama | base | 37.3% | 0.325 | 0.76 | 4.24 | 175 / 988 | 181.1 |
| orama | assisted | 40.9% | 0.341 | 0.56 | 3.20 | 1057 / 806 | 174.9 |
| typesense | base | 49.1% | 0.412 | 1.53 | 3.09 | 187 / 685 | 137.0 + server 241.8 |
| typesense | assisted | 50.9% | 0.368 | 1.72 | 3.19 | 1015 / 474 | 136.6 + server 235.7 |

RSS is the complete isolated Node process, including the input corpus and engine. Typesense also has a separate server process. It is not Cloudflare Worker memory.

## Categories

| Engine / profile | Category | Queries | Hit@5 | MRR@5 |
| --- | --- | --- | --- | --- |
| orama / base | exact | 20 | 85.0% | 0.775 |
| orama / base | prefix | 20 | 75.0% | 0.633 |
| orama / base | typo | 20 | 30.0% | 0.267 |
| orama / base | alias-morphology | 20 | 0.0% | 0.000 |
| orama / base | natural-language | 20 | 0.0% | 0.000 |
| orama / base | infix | 10 | 30.0% | 0.220 |
| orama / assisted | exact | 20 | 80.0% | 0.700 |
| orama / assisted | prefix | 20 | 75.0% | 0.608 |
| orama / assisted | typo | 20 | 10.0% | 0.100 |
| orama / assisted | alias-morphology | 20 | 50.0% | 0.392 |
| orama / assisted | natural-language | 20 | 0.0% | 0.000 |
| orama / assisted | infix | 10 | 20.0% | 0.150 |
| typesense / base | exact | 20 | 85.0% | 0.825 |
| typesense / base | prefix | 20 | 75.0% | 0.529 |
| typesense / base | typo | 20 | 65.0% | 0.600 |
| typesense / base | alias-morphology | 20 | 0.0% | 0.000 |
| typesense / base | natural-language | 20 | 0.0% | 0.000 |
| typesense / base | infix | 10 | 90.0% | 0.625 |
| typesense / assisted | exact | 20 | 90.0% | 0.725 |
| typesense / assisted | prefix | 20 | 70.0% | 0.483 |
| typesense / assisted | typo | 20 | 30.0% | 0.237 |
| typesense / assisted | alias-morphology | 20 | 65.0% | 0.442 |
| typesense / assisted | natural-language | 20 | 0.0% | 0.000 |
| typesense / assisted | infix | 10 | 50.0% | 0.278 |

## Limits

- Lexical comparison only: no live Vectorize, embeddings, reranker, paid model calls or private data. Natural-language cases measure the lexical gap, not semantic quality.
- Twenty authored intent families have five correlated variants each, plus ten infix probes. This is a pilot, not a representative sample of production traffic or an exhaustive relevance judgement.
- Labels accept the documented target route/topic/section. Hit@5 and MRR@5 measure finding that target; they do not measure precision or the relevance of every other result.
- All settings and the shared alias dictionary are fixed across development and holdout intents. The holdout is authored by the same person, not an independent evaluation.
- Both engines receive the same canonical corpus and normalization. Assisted adds shared EN/UK stemming and curated equivalents; it is not a comparison of default language analyzers.
- Canonical content is preserved. Duplicate IDs are reported and resolved last-write-wins to mirror Vectorize upserts. Separate Ukrainian section documents are not currently published; missing translation coverage can limit Ukrainian retrieval regardless of engine.
- Orama searches in-process; Typesense timings include localhost HTTP. Network latency from Cloudflare to Hetzner, concurrent load, cold Worker startup and Worker CPU/memory are unmeasured.
- Typesense enables infix on short title fields for single-term queries; Orama uses prefix matching. This feature difference is intentional and is not hidden by a substring workaround.
- Node CPU metrics exclude the separate Typesense server and must not be used to compare total engine CPU. RSS and index times depend on this machine.

The adjacent JSON includes every query's top five documents, target rank, category, language, split, versions, hashes, memory and latency evidence.
