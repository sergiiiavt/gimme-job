"""Error analysis: turn coded trace reviews into a prioritized failure taxonomy and check saturation.

Chapter: Evaluation methodology and datasets (error analysis)
https://gimme-job.com/learn/llm?topic=evaluation-fundamentals

Usage:
    python error_analysis.py data/annotations.jsonl data/taxonomy.json
annotations.jsonl holds one reviewed trace per line: {"trace": ..., "note": ..., "category": ... or null}.
taxonomy.json maps every category to {"severity": 1-3, "description": ...}.
"""

import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CategoryStats:
    category: str
    traces: int
    severity: int
    priority: int  # traces x severity


@dataclass(frozen=True)
class ErrorAnalysis:
    reviewed: int
    with_problem: int
    categories: list[CategoryStats]   # highest priority first
    first_seen: list[int]             # position at which each category appeared for the first time
    traces_since_new_category: int    # a long tail without new categories suggests saturation
    problems: list[str]               # notes without a category, unknown categories


def analyse(annotations: list[dict], taxonomy: dict[str, dict]) -> ErrorAnalysis:
    problems = []
    for row in annotations:
        if row["category"] is None and row["note"]:
            problems.append(f"{row['trace']}: a note without a category, finish the axial coding")
        elif row["category"] is not None and row["category"] not in taxonomy:
            problems.append(f"{row['trace']}: unknown category {row['category']!r}, add it to the taxonomy or recode")

    counts = Counter(row["category"] for row in annotations if row["category"] in taxonomy)
    categories = sorted(
        (CategoryStats(name, count, taxonomy[name]["severity"], count * taxonomy[name]["severity"])
         for name, count in counts.items()),
        key=lambda stats: (-stats.priority, -stats.traces, stats.category),
    )

    seen, first_seen = set(), []
    for position, row in enumerate(annotations, 1):
        if row["category"] in taxonomy and row["category"] not in seen:
            seen.add(row["category"])
            first_seen.append(position)
    since_new = len(annotations) - (first_seen[-1] if first_seen else 0)
    return ErrorAnalysis(len(annotations), sum(counts.values()), categories, first_seen, since_new, problems)


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def main(argv: list[str]) -> int:
    result = analyse(read_jsonl(Path(argv[1])), json.loads(Path(argv[2]).read_text(encoding="utf-8")))
    print(f"{result.with_problem} of {result.reviewed} traces have a problem")
    print(f"{'category':<22} {'traces':>6} {'severity':>8} {'priority':>8}")
    for stats in result.categories:
        print(f"{stats.category:<22} {stats.traces:>6} {stats.severity:>8} {stats.priority:>8}")
    print(f"new categories appeared at traces {result.first_seen}; none in the last {result.traces_since_new_category}")
    for problem in result.problems:
        print("PROBLEM", problem)
    return 1 if result.problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
