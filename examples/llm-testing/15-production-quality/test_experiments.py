import math
from statistics import NormalDist

import pytest
from hypothesis import given
from hypothesis import strategies as st

from experiments import (RULES, assign, bonferroni_looks, daily_peeking, decision_rates, main, msprt_ratio,
                         once_at_the_end, sample_ratio_p_value, sequential_msprt, two_proportion_p_value)

# 14 days with 100 users per arm and day, as in the chapter, repeated 2,000 times
DESIGN = {"experiments": 2000, "days": 14, "users_per_day": 100}


def test_daily_peeking_turns_a_5_percent_test_into_about_20_percent_false_alarms():
    once, _ = decision_rates(once_at_the_end, rate_a=0.6, rate_b=0.6, seed=1, **DESIGN)
    daily, _ = decision_rates(daily_peeking, rate_a=0.6, rate_b=0.6, seed=1, **DESIGN)
    assert 0.03 < once < 0.07
    assert daily > 0.15


@pytest.mark.parametrize("rule", [bonferroni_looks, sequential_msprt])
def test_corrected_daily_looks_keep_false_alarms_below_5_percent(rule):
    false_alarms, _ = decision_rates(rule, rate_a=0.6, rate_b=0.6, seed=1, **DESIGN)
    assert false_alarms <= 0.05


def test_with_a_real_effect_the_sequential_test_often_stops_early_and_pays_with_power():
    fixed, _ = decision_rates(once_at_the_end, rate_a=0.6, rate_b=0.66, seed=2, **DESIGN)
    sequential, mean_day = decision_rates(sequential_msprt, rate_a=0.6, rate_b=0.66, seed=2, **DESIGN)
    assert sequential > 0.55 and mean_day < 10
    assert fixed > sequential


def test_the_mixture_ratio_grows_with_evidence_and_shrinks_without_a_difference():
    assert msprt_ratio(600, 1000, 660, 1000) > msprt_ratio(60, 100, 66, 100)
    assert msprt_ratio(6000, 10_000, 6000, 10_000) < msprt_ratio(600, 1000, 600, 1000) < 1


def test_the_two_proportion_p_value_by_hand():
    pooled = 270 / 2000
    z = (150 / 1000 - 120 / 1000) / math.sqrt(pooled * (1 - pooled) * 2 / 1000)
    assert two_proportion_p_value(120, 1000, 150, 1000) == pytest.approx(2 * (1 - NormalDist().cdf(z)))


@given(st.integers(0, 1000), st.integers(0, 1000))
def test_the_two_proportion_p_value_ignores_the_order_of_the_arms(a, b):
    assert two_proportion_p_value(a, 1000, b, 1000) == pytest.approx(two_proportion_p_value(b, 1000, a, 1000))


def test_assignment_is_stable_balanced_and_independent_between_experiments():
    users = [f"user-{number}" for number in range(10_000)]
    style = [assign(user, "answer-style-2026-10") for user in users]
    assert style == [assign(user, "answer-style-2026-10") for user in users]
    assert sample_ratio_p_value(style.count("control"), style.count("treatment")) > 0.01
    retrieval = [assign(user, "retrieval-depth-2026-10") for user in users]
    agreement = sum(1 for a, b in zip(style, retrieval) if a == b) / len(users)
    assert agreement == pytest.approx(0.5, abs=0.03)


def test_a_sample_ratio_mismatch_is_detected():
    assert sample_ratio_p_value(5000, 5000) == pytest.approx(1.0)
    # 6% more users in one arm looks harmless and is not chance: the split or the logging is broken
    assert sample_ratio_p_value(5000, 5300) < 0.01


def test_the_report_compares_every_rule(capsys):
    assert main(["experiments.py", "--experiments", "200"]) == 0
    printed = capsys.readouterr().out
    assert all(name in printed for name in RULES)
