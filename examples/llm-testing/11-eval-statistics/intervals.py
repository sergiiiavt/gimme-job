"""Confidence intervals for a pass rate: Wald, Wilson, Clopper-Pearson, and the rule of three.

Chapter: Statistics for evaluation (a pass rate is an estimate)
https://gimme-job.com/learn/llm?topic=eval-statistics

Usage:
    python intervals.py 42 50
"""

import math
import sys
from statistics import NormalDist


def z_value(confidence: float) -> float:
    """The two-sided normal quantile, 1.96 for 95%."""
    return NormalDist().inv_cdf(1 - (1 - confidence) / 2)


def _check(k: int, n: int) -> None:
    if n <= 0 or not 0 <= k <= n:
        raise ValueError(f"need 0 <= passed <= cases and at least one case, got {k}/{n}")


def wald(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """The normal approximation p +/- z * SE. Kept for comparison: unreliable for small n and rates near 0 or 1."""
    _check(k, n)
    p = k / n
    half = z_value(confidence) * math.sqrt(p * (1 - p) / n)
    return p - half, p + half


def wilson(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """Wilson score interval: inside [0, 1] and close to the promised coverage even for small n."""
    _check(k, n)
    z = z_value(confidence)
    p = k / n
    denominator = 1 + z**2 / n
    center = (p + z**2 / (2 * n)) / denominator
    half = z / denominator * math.sqrt(p * (1 - p) / n + z**2 / (4 * n**2))
    # The edges are exact in theory; floating-point rounding would leave 0 passes with a lower bound of 1e-18.
    low = 0.0 if k == 0 else max(0.0, center - half)
    high = 1.0 if k == n else min(1.0, center + half)
    return low, high


def binomial_pmf(k: int, n: int, p: float) -> float:
    """P(X = k) for X ~ Binomial(n, p), computed in log space so that large n does not underflow."""
    if p <= 0.0 or p >= 1.0:
        return float(k == (0 if p <= 0.0 else n))
    log_choose = math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)
    return math.exp(log_choose + k * math.log(p) + (n - k) * math.log1p(-p))


def binomial_cdf(k: int, n: int, p: float) -> float:
    """P(X <= k) for X ~ Binomial(n, p)."""
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    return min(1.0, math.fsum(binomial_pmf(i, n, p) for i in range(k + 1)))


def _root(increasing, steps: int = 60) -> float:
    """Root of an increasing function on [0, 1] by bisection."""
    low, high = 0.0, 1.0
    for _ in range(steps):
        middle = (low + high) / 2
        if increasing(middle) < 0:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def clopper_pearson(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """The exact interval: every rate under which the observed count is not too unlikely in either tail.
    Its coverage is never below the promised level, at the price of a wider interval."""
    _check(k, n)
    tail = (1 - confidence) / 2
    # P(X >= k) grows with the rate, P(X <= k) falls with it.
    low = 0.0 if k == 0 else _root(lambda rate: 1 - binomial_cdf(k - 1, n, rate) - tail)
    high = 1.0 if k == n else _root(lambda rate: tail - binomial_cdf(k, n, rate))
    return low, high


def rule_of_three(n: int) -> float:
    """Approximate 95% upper bound on the failure rate after n cases without a single failure."""
    return 3 / n


def coverage(method, n: int, true_rates: list[float], confidence: float = 0.95) -> list[float]:
    """Exact coverage for each true rate: the probability that the interval from n cases contains it.
    Computed by summing over every possible count, so no simulation noise is involved."""
    intervals = [method(k, n, confidence) for k in range(n + 1)]
    return [math.fsum(binomial_pmf(k, n, rate) for k, (low, high) in enumerate(intervals) if low <= rate <= high)
            for rate in true_rates]


def main(argv: list[str]) -> int:
    k, n = int(argv[1]), int(argv[2])
    print(f"{k}/{n} passed: observed pass rate {k / n:.1%}")
    for name, method in [("Wald", wald), ("Wilson", wilson), ("Clopper-Pearson", clopper_pearson)]:
        low, high = method(k, n)
        print(f"  {name:<16} 95% interval [{low:6.1%}, {high:6.1%}]")
    if k == n:
        print(f"  no failures: the failure rate is below about {rule_of_three(n):.1%} (rule of three)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
