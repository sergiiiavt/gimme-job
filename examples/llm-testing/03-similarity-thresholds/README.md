# Similarity thresholds and vector search

Chapter: [Embeddings and similarity](https://gimme-job.com/learn/llm?topic=embeddings-similarity)

A similarity threshold is a binary classifier and must be calibrated on labelled data. An approximate vector index silently loses recall and must be measured against exact search.

| File | Content |
|---|---|
| `similarity.py` | Dot product, norm, normalization, cosine similarity, Euclidean distance |
| `calibrate.py` | Threshold sweep with precision, recall, F1 and false-positive rate; chooses the highest-recall threshold that meets a precision requirement. Command-line tool |
| `ann.py` | A minimal IVF index and recall@k measurement against exact search |
| `data/labelled_pairs.jsonl` | 24 labelled question pairs, including hard negatives (same topic, different meaning) |
| `test_similarity_thresholds.py` | Property-based identities, calibration behaviour, index recall versus `nprobe` |

Calibrate on the example data (replace the file with pairs scored by your own embedding model):

```bash
cd examples/llm-testing/03-similarity-thresholds
uv run --project .. python calibrate.py data/labelled_pairs.jsonl --min-precision 0.9
```

Key ideas shown by the tests:

- Equivalent and non-equivalent pairs overlap; no threshold separates them perfectly.
- The threshold follows from the cost of errors: high precision for a semantic cache, higher recall for a pre-filter.
- Probing more index lists raises recall; probing all of them equals exact search.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/03-similarity-thresholds
```
