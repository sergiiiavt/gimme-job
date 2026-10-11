"""Agreement between two people who labelled the same cases: raw agreement, Cohen's kappa, and the
cases they disagree on, which are the ones to discuss before labelling more.

Chapter: Evaluation methodology and datasets (labels and reference answers)
https://gimme-job.com/learn/llm?topic=evaluation-fundamentals

Usage:
    python agreement.py data/labels.jsonl
Each line holds {"case": ..., "reviewer_1": "pass" or "fail", "reviewer_2": "pass" or "fail"}.
"""

import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Agreement:
    cases: int
    observed: float
    expected: float
    kappa: float
    disagreements: list[str]


def cohen_kappa(first: list[str], second: list[str]) -> tuple[float, float, float]:
    """Observed agreement, agreement expected by chance, and Cohen's kappa."""
    if len(first) != len(second) or not first:
        raise ValueError("both reviewers must label the same, non-empty list of cases")
    n = len(first)
    observed = sum(a == b for a, b in zip(first, second)) / n
    counts_1, counts_2 = Counter(first), Counter(second)
    expected = sum(counts_1[label] * counts_2[label] for label in counts_1.keys() | counts_2.keys()) / n**2
    if expected == 1.0:
        return observed, expected, 1.0  # both used a single, identical label throughout
    return observed, expected, (observed - expected) / (1 - expected)


def agreement(rows: list[dict]) -> Agreement:
    first, second = [row["reviewer_1"] for row in rows], [row["reviewer_2"] for row in rows]
    observed, expected, kappa = cohen_kappa(first, second)
    return Agreement(len(rows), observed, expected, kappa, [row["case"] for row in rows if row["reviewer_1"] != row["reviewer_2"]])


def interpretation(kappa: float) -> str:
    """The conventional verbal scale (Landis and Koch); a rough guide, not a threshold for decisions."""
    for bound, label in [(0.8, "almost perfect"), (0.6, "substantial"), (0.4, "moderate"), (0.2, "fair"), (0.0, "slight")]:
        if kappa > bound:
            return label
    return "no better than chance"


def main(argv: list[str]) -> int:
    rows = [json.loads(line) for line in Path(argv[1]).read_text(encoding="utf-8").splitlines() if line.strip()]
    result = agreement(rows)
    print(f"{result.cases} cases: raw agreement {result.observed:.0%}, expected by chance {result.expected:.0%}, "
          f"kappa {result.kappa:.2f} ({interpretation(result.kappa)})")
    print(f"discuss these {len(result.disagreements)} cases first: {', '.join(result.disagreements)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
