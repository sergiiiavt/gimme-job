"""Calibrate a similarity threshold on human-labelled pairs.

Chapter: Embeddings and similarity
https://gimme-job.com/learn/llm?topic=embeddings-similarity

Usage:
    python calibrate.py data/labelled_pairs.jsonl --min-precision 0.9

Each JSONL line holds {"left": ..., "right": ..., "similarity": float, "equivalent": bool}, where the
similarity was computed with the exact embedding model version the system uses.
"""

import argparse
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ThresholdStats:
    threshold: float
    precision: float
    recall: float
    f1: float
    false_positive_rate: float


def load_pairs(path: Path) -> list[tuple[float, bool]]:
    pairs = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            record = json.loads(line)
            pairs.append((float(record["similarity"]), bool(record["equivalent"])))
    return pairs


def stats_at(pairs: list[tuple[float, bool]], threshold: float) -> ThresholdStats:
    tp = sum(1 for score, equivalent in pairs if score >= threshold and equivalent)
    fp = sum(1 for score, equivalent in pairs if score >= threshold and not equivalent)
    fn = sum(1 for score, equivalent in pairs if score < threshold and equivalent)
    tn = sum(1 for score, equivalent in pairs if score < threshold and not equivalent)
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    false_positive_rate = fp / (fp + tn) if fp + tn else 0.0
    return ThresholdStats(threshold, precision, recall, f1, false_positive_rate)


def sweep(pairs: list[tuple[float, bool]], low: float, high: float, step: float) -> list[ThresholdStats]:
    count = round((high - low) / step) + 1
    return [stats_at(pairs, round(low + i * step, 4)) for i in range(count)]


def choose_threshold(table: list[ThresholdStats], min_precision: float) -> ThresholdStats | None:
    """Highest-recall threshold that still meets the precision requirement (None if none does)."""
    candidates = [row for row in table if row.precision >= min_precision]
    return max(candidates, key=lambda row: (row.recall, -row.threshold), default=None)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pairs", type=Path)
    parser.add_argument("--min-precision", type=float, default=0.9)
    parser.add_argument("--low", type=float, default=0.70)
    parser.add_argument("--high", type=float, default=0.95)
    parser.add_argument("--step", type=float, default=0.01)
    args = parser.parse_args()

    table = sweep(load_pairs(args.pairs), args.low, args.high, args.step)
    print("threshold  precision  recall    F1   FPR")
    for row in table:
        print(f"  {row.threshold:.2f}       {row.precision:.2f}    {row.recall:.2f}  {row.f1:.2f}  {row.false_positive_rate:.2f}")
    chosen = choose_threshold(table, args.min_precision)
    if chosen is None:
        print(f"no threshold reaches precision {args.min_precision}")
    else:
        print(f"chosen threshold {chosen.threshold:.2f}: precision {chosen.precision:.2f}, recall {chosen.recall:.2f}")


if __name__ == "__main__":
    main()
