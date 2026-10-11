"""Corrections for many comparisons at once: Bonferroni and Holm.

Chapter: Statistics for evaluation (many slices and metrics)
https://gimme-job.com/learn/llm?topic=eval-statistics

Both control the family-wise error rate, the chance of at least one false alarm among all
comparisons. Holm (1979) rejects everything Bonferroni rejects, and sometimes more.
"""


def bonferroni(p_values: dict[str, float], alpha: float = 0.05) -> dict[str, bool]:
    return {name: p <= alpha / len(p_values) for name, p in p_values.items()}


def holm(p_values: dict[str, float], alpha: float = 0.05) -> dict[str, bool]:
    """The i-th smallest p-value (counting from 0) must be at most alpha / (m - i); stop at the first that is not."""
    ordered = sorted(p_values.items(), key=lambda item: item[1])
    significant, still_rejecting = {}, True
    for i, (name, p) in enumerate(ordered):
        still_rejecting = still_rejecting and p <= alpha / (len(ordered) - i)
        significant[name] = still_rejecting
    return {name: significant[name] for name in p_values}
