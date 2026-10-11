"""Field-level accuracy of structured outputs against human labels.

Chapter: Structured output and validation (measuring field-level accuracy)
https://gimme-job.com/learn/llm?topic=structured-output-validation

Usage:
    python evaluate.py data/labelled_predictions.jsonl
Each JSONL line holds {"id": ..., "expected": {...}, "predicted": {...}}.
"""

import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

FIELDS = ("category", "priority", "needs_human", "order_id")


@dataclass(frozen=True)
class Report:
    cases: int
    field_accuracy: dict[str, float]
    exact_records: int
    category_errors: dict[str, int]
    missed_escalations: int
    unnecessary_escalations: int


def load(path: Path) -> list[tuple[dict, dict]]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [(row["expected"], row["predicted"]) for row in rows]


def evaluate(results: list[tuple[dict, dict]]) -> Report:
    accuracy = {name: sum(e[name] == p[name] for e, p in results) / len(results) for name in FIELDS}
    confusion = Counter(f"{e['category']} -> {p['category']}" for e, p in results if e["category"] != p["category"])
    return Report(
        cases=len(results),
        field_accuracy=accuracy,
        exact_records=sum(all(e[name] == p[name] for name in FIELDS) for e, p in results),
        category_errors=dict(confusion),
        missed_escalations=sum(e["needs_human"] and not p["needs_human"] for e, p in results),
        unnecessary_escalations=sum(p["needs_human"] and not e["needs_human"] for e, p in results),
    )


def main(argv: list[str]) -> int:
    report = evaluate(load(Path(argv[1])))
    for name, value in report.field_accuracy.items():
        print(f"{name:<12} accuracy {value:.0%}")
    print(f"whole record exactly right: {report.exact_records}/{report.cases}")
    print(f"category errors: {report.category_errors}")
    print(f"missed escalations: {report.missed_escalations}, unnecessary escalations: {report.unnecessary_escalations}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
