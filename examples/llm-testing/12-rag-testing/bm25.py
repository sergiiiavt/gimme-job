"""A BM25 index written out step by step, with access filtering inside the search itself.

Chapter: Evaluating RAG systems (how a RAG system works; robustness tests)
https://gimme-job.com/learn/llm?topic=rag-testing

BM25 scores a chunk for a query by summing, over the query terms, the term's inverse document frequency
times a saturating function of its frequency in the chunk, normalized by the chunk length:

    score = Σ idf(t) · tf · (k1 + 1) / (tf + k1 · (1 − b + b · length / average length))
    idf(t) = ln(1 + (N − n_t + 0.5) / (n_t + 0.5))
"""

import math
import re
from collections import Counter
from dataclasses import dataclass

from chunker import Chunk

WORD = re.compile(r"\w+")
STOP_WORDS = frozenset("a an and are be can do does for from i in is it my of on or the to what when where which with you your".split())


def terms(text: str) -> list[str]:
    return [word for word in WORD.findall(text.lower()) if word not in STOP_WORDS]


@dataclass(frozen=True)
class Hit:
    chunk: Chunk
    score: float


class BM25Index:
    def __init__(self, chunks: list[Chunk], k1: float = 1.2, b: float = 0.75) -> None:
        self.chunks = list(chunks)
        self.k1, self.b = k1, b
        self.counts = [Counter(terms(chunk.text)) for chunk in self.chunks]
        self.lengths = [sum(counts.values()) for counts in self.counts]
        self.average_length = sum(self.lengths) / len(self.lengths) if self.lengths else 0.0
        document_frequency = Counter(term for counts in self.counts for term in counts)
        total = len(self.chunks)
        self.idf = {term: math.log(1 + (total - n + 0.5) / (n + 0.5)) for term, n in document_frequency.items()}

    def score(self, position: int, query_terms: list[str]) -> float:
        counts, length = self.counts[position], self.lengths[position]
        total = 0.0
        for term in query_terms:
            tf = counts.get(term, 0)
            if tf:
                norm = self.k1 * (1 - self.b + self.b * length / self.average_length)
                total += self.idf[term] * tf * (self.k1 + 1) / (tf + norm)
        return total

    def search(self, query: str, k: int = 3, tenant: str = "public") -> list[Hit]:
        """Top k chunks the caller may see: public chunks and chunks of the caller's own tenant.
        Filtering happens before ranking, so a restricted chunk can never reach the context."""
        query_terms = terms(query)
        allowed = [i for i, chunk in enumerate(self.chunks) if chunk.tenant in ("public", tenant)]
        scored = [Hit(self.chunks[i], self.score(i, query_terms)) for i in allowed]
        scored = [hit for hit in scored if hit.score > 0]
        scored.sort(key=lambda hit: (-hit.score, hit.chunk.id))
        return scored[:k]
