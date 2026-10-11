"""Vector similarity measures.

Chapter: Embeddings and similarity
https://gimme-job.com/learn/llm?topic=embeddings-similarity
"""

import math


def dot(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError("vectors must have the same dimension")
    return sum(x * y for x, y in zip(a, b))


def norm(a: list[float]) -> float:
    return math.sqrt(dot(a, a))


def normalize(a: list[float]) -> list[float]:
    length = norm(a)
    if length == 0:
        raise ValueError("cannot normalize the zero vector")
    return [x / length for x in a]


def cosine(a: list[float], b: list[float]) -> float:
    return dot(a, b) / (norm(a) * norm(b))


def euclidean(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError("vectors must have the same dimension")
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))
