"""Decoding: softmax with temperature, greedy decoding, top-k, top-p and sampling.

Chapter: How LLMs generate text
https://gimme-job.com/learn/llm?topic=llm-foundations
"""

import math
import random


def softmax(logits: list[float], temperature: float = 1.0) -> list[float]:
    """Turn logits into probabilities. Temperature must be positive; use greedy() for 'temperature 0'."""
    if temperature <= 0:
        raise ValueError("temperature must be positive; use greedy() for deterministic decoding")
    scaled = [value / temperature for value in logits]
    largest = max(scaled)                                  # subtract the max for numerical stability
    exps = [math.exp(value - largest) for value in scaled]
    total = sum(exps)
    return [value / total for value in exps]


def greedy(logits: list[float]) -> int:
    """Index of the highest logit: what sampling approaches as temperature goes to 0."""
    return max(range(len(logits)), key=logits.__getitem__)


def _renormalize(probs: list[float], keep: set[int]) -> list[float]:
    kept = [p if i in keep else 0.0 for i, p in enumerate(probs)]
    total = sum(kept)
    return [p / total for p in kept]


def top_k(probs: list[float], k: int) -> list[float]:
    """Keep the k most probable tokens and renormalize."""
    if k < 1:
        raise ValueError("k must be at least 1")
    order = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)
    return _renormalize(probs, set(order[:k]))


def top_p(probs: list[float], p: float) -> list[float]:
    """Nucleus sampling: keep the smallest set of most probable tokens whose mass reaches p."""
    if not 0 < p <= 1:
        raise ValueError("p must be in (0, 1]")
    order = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)
    keep, cumulative = set(), 0.0
    for i in order:
        keep.add(i)
        cumulative += probs[i]
        if cumulative >= p - 1e-12:
            break
    return _renormalize(probs, keep)


def sample(tokens: list[str], probs: list[float], rng: random.Random) -> str:
    return rng.choices(tokens, weights=probs, k=1)[0]
