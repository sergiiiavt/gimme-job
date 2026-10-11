"""Comparing two versions that ran on the same cases: McNemar's exact test, the paired interval for the
difference in pass rate, and the paired bootstrap for any metric.

Chapter: Statistics for evaluation (comparing two versions on the same cases; bootstrap intervals)
https://gimme-job.com/learn/llm?topic=eval-statistics
"""

import math
import random
from dataclasses import dataclass
from statistics import fmean

from intervals import z_value


@dataclass(frozen=True)
class PairedCounts:
    both: int      # both versions pass
    only_a: int    # only the baseline passes
    only_b: int    # only the candidate passes
    neither: int   # both fail

    @property
    def n(self) -> int:
        return self.both + self.only_a + self.only_b + self.neither

    @property
    def rate_a(self) -> float:
        return (self.both + self.only_a) / self.n

    @property
    def rate_b(self) -> float:
        return (self.both + self.only_b) / self.n

    @classmethod
    def from_results(cls, a: dict[str, bool], b: dict[str, bool]) -> "PairedCounts":
        """Pair the results case by case. Different case sets cannot be compared as pairs."""
        if a.keys() != b.keys():
            differing = sorted(a.keys() ^ b.keys())
            raise ValueError(f"the versions ran on different cases, for example {differing[:3]}")
        pairs = [(a[case], b[case]) for case in a]
        return cls(
            both=sum(x and y for x, y in pairs),
            only_a=sum(x and not y for x, y in pairs),
            only_b=sum(y and not x for x, y in pairs),
            neither=sum(not x and not y for x, y in pairs),
        )


def mcnemar_exact(only_a: int, only_b: int) -> float:
    """Two-sided exact McNemar test: if both versions are equally good, each discordant case is a fair coin flip."""
    n = only_a + only_b
    if n == 0:
        return 1.0
    tail = sum(math.comb(n, i) for i in range(min(only_a, only_b) + 1)) / 2**n
    return min(1.0, 2 * tail)


def paired_difference(counts: PairedCounts, confidence: float = 0.95) -> tuple[float, float, float]:
    """Difference in pass rate (B minus A) with an interval that uses the pairing."""
    n = counts.n
    diff = (counts.only_b - counts.only_a) / n
    se = math.sqrt(counts.only_a + counts.only_b - (counts.only_b - counts.only_a) ** 2 / n) / n
    half = z_value(confidence) * se
    return diff, diff - half, diff + half


def unpaired_difference(counts: PairedCounts, confidence: float = 0.95) -> tuple[float, float, float]:
    """The same difference analysed as two unrelated samples. Shown to demonstrate what pairing gains."""
    n, p_a, p_b = counts.n, counts.rate_a, counts.rate_b
    se = math.sqrt(p_a * (1 - p_a) / n + p_b * (1 - p_b) / n)
    half = z_value(confidence) * se
    return p_b - p_a, p_b - p_a - half, p_b - p_a + half


def paired_bootstrap(a: list[float], b: list[float], metric=fmean, resamples: int = 5000,
                     seed: int = 0, confidence: float = 0.95) -> tuple[float, float, float]:
    """Percentile interval for metric(b) - metric(a). Cases are resampled with replacement and each
    case keeps its pair of results, which preserves the benefit of pairing."""
    if len(a) != len(b) or not a:
        raise ValueError("both versions need results for the same, non-empty list of cases")
    rng = random.Random(seed)
    n = len(a)
    differences = []
    for _ in range(resamples):
        picked = [rng.randrange(n) for _ in range(n)]
        differences.append(metric([b[i] for i in picked]) - metric([a[i] for i in picked]))
    differences.sort()
    tail = (1 - confidence) / 2
    low = differences[int(tail * resamples)]
    high = differences[math.ceil((1 - tail) * resamples) - 1]
    return metric(b) - metric(a), low, high
