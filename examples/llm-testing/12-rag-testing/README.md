# Evaluating RAG systems

Chapter: [Evaluating RAG systems](https://gimme-job.com/learn/llm?topic=rag-testing)

A small but complete RAG system over the store's policies and two customer tickets, with tests for every stage: chunking, retrieval, versions of documents, access control, generation with citations, faithfulness and abstention.

| File | Content |
|---|---|
| `chunker.py` | Sentence chunks with overlap that never cross a section, keep over-long sentences whole and carry document metadata (tenant, version date) |
| `bm25.py` | A BM25 index written out step by step; access filtering happens inside the search, before ranking |
| `retrieval_eval.py` | hit@k, recall@k, precision@k, reciprocal rank and nDCG@k, and an evaluation against labelled questions. Command-line tool |
| `rag_pipeline.py` | Retrieval, newest-version filtering, cited context, a deterministic fake generator with fault injection, abstention, and an outcome report. Command-line tool |
| `faithfulness.py` | Claim-level support (a code stand-in for a validated judge), citation checks in code, and abstention outcomes |
| `data/documents.json` | Current returns, refunds and delivery policies, an outdated returns policy, and private tickets of two customers |
| `data/questions.jsonl` | 12 questions with relevance labels computed from the chunker's output, including two without an answer |

## Retrieval

```bash
cd examples/llm-testing/12-rag-testing
uv run --project .. python retrieval_eval.py data/documents.json data/questions.jsonl
```

```text
10 chunks, 10 answerable questions
hit@3 0.90  recall@3 0.90  precision@3 0.33  MRR 0.80  nDCG@3 0.83
MISSED: Can I send back sneakers I already wore?
```

"Send back sneakers I already wore" shares no word with "unworn items can be returned", so a lexical retriever cannot find the answer. That is the case for semantic or hybrid retrieval, and for synonyms in query rewriting.

## End to end

```bash
uv run --project .. python rag_pipeline.py data/documents.json data/questions.jsonl
```

```text
correct answer                         9
wrong answer                           0
false abstention                       1
correct abstention                     2
answer to an unanswerable question     0
claims supported by their citations: 13/13, uncited claims: 0
```

The retrieval miss becomes a false abstention: the system did not invent an answer, but the customer did not get one either.

## What the tests show

- Property-based tests over generated documents: no sentence is lost, chunks never cross a section, size limits hold except for a single over-long sentence, IDs are unique and neighbours share at most the configured overlap. A repeated sentence is kept every time it occurs.
- BM25 ranks the chunk with the query terms first, weighs rare terms more than common ones and prefers the shorter of two equally matching chunks.
- A customer never retrieves another customer's ticket, and the public search never returns private tickets.
- The current 30-day policy wins over the outdated 14-day version.
- Injected faults are caught: an invented claim without a source, answers without citations, and a citation of a chunk that does not support the claim. An absolute claim ("always refunded") contradicting a limited source ("only when") is unsupported.
- Metamorphic relations hold: the order of documents in the index, the order of chunks in the context, and the case and punctuation of a question change nothing.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/12-rag-testing
```
