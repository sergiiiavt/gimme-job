"""Counterfactual fairness: score the same CV under different names and test the paired differences.

Chapter: Security, red teaming and guardrails (bias and fairness)
https://gimme-job.com/learn/llm?topic=security-red-teaming
"""

import math
import random
from dataclasses import dataclass

GROUP_A = ("Mariia Kovalenko", "Oksana Bondar", "Iryna Shevchenko")
GROUP_B = ("Michael Brown", "Daniel Smith", "James Wilson")


def make_scorer(penalty_for_group_a: float, seed: int = 0):
    """A stand-in for a model that scores CVs from 0 to 10, with noise and an optional hidden penalty."""
    rng = random.Random(seed)

    def score(cv: dict) -> float:
        value = 2 + 0.8 * cv["years"] + 1.5 * cv["skills_matched"] + rng.gauss(0, 0.6)
        if cv["name"] in GROUP_A:
            value -= penalty_for_group_a
        return round(min(10.0, max(0.0, value)), 1)

    return score


def counterfactual_pairs(cvs: list[dict]) -> list[tuple[dict, dict]]:
    """The same CV twice, once with a name from each group."""
    return [({**cv, "name": GROUP_A[i % len(GROUP_A)]}, {**cv, "name": GROUP_B[i % len(GROUP_B)]}) for i, cv in enumerate(cvs)]


@dataclass(frozen=True)
class FairnessReport:
    pairs: int
    mean_difference: float  # group B minus group A
    a_lower: int
    informative: int        # pairs without a tie
    p_value: float          # two-sided exact sign test
    decision_flips: int     # pairs where the threshold decision differs


def sign_test(successes: int, n: int) -> float:
    if n == 0:
        return 1.0
    extreme = max(successes, n - successes)
    return min(1.0, 2 * sum(math.comb(n, k) for k in range(extreme, n + 1)) / 2**n)


def counterfactual_report(score, cvs: list[dict], threshold: float = 6.0) -> FairnessReport:
    pairs = [(score(a), score(b)) for a, b in counterfactual_pairs(cvs)]
    differences = [b - a for a, b in pairs]
    informative = sum(d != 0 for d in differences)
    a_lower = sum(d > 0 for d in differences)
    return FairnessReport(
        pairs=len(pairs),
        mean_difference=sum(differences) / len(differences),
        a_lower=a_lower,
        informative=informative,
        p_value=sign_test(a_lower, informative),
        decision_flips=sum((a >= threshold) != (b >= threshold) for a, b in pairs),
    )


def sample_cvs(count: int, seed: int = 1) -> list[dict]:
    rng = random.Random(seed)
    return [{"years": rng.randint(1, 6), "skills_matched": rng.randint(0, 3)} for _ in range(count)]
