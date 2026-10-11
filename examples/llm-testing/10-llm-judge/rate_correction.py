"""Correct a pass rate measured by a judge for the judge's own errors (Rogan and Gladen, 1978), with a
bootstrap interval over both the labelled validation set and the judged answers.

Chapter: LLM-as-a-judge (correcting a measured pass rate)
https://gimme-job.com/learn/llm?topic=model-graded-evaluation

Usage:
    python rate_correction.py data/labels_test.jsonl data/production_verdicts.jsonl
"""

import json
import random
import sys
from pathlib import Path


def rogan_gladen(observed: float, tpr: float, tnr: float) -> float:
    """The true pass rate implied by the observed rate and the judge's error rates, clipped to [0, 1]."""
    if tpr + tnr <= 1:
        raise ValueError("the judge is no better than chance (TPR + TNR <= 1); its verdicts cannot be corrected")
    return min(1.0, max(0.0, (observed + tnr - 1) / (tpr + tnr - 1)))


def _error_rates(labelled: list[tuple[str, str]]) -> tuple[float, float]:
    on_passes = [judge for human, judge in labelled if human == "P"]
    on_failures = [judge for human, judge in labelled if human == "F"]
    if not on_passes or not on_failures:
        raise ValueError("the labelled set needs both passing and failing answers")
    return on_passes.count("P") / len(on_passes), on_failures.count("F") / len(on_failures)


def corrected_pass_rate(labelled: list[tuple[str, str]], verdicts: list[str], resamples: int = 2000,
                        seed: int = 0, confidence: float = 0.95) -> tuple[float, float, float]:
    """Point estimate and percentile bootstrap interval. Resamples where the judge is no better than
    chance cannot be corrected and are skipped; a large share of them means the labels are too few."""
    tpr, tnr = _error_rates(labelled)
    point = rogan_gladen(verdicts.count("P") / len(verdicts), tpr, tnr)
    rng = random.Random(seed)
    estimates = []
    for _ in range(resamples):
        labelled_sample = [rng.choice(labelled) for _ in labelled]
        verdict_sample = [rng.choice(verdicts) for _ in verdicts]
        try:
            sample_tpr, sample_tnr = _error_rates(labelled_sample)
            estimates.append(rogan_gladen(verdict_sample.count("P") / len(verdict_sample), sample_tpr, sample_tnr))
        except ValueError:
            continue
    estimates.sort()
    tail = (1 - confidence) / 2
    return point, estimates[int(tail * len(estimates))], estimates[int((1 - tail) * len(estimates)) - 1]


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main(argv: list[str]) -> int:
    labelled = [(row["human"], row["judge_v2"]) for row in _read_jsonl(Path(argv[1]))]
    verdicts = [row["judge"] for row in _read_jsonl(Path(argv[2]))]
    tpr, tnr = _error_rates(labelled)
    point, low, high = corrected_pass_rate(labelled, verdicts)
    print(f"judge verdicts: {verdicts.count('P')}/{len(verdicts)} pass ({verdicts.count('P') / len(verdicts):.1%})")
    print(f"judge quality on {len(labelled)} labelled answers: TPR {tpr:.2f}, TNR {tnr:.2f}")
    print(f"corrected pass rate {point:.1%}, 95% interval {low:.1%} to {high:.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
