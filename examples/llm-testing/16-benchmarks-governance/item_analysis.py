"""Item analysis for a benchmark: difficulty and discrimination of every item, with verdicts for items
that carry no information or probably have a wrong reference answer.

Chapter: Benchmarks, human evaluation and governance (building a custom benchmark)
https://gimme-job.com/learn/llm?topic=pro-practice

Usage:
    python item_analysis.py data/model_results.jsonl
Each JSONL line holds one model: {"model": ..., "results": [1, 0, 1, ...]} with one result per item.
"""

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from statistics import correlation, fmean


@dataclass(frozen=True)
class Item:
    number: int
    difficulty: float  # share of models that solve the item
    discrimination: float | None  # correlation of the item with the score on all other items

    @property
    def verdict(self) -> str:
        if self.discrimination is None:
            return "nobody solves it: too hard or broken" if self.difficulty == 0 else "everyone solves it: no information"
        if self.discrimination < -0.2:
            return "stronger models fail more often: check the reference answer"
        if self.discrimination < 0.2:
            return "weak: hardly separates the models"
        return "ok"


def analyse(matrix: list[list[int]]) -> list[Item]:
    """`matrix` has one row per model and one 0/1 column per item."""
    if len({len(row) for row in matrix}) != 1:
        raise ValueError("every model needs a result for every item")
    items = []
    for column in range(len(matrix[0])):
        scores = [row[column] for row in matrix]
        rest = [sum(row) - row[column] for row in matrix]
        difficulty = fmean(scores)
        discrimination = None
        if 0 < difficulty < 1 and len(set(rest)) > 1:
            discrimination = correlation(scores, rest)
        items.append(Item(column + 1, difficulty, discrimination))
    return items


def interval_half_width(items: int, rate: float, z: float = 1.959963984540054) -> float:
    """Half-width of the normal-approximation 95% interval of a score on a benchmark of this size."""
    return z * math.sqrt(rate * (1 - rate) / items)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Difficulty and discrimination of benchmark items.")
    parser.add_argument("results", type=Path)
    args = parser.parse_args(argv[1:])

    rows = [json.loads(line) for line in args.results.read_text(encoding="utf-8").splitlines() if line.strip()]
    items = analyse([row["results"] for row in rows])
    flagged = [item for item in items if item.verdict != "ok"]
    scores = [fmean(row["results"]) for row in rows]
    print(f"{len(rows)} systems, {len(items)} items, scores from {min(scores):.0%} to {max(scores):.0%}")
    print(f"{'item':<5} {'solved':>7} {'discrimination':>14}  verdict")
    for item in flagged:
        shown = "-" if item.discrimination is None else f"{item.discrimination:+.2f}"
        print(f"{item.number:<5} {item.difficulty:>7.0%} {shown:>14}  {item.verdict}")
    print(f"{len(items) - len(flagged)} items are ok; {len(flagged)} need attention")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
