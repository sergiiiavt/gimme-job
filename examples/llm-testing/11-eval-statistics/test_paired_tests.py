import itertools
import json
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from intervals import binomial_pmf
from paired_tests import PairedCounts, mcnemar_exact, paired_bootstrap, paired_difference, unpaired_difference

HERE = Path(__file__).parent
ROWS = [json.loads(line) for line in (HERE / "data" / "results.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]


def results(version: str) -> dict[str, bool]:
    return {row["id"]: row["passed"][version] for row in ROWS}


def brute_force_mcnemar(only_a: int, only_b: int) -> float:
    """Share of all equally likely assignments of the discordant cases that split at least as unevenly."""
    m = only_a + only_b
    observed = abs(only_a - m / 2)
    outcomes = list(itertools.product([0, 1], repeat=m))
    return sum(abs(sum(outcome) - m / 2) >= observed for outcome in outcomes) / len(outcomes)


# ---------------------------------------------------------------- McNemar

@given(st.integers(0, 7), st.integers(0, 7))
def test_exact_mcnemar_matches_complete_enumeration(only_a, only_b):
    assert mcnemar_exact(only_a, only_b) == pytest.approx(brute_force_mcnemar(only_a, only_b))


@given(st.integers(0, 200), st.integers(0, 200))
def test_mcnemar_is_symmetric_and_bounded(only_a, only_b):
    p = mcnemar_exact(only_a, only_b)
    assert p == mcnemar_exact(only_b, only_a) and 0.0 < p <= 1.0
    if only_a == only_b:
        assert p == 1.0


def test_the_false_alarm_rate_of_the_exact_test_never_exceeds_five_percent():
    for discordant in range(1, 80):
        false_alarm = sum(binomial_pmf(b, discordant, 0.5) for b in range(discordant + 1)
                          if mcnemar_exact(b, discordant - b) <= 0.05)
        assert false_alarm <= 0.05 + 1e-12, discordant


# ---------------------------------------------------------------- the paired interval

def test_chapter_example_three_points_on_200_cases_is_noise():
    counts = PairedCounts(both=150, only_a=12, only_b=18, neither=20)
    diff, low, high = paired_difference(counts)
    assert diff == pytest.approx(0.03) and low < 0 < high
    assert mcnemar_exact(12, 18) == pytest.approx(0.362, abs=0.001)


def test_pairing_narrows_the_interval_on_recorded_results():
    counts = PairedCounts.from_results(results("A"), results("B"))
    _, low, high = paired_difference(counts)
    _, unpaired_low, unpaired_high = unpaired_difference(counts)
    assert high - low < 0.7 * (unpaired_high - unpaired_low)


def test_versions_that_ran_on_different_cases_cannot_be_paired():
    a, b = results("A"), results("B")
    del b["case-0001"]
    with pytest.raises(ValueError, match="different cases"):
        PairedCounts.from_results(a, b)


# ---------------------------------------------------------------- the paired bootstrap

def test_bootstrap_of_pass_fail_results_agrees_with_the_paired_formula():
    a, b = results("A"), results("B")
    ids = sorted(a)
    diff, low, high = paired_bootstrap([float(a[i]) for i in ids], [float(b[i]) for i in ids], resamples=1000, seed=1)
    _, formula_low, formula_high = paired_difference(PairedCounts.from_results(a, b))
    assert diff == pytest.approx(0.04)
    assert low == pytest.approx(formula_low, abs=0.005) and high == pytest.approx(formula_high, abs=0.005)


def test_bootstrap_is_reproducible_with_a_seed_and_contains_the_observed_difference():
    a = [3, 4, 4, 5, 2, 4, 3, 5, 4, 4]
    b = [4, 4, 5, 5, 3, 4, 4, 5, 4, 3]
    first = paired_bootstrap(a, b, resamples=500, seed=3)
    assert first == paired_bootstrap(a, b, resamples=500, seed=3)
    assert first[1] <= first[0] <= first[2]


def test_identical_versions_differ_by_exactly_zero():
    scores = [1.0, 2.0, 3.0, 4.0]
    assert paired_bootstrap(scores, list(scores), resamples=200) == (0.0, 0.0, 0.0)


def test_bootstrap_needs_the_same_cases_for_both_versions():
    with pytest.raises(ValueError):
        paired_bootstrap([1.0, 2.0], [1.0])
