"""Choosing a model: hard requirements, the Pareto front of quality, cost and latency, and quality ties
decided by paired comparisons on the same cases.

Chapter: Benchmarks, human evaluation and governance (choosing a model)
https://gimme-job.com/learn/llm?topic=pro-practice

Usage:
    python model_selection.py data/candidates.json
"""

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

Z_95 = 1.959963984540054


@dataclass(frozen=True)
class Candidate:
    name: str
    passed: tuple[bool, ...]  # results on the shared evaluation cases, in the same order for every candidate
    cost_per_resolved: float  # EUR
    p95_latency: float  # seconds
    context_tokens: int

    @property
    def quality(self) -> float:
        return sum(self.passed) / len(self.passed)


def dominates(a: Candidate, b: Candidate) -> bool:
    """a is at least as good as b on quality, cost and latency, and better on at least one."""
    at_least = a.quality >= b.quality and a.cost_per_resolved <= b.cost_per_resolved and a.p95_latency <= b.p95_latency
    better = a.quality > b.quality or a.cost_per_resolved < b.cost_per_resolved or a.p95_latency < b.p95_latency
    return at_least and better


def pareto_front(candidates: list[Candidate]) -> list[Candidate]:
    return [c for c in candidates if not any(dominates(other, c) for other in candidates if other is not c)]


def paired_difference(a: Candidate, b: Candidate) -> tuple[float, float, float]:
    """Quality of b minus a, with a paired 95% interval over the shared cases."""
    if len(a.passed) != len(b.passed):
        raise ValueError("candidates must be evaluated on the same cases")
    n = len(a.passed)
    only_a = sum(1 for x, y in zip(a.passed, b.passed) if x and not y)
    only_b = sum(1 for x, y in zip(a.passed, b.passed) if y and not x)
    diff = (only_b - only_a) / n
    half = Z_95 * math.sqrt(only_a + only_b - (only_b - only_a) ** 2 / n) / n
    return diff, diff - half, diff + half


def choose(candidates: list[Candidate], min_quality: float, max_latency: float, min_context: int,
           quality_margin: float) -> tuple[Candidate | None, list[str]]:
    """Drop candidates that fail a hard requirement and keep the Pareto front. A candidate on the front is
    as good as the best one for the decision when its quality is not worse by more than the agreed margin
    (the lower bound of the paired difference stays above -margin); the cheapest of those wins."""
    notes, eligible = [], []
    for c in candidates:
        if c.quality < min_quality or c.p95_latency > max_latency or c.context_tokens < min_context:
            notes.append(f"{c.name}: fails a hard requirement")
        else:
            eligible.append(c)
    front = pareto_front(eligible)
    notes += [f"{c.name}: dominated" for c in eligible if c not in front]
    if not front:
        return None, notes
    best = max(front, key=lambda c: c.quality)
    good_enough = [c for c in front if c is best or paired_difference(best, c)[1] > -quality_margin]
    margin = f"{quality_margin * 100:g} points"
    notes += [f"{c.name}: on the Pareto front, within {margin} of {best.name}" for c in good_enough if c is not best]
    notes += [f"{c.name}: on the Pareto front, but may be more than {margin} worse than {best.name}"
              for c in front if c not in good_enough]
    return min(good_enough, key=lambda c: (c.cost_per_resolved, c.p95_latency)), notes


def load(path: Path) -> tuple[dict, list[Candidate]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    candidates = [Candidate(row["name"], tuple(bool(x) for x in row["passed"]), row["cost_per_resolved"],
                            row["p95_latency"], row["context_tokens"]) for row in data["candidates"]]
    return data["requirements"], candidates


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Choose a model from evaluation results.")
    parser.add_argument("candidates", type=Path)
    args = parser.parse_args(argv[1:])

    requirements, candidates = load(args.candidates)
    print(f"{'model':<10} {'quality':>8} {'EUR/resolved':>13} {'p95':>6} {'context':>8}")
    for c in candidates:
        print(f"{c.name:<10} {c.quality:>8.1%} {c.cost_per_resolved:>13.4f} {c.p95_latency:>5.1f}s {c.context_tokens:>8}")
    chosen, notes = choose(candidates, **requirements)
    for note in notes:
        print(note)
    print("choice:", chosen.name if chosen else "none meets the requirements")
    return 0 if chosen else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
