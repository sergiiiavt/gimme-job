"""Experiments with real users: stable assignment, a sample ratio check, the two-proportion test,
and why looking at the results every day needs a sequential test.

Chapter: Production quality (experiments with real users)
https://gimme-job.com/learn/llm?topic=production-quality

The sequential test is the mixture sequential probability ratio test (mSPRT) of Johari, Pekelis and
Walsh, "Always Valid Inference: Bringing Sequential Analysis to A/B Testing" (arXiv 1512.04922), with
a normal mixture and a normal approximation for rates. It may be checked after every user and still
keeps the chance of a false alarm below alpha.

Usage:
    python experiments.py --experiments 2000 --days 14 --users-per-day 100 --rate 0.6 --effect 0.06
"""

import argparse
import hashlib
import math
import random
import sys
from collections.abc import Callable

Looks = list[tuple[int, int, int, int]]  # after each day: successes A, users A, successes B, users B


def assign(user_id: str, experiment: str, arms: tuple[str, ...] = ("control", "treatment")) -> str:
    """The same user always gets the same arm of an experiment; different experiments split independently."""
    digest = hashlib.sha256(f"{experiment}:{user_id}".encode("utf-8")).digest()
    return arms[int.from_bytes(digest[:8], "big") % len(arms)]


def sample_ratio_p_value(users_a: int, users_b: int, share_a: float = 0.5) -> float:
    """Chi-square test (one degree of freedom) that the observed split matches the designed one. A
    tiny p-value means the assignment or the logging is broken, and the results cannot be trusted."""
    total = users_a + users_b
    expected_a, expected_b = total * share_a, total * (1 - share_a)
    chi_square = (users_a - expected_a) ** 2 / expected_a + (users_b - expected_b) ** 2 / expected_b
    return math.erfc(math.sqrt(chi_square / 2))


def two_proportion_p_value(successes_a: int, users_a: int, successes_b: int, users_b: int) -> float:
    """Two-sided p-value of the pooled z-test for a difference in rates."""
    pooled = (successes_a + successes_b) / (users_a + users_b)
    se = math.sqrt(pooled * (1 - pooled) * (1 / users_a + 1 / users_b))
    if se == 0:
        return 1.0
    z = (successes_b / users_b - successes_a / users_a) / se
    return math.erfc(abs(z) / math.sqrt(2))


def msprt_ratio(successes_a: int, users_a: int, successes_b: int, users_b: int, tau: float = 0.05) -> float:
    """Mixture likelihood ratio for the difference in rates, with a normal mixture of standard
    deviation tau over the true difference. Reject 'no difference' as soon as it reaches 1 / alpha."""
    rate_a, rate_b = successes_a / users_a, successes_b / users_b
    variance = rate_a * (1 - rate_a) / users_a + rate_b * (1 - rate_b) / users_b
    if variance == 0:
        return 1.0
    shrink = variance + tau ** 2
    return math.sqrt(variance / shrink) * math.exp(tau ** 2 * (rate_b - rate_a) ** 2 / (2 * variance * shrink))


def simulate_looks(rng: random.Random, days: int, users_per_day: int, rate_a: float, rate_b: float) -> Looks:
    looks, totals = [], [0, 0, 0, 0]
    for _ in range(days):
        totals = [totals[0] + rng.binomialvariate(users_per_day, rate_a), totals[1] + users_per_day,
                  totals[2] + rng.binomialvariate(users_per_day, rate_b), totals[3] + users_per_day]
        looks.append(tuple(totals))
    return looks


def once_at_the_end(looks: Looks, alpha: float = 0.05) -> int | None:
    """The fixed-horizon test: one analysis when the planned sample is complete."""
    return len(looks) if two_proportion_p_value(*looks[-1]) < alpha else None


def daily_peeking(looks: Looks, alpha: float = 0.05) -> int | None:
    """The common mistake: the fixed-horizon test every day, stopping at the first significant result."""
    return next((day for day, look in enumerate(looks, 1) if two_proportion_p_value(*look) < alpha), None)


def bonferroni_looks(looks: Looks, alpha: float = 0.05) -> int | None:
    """Daily looks, each at alpha divided by the number of planned looks: valid, but conservative."""
    return next((day for day, look in enumerate(looks, 1) if two_proportion_p_value(*look) < alpha / len(looks)), None)


def sequential_msprt(looks: Looks, alpha: float = 0.05, tau: float = 0.05) -> int | None:
    """Daily looks with the always-valid test: stop when the mixture ratio reaches 1 / alpha."""
    return next((day for day, look in enumerate(looks, 1) if msprt_ratio(*look, tau=tau) >= 1 / alpha), None)


def decision_rates(rule: Callable[[Looks], int | None], experiments: int, days: int, users_per_day: int,
                   rate_a: float, rate_b: float, seed: int = 0) -> tuple[float, float | None]:
    """Share of experiments that declare a difference, and the mean day on which they stop."""
    rng = random.Random(seed)
    stops = [rule(simulate_looks(rng, days, users_per_day, rate_a, rate_b)) for _ in range(experiments)]
    decided = [day for day in stops if day is not None]
    return len(decided) / experiments, (sum(decided) / len(decided) if decided else None)


RULES = {"once at the end": once_at_the_end, "daily peeking": daily_peeking, "daily, Bonferroni": bonferroni_looks,
         "daily, mSPRT": sequential_msprt}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Simulate experiments and compare stopping rules.")
    parser.add_argument("--experiments", type=int, default=2000)
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--users-per-day", type=int, default=100, help="per arm")
    parser.add_argument("--rate", type=float, default=0.60, help="success rate of the current version")
    parser.add_argument("--effect", type=float, default=0.06, help="true improvement of the new version")
    args = parser.parse_args(argv[1:])

    design = (args.experiments, args.days, args.users_per_day)
    print(f"{args.experiments} experiments of {args.days} days, {args.users_per_day} users per arm and day, "
          f"success rate {args.rate:.0%}")
    print(f"{'rule':<18} {'false alarms':>12} {'detects +' + format(args.effect * 100, 'g') + ' points':>18} "
          f"{'mean stop day':>14}")
    for name, rule in RULES.items():
        false_alarms, _ = decision_rates(rule, *design, args.rate, args.rate, seed=1)
        detected, mean_day = decision_rates(rule, *design, args.rate, args.rate + args.effect, seed=2)
        print(f"{name:<18} {false_alarms:>12.1%} {detected:>18.1%} {mean_day or float('nan'):>14.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
