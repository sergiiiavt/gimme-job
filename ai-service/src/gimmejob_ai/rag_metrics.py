from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class RetrievalMetrics:
    precision_at_k: float
    recall_at_k: float
    hit_rate_at_k: float
    reciprocal_rank: float
    ndcg_at_k: float

    def as_dict(self) -> dict[str, float]:
        return {
            "precision_at_k": self.precision_at_k,
            "recall_at_k": self.recall_at_k,
            "hit_rate_at_k": self.hit_rate_at_k,
            "reciprocal_rank": self.reciprocal_rank,
            "ndcg_at_k": self.ndcg_at_k,
        }


def _unique(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _bounded_k(k: int, retrieved_count: int) -> int:
    if k < 1:
        raise ValueError("k must be at least 1")
    return min(k, max(0, retrieved_count))


def precision_at_k(expected: Iterable[str], retrieved: Iterable[str], k: int) -> float:
    expected_set = set(_unique(expected))
    ranked = _unique(retrieved)
    cutoff = _bounded_k(k, len(ranked))
    if cutoff == 0:
        return 0.0
    return sum(1 for item in ranked[:cutoff] if item in expected_set) / cutoff


def recall_at_k(expected: Iterable[str], retrieved: Iterable[str], k: int) -> float:
    expected_set = set(_unique(expected))
    if not expected_set:
        return 1.0
    ranked = _unique(retrieved)
    cutoff = _bounded_k(k, len(ranked))
    return len(expected_set.intersection(ranked[:cutoff])) / len(expected_set)


def hit_rate_at_k(expected: Iterable[str], retrieved: Iterable[str], k: int) -> float:
    expected_set = set(_unique(expected))
    if not expected_set:
        return 1.0
    ranked = _unique(retrieved)
    cutoff = _bounded_k(k, len(ranked))
    return 1.0 if any(item in expected_set for item in ranked[:cutoff]) else 0.0


def reciprocal_rank(expected: Iterable[str], retrieved: Iterable[str]) -> float:
    expected_set = set(_unique(expected))
    if not expected_set:
        return 1.0
    for index, item in enumerate(_unique(retrieved), start=1):
        if item in expected_set:
            return 1.0 / index
    return 0.0


def ndcg_at_k(expected: Iterable[str], retrieved: Iterable[str], k: int) -> float:
    expected_set = set(_unique(expected))
    if not expected_set:
        return 1.0
    ranked = _unique(retrieved)
    cutoff = _bounded_k(k, len(ranked))
    if cutoff == 0:
        return 0.0

    dcg = sum(
        (1.0 / math.log2(index + 2)) if item in expected_set else 0.0
        for index, item in enumerate(ranked[:cutoff])
    )
    ideal_hits = min(len(expected_set), cutoff)
    idcg = sum(1.0 / math.log2(index + 2) for index in range(ideal_hits))
    return dcg / idcg if idcg else 0.0


def evaluate_retrieval(expected: Iterable[str], retrieved: Iterable[str], k: int) -> RetrievalMetrics:
    expected_ids = _unique(expected)
    retrieved_ids = _unique(retrieved)
    return RetrievalMetrics(
        precision_at_k=precision_at_k(expected_ids, retrieved_ids, k),
        recall_at_k=recall_at_k(expected_ids, retrieved_ids, k),
        hit_rate_at_k=hit_rate_at_k(expected_ids, retrieved_ids, k),
        reciprocal_rank=reciprocal_rank(expected_ids, retrieved_ids),
        ndcg_at_k=ndcg_at_k(expected_ids, retrieved_ids, k),
    )
