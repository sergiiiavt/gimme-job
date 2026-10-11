"""Measure the recall of an approximate nearest-neighbour index against exact search.

Chapter: Embeddings and similarity (vector search)
https://gimme-job.com/learn/llm?topic=embeddings-similarity

The index here is a minimal IVF (inverted file) index: documents are assigned to the nearest of
a few centroids, and a query searches only the `nprobe` closest lists. Production vector stores
use the same idea (IVF) or graphs (HNSW); the measurement method is identical.
"""

import random

from similarity import dot, normalize


class IvfIndex:
    def __init__(self, docs: list[list[float]], n_lists: int, rng: random.Random):
        self.docs = docs
        self.centroids = rng.sample(docs, n_lists)
        self.lists: dict[int, list[int]] = {i: [] for i in range(n_lists)}
        for doc_id, doc in enumerate(docs):
            nearest = max(range(n_lists), key=lambda c: dot(doc, self.centroids[c]))
            self.lists[nearest].append(doc_id)

    def search(self, query: list[float], k: int, nprobe: int) -> tuple[list[int], int]:
        probe = sorted(range(len(self.centroids)), key=lambda c: dot(query, self.centroids[c]), reverse=True)[:nprobe]
        candidates = [doc_id for c in probe for doc_id in self.lists[c]]
        best = sorted(candidates, key=lambda d: dot(query, self.docs[d]), reverse=True)[:k]
        return best, len(candidates)


def exact_search(docs: list[list[float]], query: list[float], k: int) -> list[int]:
    return sorted(range(len(docs)), key=lambda d: dot(query, docs[d]), reverse=True)[:k]


def recall_at_k(index: IvfIndex, queries: list[list[float]], k: int, nprobe: int) -> float:
    total = 0.0
    for query in queries:
        expected = set(exact_search(index.docs, query, k))
        found, _ = index.search(query, k, nprobe)
        total += len(expected & set(found)) / k
    return total / len(queries)


def random_unit_vectors(count: int, dim: int, rng: random.Random) -> list[list[float]]:
    return [normalize([rng.gauss(0, 1) for _ in range(dim)]) for _ in range(count)]
