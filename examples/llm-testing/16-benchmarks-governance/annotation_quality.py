"""Quality of human labels: Krippendorff's alpha for any number of annotators, missing labels and four
levels of measurement; accuracy on gold items; systematic confusions between annotators.

Chapter: Benchmarks, human evaluation and governance (human evaluation programs)
https://gimme-job.com/learn/llm?topic=pro-practice

Alpha follows Krippendorff, "Computing Krippendorff's Alpha-Reliability" (2011): a coincidence matrix
of all pairs of values within each unit, and alpha = 1 - observed disagreement / expected disagreement.
"""

import math
from collections import Counter
from collections.abc import Hashable, Sequence
from itertools import permutations

METRICS = ("nominal", "ordinal", "interval", "ratio")


def coincidences(columns: Sequence[Sequence[Hashable | None]]) -> Counter:
    """One column per annotator, one row per unit; None is a missing label. Units with fewer than two
    labels are not pairable and do not count."""
    if len({len(column) for column in columns}) > 1:
        raise ValueError("every annotator needs one entry per unit (None for missing)")
    matrix: Counter = Counter()
    for unit in zip(*columns):
        values = [value for value in unit if value is not None]
        for pair in permutations(values, 2):
            matrix[pair] += 1 / (len(values) - 1)
    return matrix


def _distance(metric: str, totals: Counter, values: list) -> dict[tuple, float]:
    """Squared differences between values for the chosen level of measurement."""
    distances = {}
    for c in values:
        for k in values:
            if metric == "nominal":
                distances[c, k] = 0.0 if c == k else 1.0
            elif metric == "interval":
                distances[c, k] = (c - k) ** 2
            elif metric == "ratio":
                distances[c, k] = 0.0 if c == k else ((c - k) / (c + k)) ** 2
            else:  # ordinal: how many values lie between c and k, counted by their frequencies
                low, high = min(c, k), max(c, k)
                between = sum(totals[g] for g in values if low <= g <= high)
                distances[c, k] = (between - (totals[c] + totals[k]) / 2) ** 2
    return distances


def krippendorff_alpha(columns: Sequence[Sequence[Hashable | None]], metric: str = "nominal") -> float:
    if metric not in METRICS:
        raise ValueError(f"metric must be one of {METRICS}")
    matrix = coincidences(columns)
    totals: Counter = Counter()
    for pair, weight in matrix.items():
        totals[pair[0]] += weight
    n = sum(totals.values())
    if n < 2:
        raise ValueError("at least one unit needs two labels")
    values = sorted(totals)
    distances = _distance(metric, totals, values)
    observed = sum(weight * distances[pair] for pair, weight in matrix.items()) / n
    expected = sum(totals[c] * totals[k] * distances[c, k] for c in values for k in values) / (n * (n - 1))
    if expected == 0:
        raise ValueError("every label has the same value, so agreement cannot be told apart from chance")
    return 1 - observed / expected


def reading(alpha: float) -> str:
    """Krippendorff (2004): rely on alpha >= 0.800, draw tentative conclusions from 0.667 - no magical numbers."""
    if alpha >= 0.8:
        return "reliable"
    return "tentative conclusions only" if alpha >= 0.667 else "do not use the labels yet"


def gold_accuracy(labels: Sequence[Hashable | None], gold: dict[int, Hashable]) -> tuple[int, int, float]:
    """Correct answers on the gold units an annotator labelled, and the Wilson lower bound of the accuracy."""
    answered = [unit for unit in gold if labels[unit] is not None]
    correct = sum(1 for unit in answered if labels[unit] == gold[unit])
    n, z = len(answered), 1.959963984540054
    if n == 0:
        return 0, 0, 0.0
    p = correct / n
    center = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return correct, n, max(0.0, center - half)


def confusions(reference: Sequence[Hashable | None], other: Sequence[Hashable | None]) -> Counter:
    """(reference label, other label) counts where both labelled the unit and they disagree."""
    return Counter((a, b) for a, b in zip(reference, other) if a is not None and b is not None and a != b)
