"""Classification metrics for LLM features that are classifiers in disguise:
ticket triage, intent detection, guardrails, the "needs a human" flag, a judge's PASS/FAIL.

Chapter: Code-based scorers and metrics (classification metrics)
https://gimme-job.com/learn/llm?topic=code-based-scorers

Usage:
    python classification.py data/triage_labels.jsonl
Each JSONL line holds {"id": ..., "message": ..., "human": <label>, "model": <label>}.
"""

import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ClassMetrics:
    precision: float
    recall: float
    f1: float
    support: int  # how many messages humans gave this label


@dataclass(frozen=True)
class Report:
    labels: tuple[str, ...]
    confusion: Counter  # (human label, model label) -> count
    per_class: dict[str, ClassMetrics]
    accuracy: float
    macro_f1: float
    weighted_f1: float


def classification_report(pairs: list[tuple[str, str]], labels: list[str] | None = None) -> Report:
    """Metrics for (human label, model label) pairs.

    Labels are listed in the given order, then in order of first appearance. A label that only the
    model uses (an invented class) gets its own column and counts in macro F1, so the error stays visible.
    """
    if not pairs:
        raise ValueError("no labelled pairs")
    order = list(dict.fromkeys([*(labels or []), *(human for human, _ in pairs), *(model for _, model in pairs)]))
    confusion = Counter(pairs)
    per_class = {}
    for label in order:
        tp = confusion[(label, label)]
        predicted = sum(confusion[(other, label)] for other in order)
        support = sum(confusion[(label, other)] for other in order)
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = ClassMetrics(precision, recall, f1, support)

    used = [label for label in order if any(label in pair for pair in confusion)]
    return Report(
        labels=tuple(order),
        confusion=confusion,
        per_class=per_class,
        accuracy=sum(confusion[(label, label)] for label in order) / len(pairs),
        macro_f1=sum(per_class[label].f1 for label in used) / len(used),
        weighted_f1=sum(metrics.f1 * metrics.support for metrics in per_class.values()) / len(pairs),
    )


def format_report(report: Report) -> list[str]:
    lines = ["human vs model" + "".join(f"{label:>11}" for label in report.labels)]
    for expected in report.labels:
        lines.append(f"{expected:<14}" + "".join(f"{report.confusion[(expected, predicted)]:>11}" for predicted in report.labels))
    for label, metrics in report.per_class.items():
        lines.append(f"{label:<10} precision={metrics.precision:.2f} recall={metrics.recall:.2f} "
                     f"F1={metrics.f1:.2f} support={metrics.support}")
    lines.append(f"accuracy={report.accuracy:.2f}  macro F1={report.macro_f1:.2f}  weighted F1={report.weighted_f1:.2f}")
    return lines


def load_pairs(path: Path) -> list[tuple[str, str]]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [(row["human"], row["model"]) for row in rows]


def main(argv: list[str]) -> int:
    for line in format_report(classification_report(load_pairs(Path(argv[1])))):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
