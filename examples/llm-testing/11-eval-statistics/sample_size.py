"""Sample size and power for evaluation datasets.

Chapter: Statistics for evaluation (sample size and power)
https://gimme-job.com/learn/llm?topic=eval-statistics

Usage:
    python sample_size.py 50 200 1000
prints, for each dataset size, the precision of a pass rate and the smallest paired difference
the dataset detects with 80% power.
"""

import math
import sys
from statistics import NormalDist

from intervals import z_value


def cases_for_margin(margin: float, expected_rate: float = 0.5, confidence: float = 0.95) -> int:
    """Cases needed for an interval of about +/- margin around a pass rate."""
    return math.ceil(z_value(confidence) ** 2 * expected_rate * (1 - expected_rate) / margin**2)


def margin_for_cases(n: int, expected_rate: float = 0.5, confidence: float = 0.95) -> float:
    return z_value(confidence) * math.sqrt(expected_rate * (1 - expected_rate) / n)


def _z_values(alpha: float, power: float) -> tuple[float, float]:
    """Normal quantiles for a two-sided test at level alpha and for the requested power."""
    return NormalDist().inv_cdf(1 - alpha / 2), NormalDist().inv_cdf(power)


def _required(delta: float, discordant: float, alpha: float, power: float) -> float:
    z_alpha, z_beta = _z_values(alpha, power)
    return (z_alpha * math.sqrt(discordant) + z_beta * math.sqrt(discordant - delta**2)) ** 2 / delta**2


def cases_to_detect(p_a: float, p_b: float, discordant: float, alpha: float = 0.05,
                    power: float = 0.8) -> tuple[int, int]:
    """Cases to detect p_b - p_a: per version for two unrelated samples, and for a paired design
    (Connor, 1987), where discordant is the share of cases on which the versions disagree."""
    delta = abs(p_b - p_a)
    if not 0 < delta <= discordant <= 1:
        raise ValueError("need 0 < |p_b - p_a| <= discordant <= 1: the versions must disagree at least that often")
    z_alpha, z_beta = _z_values(alpha, power)
    unpaired = (z_alpha + z_beta) ** 2 * (p_a * (1 - p_a) + p_b * (1 - p_b)) / delta**2
    return math.ceil(unpaired), math.ceil(_required(delta, discordant, alpha, power))


def minimum_detectable_difference(n: int, discordant: float, alpha: float = 0.05, power: float = 0.8) -> float:
    """The smallest true difference that a paired comparison of n cases detects with the given power."""
    low, high = 1e-9, discordant
    if _required(high, discordant, alpha, power) > n:
        return math.inf  # not even the largest possible difference is detectable
    for _ in range(100):
        middle = (low + high) / 2
        if _required(middle, discordant, alpha, power) > n:
            low = middle
        else:
            high = middle
    return high


def main(argv: list[str]) -> int:
    print("cases   margin at 50%   margin at 90%   smallest detectable paired difference (10% discordant)")
    for n in (int(arg) for arg in argv[1:]):
        detectable = minimum_detectable_difference(n, 0.10)
        shown = "none" if math.isinf(detectable) else f"{detectable:.1%}"
        print(f"{n:>5}   {margin_for_cases(n):>12.1%}   {margin_for_cases(n, 0.9):>12.1%}   {shown:>10}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
