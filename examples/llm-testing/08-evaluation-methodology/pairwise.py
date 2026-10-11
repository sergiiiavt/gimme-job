"""Pairwise (all-pairs) selection of synthetic case specifications.

Chapter: Evaluation methodology and datasets (synthetic cases with coverage)
https://gimme-job.com/learn/llm?topic=evaluation-fundamentals

Usage:
    python pairwise.py data/dimensions.json
Each selected combination becomes an instruction for a generator model; every generated case is
reviewed by a person before it enters the dataset.
"""

import json
import sys
from itertools import combinations, product
from pathlib import Path


def value_pairs(names: list[str], values: tuple) -> set[tuple]:
    return {((names[i], values[i]), (names[j], values[j])) for i, j in combinations(range(len(values)), 2)}


def all_pairs(dimensions: dict[str, list[str]]) -> list[dict[str, str]]:
    """Greedy all-pairs: repeatedly take the combination that covers the most uncovered value pairs.
    Deterministic: ties go to the earliest combination in product order."""
    names = list(dimensions)
    candidates = list(product(*dimensions.values()))
    uncovered = set().union(*(value_pairs(names, values) for values in candidates))
    chosen = []
    while uncovered:
        best = max(candidates, key=lambda values: len(value_pairs(names, values) & uncovered))
        chosen.append(dict(zip(names, best)))
        uncovered -= value_pairs(names, best)
    return chosen


def uncovered_pairs(dimensions: dict[str, list[str]], chosen: list[dict[str, str]]) -> set[tuple]:
    """Value pairs that no chosen combination covers; empty when the selection is complete."""
    names = list(dimensions)
    required = set().union(*(value_pairs(names, values) for values in product(*dimensions.values())))
    covered = set().union(*(value_pairs(names, tuple(spec[name] for name in names)) for spec in chosen))
    return required - covered


def main(argv: list[str]) -> int:
    dimensions = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    total = 1
    for values in dimensions.values():
        total *= len(values)
    chosen = all_pairs(dimensions)
    print(f"{total} combinations, {len(chosen)} cover every pair of values")
    for spec in chosen:
        print("  " + ", ".join(f"{name}={value}" for name, value in spec.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
