"""Compare a candidate with the baseline on the same cases and decide: ship, block or inconclusive.

Chapter: Statistics for evaluation (turning statistics into release gates)
https://gimme-job.com/learn/llm?topic=eval-statistics

Usage:
    python compare_versions.py data/results.jsonl --baseline A --candidate B --margin 0.02
Each JSONL line holds {"id": ..., "lang": ..., "feature": ..., "zero_tolerance": true|false,
"passed": {"A": true|false, "B": ...}}. Exit status: 0 ship, 1 block, 2 inconclusive.

The decision rule is fixed before the run: zero-tolerance cases are hard gates, and otherwise the
candidate ships when the paired 95% interval of its difference to the baseline stays above -margin
(non-inferiority). Slices are reported with the Holm correction for the investigation that follows,
not for the decision.
"""

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from intervals import wilson
from multiple_testing import holm
from paired_tests import PairedCounts, mcnemar_exact, paired_difference

SLICE_TAGS = ("lang", "feature")
EXIT_CODES = {"ship": 0, "block": 1, "inconclusive": 2}


@dataclass(frozen=True)
class Decision:
    verdict: str  # ship, block or inconclusive
    reason: str


@dataclass(frozen=True)
class SliceResult:
    name: str
    counts: PairedCounts
    difference: float
    p_value: float
    significant: bool  # after the Holm correction across all slices


@dataclass(frozen=True)
class Comparison:
    counts: PairedCounts
    difference: tuple[float, float, float]  # B - A, low, high
    p_value: float
    hard_gate_failures: list[str]
    slices: list[SliceResult]
    decision: Decision


def decide(low: float, high: float, margin: float, hard_gate_failures: list[str]) -> Decision:
    if hard_gate_failures:
        return Decision("block", f"zero-tolerance cases failed: {', '.join(hard_gate_failures)}")
    if low > -margin:
        return Decision("ship", f"not worse than the baseline by more than {margin:.0%}: lower bound {low:+.1%}")
    if high < 0:
        return Decision("block", f"regression: even the upper bound {high:+.1%} is below zero")
    return Decision("inconclusive", f"the interval [{low:+.1%}, {high:+.1%}] still allows a loss of more than "
                                    f"{margin:.0%}; add cases or keep the baseline")


def load(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def _paired(rows: list[dict], baseline: str, candidate: str) -> PairedCounts:
    return PairedCounts.from_results({row["id"]: row["passed"][baseline] for row in rows},
                                     {row["id"]: row["passed"][candidate] for row in rows})


def compare(rows: list[dict], baseline: str, candidate: str, margin: float = 0.02) -> Comparison:
    counts = _paired(rows, baseline, candidate)
    diff, low, high = paired_difference(counts)
    hard_gate_failures = [row["id"] for row in rows if row["zero_tolerance"] and not row["passed"][candidate]]

    groups: dict[str, list[dict]] = {}
    for row in rows:
        for tag in SLICE_TAGS:
            groups.setdefault(f"{tag}={row[tag]}", []).append(row)
    slice_counts = {name: _paired(group, baseline, candidate) for name, group in sorted(groups.items())}
    p_values = {name: mcnemar_exact(c.only_a, c.only_b) for name, c in slice_counts.items()}
    significant = holm(p_values)
    slices = [SliceResult(name, c, c.rate_b - c.rate_a, p_values[name], significant[name]) for name, c in slice_counts.items()]

    return Comparison(counts, (diff, low, high), mcnemar_exact(counts.only_a, counts.only_b), hard_gate_failures,
                      slices, decide(low, high, margin, hard_gate_failures))


def report_lines(result: Comparison, baseline: str, candidate: str) -> list[str]:
    counts = result.counts
    lines = []
    for name, passed in [(baseline, counts.both + counts.only_a), (candidate, counts.both + counts.only_b)]:
        low, high = wilson(passed, counts.n)
        lines.append(f"{name}: {passed}/{counts.n} passed, {passed / counts.n:.1%} (95% CI {low:.1%} to {high:.1%})")
    diff, low, high = result.difference
    lines.append(f"cases only {baseline} passes: {counts.only_a}, only {candidate} passes: {counts.only_b}")
    lines.append(f"{candidate} - {baseline}: {diff:+.1%}, paired 95% CI {low:+.1%} to {high:+.1%}, McNemar p = {result.p_value:.3f}")
    lines.append(f"{'slice':<18} {'cases':>5} {'change':>8} {'p':>7}  after Holm")
    for item in result.slices:
        verdict = "significant" if item.significant else "-"
        lines.append(f"{item.name:<18} {item.counts.n:>5} {item.difference:>+8.1%} {item.p_value:>7.3f}  {verdict}")
    lines.append(f"decision: {result.decision.verdict.upper()}, {result.decision.reason}")
    return lines


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Paired comparison of two versions with a release decision.")
    parser.add_argument("results", type=Path)
    parser.add_argument("--baseline", default="A")
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--margin", type=float, default=0.02, help="accepted loss, decided before the run")
    args = parser.parse_args(argv[1:])

    result = compare(load(args.results), args.baseline, args.candidate, args.margin)
    for line in report_lines(result, args.baseline, args.candidate):
        print(line)
    return EXIT_CODES[result.decision.verdict]


if __name__ == "__main__":
    sys.exit(main(sys.argv))
