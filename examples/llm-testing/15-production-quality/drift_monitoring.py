"""Online monitoring: a control chart for the daily pass rate, a run rule for slow shifts, a drift
index for the mix of inputs, and stable sampling of conversations for the judges.

Chapter: Production quality (online evaluation and drift)
https://gimme-job.com/learn/llm?topic=production-quality

Usage:
    python drift_monitoring.py data/daily_checks.jsonl --baseline-days 10
Each JSONL line holds one day: {"day": 1, "judged": 200, "passed": 178, "languages": {"en": 2100, "uk": 900}}.
"""

import argparse
import hashlib
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from statistics import NormalDist


@dataclass(frozen=True)
class DayStatus:
    day: int
    rate: float
    low: float
    high: float
    alert: str | None


def control_limits(center: float, judged: int, sigmas: float = 3.0) -> tuple[float, float]:
    """Limits of a p-chart: the center rate plus and minus `sigmas` standard errors for this day's sample size."""
    half = sigmas * math.sqrt(center * (1 - center) / judged)
    return max(0.0, center - half), min(1.0, center + half)


def p_chart(days: list[dict], baseline_days: int, sigmas: float = 3.0,
            run_length: int = 8) -> tuple[float, list[DayStatus]]:
    """Center line from the first `baseline_days` days, then every day checked against its limits.
    Beyond the limits is a sudden change; `run_length` days in a row on one side of the center line
    is a small shift that no single day reveals (a Western Electric run rule)."""
    reference = days[:baseline_days]
    center = sum(day["passed"] for day in reference) / sum(day["judged"] for day in reference)
    statuses, side, run = [], 0, 0
    for day in days:
        rate = day["passed"] / day["judged"]
        low, high = control_limits(center, day["judged"], sigmas)
        current_side = (rate > center) - (rate < center)
        run = run + 1 if current_side == side and current_side != 0 else (1 if current_side != 0 else 0)
        side = current_side
        if rate < low:
            alert = "below the control limit"
        elif rate > high:
            alert = "above the control limit"
        elif run >= run_length:
            alert = f"{run} days in a row {'below' if side < 0 else 'above'} the center line"
        else:
            alert = None
        statuses.append(DayStatus(day["day"], rate, low, high, alert))
    return center, statuses


def detection_probability(center: float, drop: float, judged: int, sigmas: float = 3.0) -> float:
    """Chance that a single day falls below the lower limit when the true rate has dropped by `drop`
    (normal approximation)."""
    low, _ = control_limits(center, judged, sigmas)
    actual = center - drop
    return NormalDist(actual, math.sqrt(actual * (1 - actual) / judged)).cdf(low)


def population_stability_index(expected: dict[str, float], actual: dict[str, float], floor: float = 1e-4) -> float:
    """Sum over categories of (a - e) * ln(a / e), where e and a are the shares in the reference and the
    current period. A category missing from one period gets a small share instead of zero."""
    expected_total, actual_total = sum(expected.values()), sum(actual.values())
    index = 0.0
    for category in set(expected) | set(actual):
        e = max(expected.get(category, 0) / expected_total, floor)
        a = max(actual.get(category, 0) / actual_total, floor)
        index += (a - e) * math.log(a / e)
    return index


def psi_level(index: float) -> str:
    """A common rule of thumb, not a statistical test: below 0.1 stable, 0.1 to 0.25 moderate, above 0.25 major."""
    if index < 0.1:
        return "stable"
    return "moderate shift" if index < 0.25 else "major shift"


def in_judge_sample(conversation_id: str, rate: float, salt: str = "judge-sample-1") -> bool:
    """Stable random sampling: the same conversation is always in or out, whichever process asks, and
    a new salt draws a new sample."""
    digest = hashlib.sha256(f"{salt}:{conversation_id}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / 2**64 < rate


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Control chart and input drift for daily online checks.")
    parser.add_argument("days", type=Path)
    parser.add_argument("--baseline-days", type=int, default=10)
    args = parser.parse_args(argv[1:])

    days = [json.loads(line) for line in args.days.read_text(encoding="utf-8").splitlines() if line.strip()]
    center, statuses = p_chart(days, args.baseline_days)
    reference_mix: dict[str, int] = {}
    for day in days[:args.baseline_days]:
        for language, count in day["languages"].items():
            reference_mix[language] = reference_mix.get(language, 0) + count
    print(f"center line {center:.1%} from days 1 to {args.baseline_days}")
    print(f"{'day':>3} {'pass rate':>9} {'lower limit':>11}  {'language PSI':>12}  alert")
    alerts = 0
    for day, status in zip(days, statuses):
        index = population_stability_index(reference_mix, day["languages"])
        alerts += status.alert is not None
        print(f"{status.day:>3} {status.rate:>9.1%} {status.low:>11.1%}  {index:>12.3f}  "
              f"{status.alert or ''}{'' if index < 0.1 else ('; ' if status.alert else '') + 'input mix: ' + psi_level(index)}")
    return 1 if alerts else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
