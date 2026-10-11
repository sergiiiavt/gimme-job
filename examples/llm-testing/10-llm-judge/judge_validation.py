"""Validate a judge against human labels: TPR, TNR and kappa with intervals, on development and test labels.

Chapter: LLM-as-a-judge (validating a judge against human labels)
https://gimme-job.com/learn/llm?topic=model-graded-evaluation

Usage:
    python judge_validation.py data/labels_dev.jsonl data/labels_test.jsonl
Each line holds {"id", "question", "answer", "human": "P" or "F", "judge_v1": ..., "judge_v2": ...}.
"""

import json
import math
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from statistics import NormalDist


def wilson(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    if n == 0:
        return 0.0, 1.0
    z = NormalDist().inv_cdf(1 - (1 - confidence) / 2)
    p = k / n
    denominator = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denominator
    half = z / denominator * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2))
    return (0.0 if k == 0 else center - half), (1.0 if k == n else center + half)


@dataclass(frozen=True)
class JudgeQuality:
    cases: int
    human_failures: int
    tpr: float
    tnr: float
    tpr_interval: tuple[float, float]
    tnr_interval: tuple[float, float]
    kappa: float
    accuracy: float
    missed_failures: int     # human FAIL, judge PASS: defects that slip through
    false_alarms: int        # human PASS, judge FAIL


def judge_quality(human: list[str], judge: list[str]) -> JudgeQuality:
    if len(human) != len(judge) or not human:
        raise ValueError("human labels and judge verdicts must cover the same, non-empty list of cases")
    pairs = Counter(zip(human, judge))
    passes, failures = human.count("P"), human.count("F")
    if not passes or not failures:
        raise ValueError("validation needs answers that people pass and answers that people fail")
    n = len(human)
    observed = (pairs[("P", "P")] + pairs[("F", "F")]) / n
    expected = (passes * judge.count("P") + failures * judge.count("F")) / n**2
    return JudgeQuality(
        cases=n,
        human_failures=failures,
        tpr=pairs[("P", "P")] / passes,
        tnr=pairs[("F", "F")] / failures,
        tpr_interval=wilson(pairs[("P", "P")], passes),
        tnr_interval=wilson(pairs[("F", "F")], failures),
        kappa=(observed - expected) / (1 - expected) if expected < 1 else 1.0,
        accuracy=observed,
        missed_failures=pairs[("F", "P")],
        false_alarms=pairs[("P", "F")],
    )


def load(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def report_line(name: str, quality: JudgeQuality) -> str:
    low, high = quality.tnr_interval
    return (f"{name:<15} TPR {quality.tpr:.2f}  TNR {quality.tnr:.2f} (95% CI {low:.2f}-{high:.2f})  "
            f"kappa {quality.kappa:.2f}  missed failures {quality.missed_failures} of {quality.human_failures}")


def main(argv: list[str]) -> int:
    dev, test = load(Path(argv[1])), load(Path(argv[2]))
    for name, rows, judge in [("judge v1, dev", dev, "judge_v1"), ("judge v2, dev", dev, "judge_v2"),
                              ("judge v2, test", test, "judge_v2")]:
        print(report_line(name, judge_quality([row["human"] for row in rows], [row[judge] for row in rows])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
