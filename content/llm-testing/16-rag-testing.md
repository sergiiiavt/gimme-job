Retrieval-augmented generation (RAG) answers questions from documents retrieved at request time. When a RAG answer is wrong, the cause can be in any stage: ingestion, chunking, embedding, retrieval, ranking, prompt assembly or generation. The goal of RAG testing is to **find the stage that failed**, with evidence.

## 1. Split the pipeline

```text
ingest -> parse -> chunk -> embed -> index          (offline)
question -> rewrite -> retrieve top-k -> rerank -> assemble prompt -> generate -> cite   (online)
```

Test the stages separately, then together:

| Stage | Question | Evidence |
|---|---|---|
| Ingestion | Did every document arrive, parsed correctly? | Document counts, parse error logs, sample diffs |
| Chunking | Do chunks keep meaning together? | Chunk size distribution, manual review of split points |
| Retrieval | Are the right chunks in the top k? | Retrieval metrics against labelled relevant chunks |
| Generation | Given the right chunks, is the answer correct and faithful? | Faithfulness and correctness evals with fixed context |
| End to end | Does the user get a correct, cited answer? | Answer correctness and citation checks |

The key technique: **evaluate generation with fixed, known-good context.** If the answer is wrong even when the right chunks are supplied, retrieval is not the problem.

## 2. Retrieval metrics

You need a labelled set: for each question, the IDs of chunks or documents that are relevant.

| Metric | Meaning |
|---|---|
| Hit rate@k | At least one relevant item is in the top k |
| Recall@k | Share of all relevant items that appear in the top k |
| Precision@k | Share of the top k that is relevant |
| MRR (mean reciprocal rank) | How high the first relevant item ranks, averaged over questions |
| nDCG@k | Ranking quality that rewards relevant items near the top |

For RAG, **recall@k usually matters most**: the generator cannot use a chunk it never sees. Precision matters when irrelevant chunks distract the model or push the context over budget.

```python
def recall_at_k(expected_ids, retrieved_ids, k):
    expected = set(expected_ids)
    if not expected:
        return 1.0
    return len(expected & set(retrieved_ids[:k])) / len(expected)
```

## 3. The RAG triad

Three questions cover most RAG quality problems:

1. **Context relevance:** is the retrieved context relevant to the question?
2. **Groundedness (faithfulness):** is every claim in the answer supported by the context?
3. **Answer relevance:** does the answer address the question that was asked?

A failure in each points to a different fix:

| Low score | Likely cause | Typical fix |
|---|---|---|
| Context relevance | Retrieval or chunking | Chunk size, hybrid search, reranker, query rewriting |
| Groundedness | Generation | Stricter prompt, citations required, smaller or stronger model, abstention rules |
| Answer relevance | Prompt or question understanding | Prompt instructions, clarifying questions |

## 4. Ragas and similar metric libraries

**Ragas** implements LLM-based RAG metrics:

- **faithfulness:** claims in the answer that can be inferred from the context;
- **answer relevancy:** how well the answer addresses the question;
- **context precision:** whether relevant chunks are ranked above irrelevant ones;
- **context recall:** whether the context contains the information in the reference answer.

DeepEval and TruLens offer comparable metrics. They are useful, but remember [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation): these metrics are judges. Spot-check them against your own labels before you trust their numbers, and pin the library and judge model versions because metric definitions change between releases.

## 5. Building a RAG test set

Good RAG test sets need four kinds of questions:

| Type | Example | Expected behaviour |
|---|---|---|
| Single-hop | "How long is the return window?" | Correct fact with citation |
| Multi-hop | "Can I return a discounted item bought abroad?" | Combines two documents correctly |
| Unanswerable | "Do you ship to Antarctica?" (not in docs) | Says it does not know; offers escalation |
| Conflicting or stale | Two documents with different return windows | Prefers the newer source or flags the conflict |

### Synthetic generation

You can generate question/answer pairs from your corpus with a model. It is fast, but watch for:

- questions that copy the source wording, so retrieval looks better than it is with real user phrasing;
- questions that are too easy (single-hop only);
- wrong reference answers that nobody reviewed.

Use synthetic sets to increase coverage, never as the only source. Always mix in real user questions.

## 6. Tuning is experimentation

Each RAG parameter is a test variable. Change one at a time and measure:

- chunk size and overlap;
- splitting strategy (fixed length, by heading, by sentence);
- embedding model;
- top k;
- hybrid search (vector plus keyword such as BM25);
- reranker on or off;
- query rewriting.

Keep a results table per experiment with retrieval metrics, end-to-end correctness, latency and cost. A configuration that wins on recall but doubles latency may lose overall.

## 7. Citation and hallucination checks

If the product shows citations:

- **validity:** every cited ID exists in the retrieved set (deterministic check);
- **support:** the cited passage actually supports the sentence it is attached to (judge or human);
- **coverage:** every factual sentence has a citation;
- **link safety:** citation links go only to allowed destinations.

## 8. RAG edge cases

- empty retrieval (nothing above the score threshold);
- very long documents and tables split badly across chunks;
- duplicate or near-duplicate documents;
- documents in different languages from the question;
- **access control:** a user must never retrieve another tenant's or another user's private documents. Test this with two accounts; it is a security defect, not a quality issue;
- **freshness:** an updated document must replace the old one in the index; test the reindex path;
- **injection in documents:** retrieved content can contain instructions. See [Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming).

## 9. Case study: GimmeJob canonical RAG

GimmeJob's Learning Path Advisor retrieves from a single canonical RAG pipeline in the Cloudflare Worker. The repository shows several of this chapter's practices:

- **Section-level retrieval units.** Published Markdown `##` sections become separate documents with deep links such as `/learn/api?topic=http-foundations&section=http-status-codes`, so retrieval can point to the narrowest useful material. This chapter is indexed the same way.
- **Degradation path.** Vectorize provides semantic candidates; a lexical ranker inside the same pipeline is the fallback when Vectorize is unavailable.
- **Deterministic retrieval metrics.** `ai-service/src/gimmejob_ai/rag_metrics.py` implements precision@k, recall@k, hit rate@k, reciprocal rank and nDCG@k, with unit tests in `ai-service/tests/test_rag_metrics.py`.
- **Runtime quality scores.** Each Learning Path trace in Langfuse records scores such as `retrieval_top_score`, `grounded_node_ratio`, `source_validity` and `map_connected`.
- **Link validation by shape.** Consumers validate that a source path has a canonical learning-route shape instead of trusting model output.

## 10. QA quick reference

- Evaluate retrieval and generation separately; test generation with fixed known-good context.
- Track recall@k first; add precision, MRR and nDCG for ranking work.
- Use the RAG triad to locate the failing stage.
- Include unanswerable, multi-hop and conflicting questions.
- Validate citations deterministically, then check support with a judge.
- Test tenant isolation and reindexing as part of RAG testing.

## Sources

- [Es et al. — RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217)
- [Ragas on GitHub](https://github.com/explodinggradients/ragas)
- [TruLens — evaluation and tracing for LLM applications](https://www.trulens.org/)
- [Liu et al. — Lost in the Middle](https://arxiv.org/abs/2307.03172)
- [GimmeJob — learning content discovery and canonical RAG](https://github.com/sergiiiavt/gimme-job/blob/main/docs/LEARNING-RAG.md)
