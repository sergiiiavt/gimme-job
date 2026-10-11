from statistics import fmean

import pytest
from hypothesis import given
from hypothesis import strategies as st

from intervals import binomial_cdf, clopper_pearson, coverage, main, rule_of_three, wald, wilson

RATES = [i / 50 for i in range(1, 50)]
counts = st.integers(min_value=1, max_value=400).flatmap(
    lambda n: st.tuples(st.integers(min_value=0, max_value=n), st.just(n)))


def width(interval: tuple[float, float]) -> float:
    return interval[1] - interval[0]


# ---------------------------------------------------------------- values from the chapter and closed forms

def test_wilson_matches_the_chapter():
    assert wilson(42, 50) == pytest.approx((0.715, 0.917), abs=0.001)
    assert wilson(50, 50)[0] == pytest.approx(0.929, abs=0.001)


def test_clopper_pearson_matches_its_closed_form_at_the_edges():
    n = 10
    assert clopper_pearson(0, n) == pytest.approx((0.0, 1 - 0.025 ** (1 / n)))
    assert clopper_pearson(n, n) == pytest.approx((0.025 ** (1 / n), 1.0))


def test_wald_is_degenerate_exactly_where_good_llm_features_live():
    assert wald(50, 50) == (1.0, 1.0), "zero width: certainty claimed from 50 cases"
    assert wald(9, 10)[1] > 1 and wald(1, 30)[0] < 0


def test_rule_of_three_approximates_the_exact_bound_after_zero_failures():
    for n in (50, 100, 300, 1000):
        exact_one_sided = 1 - 0.05 ** (1 / n)
        assert rule_of_three(n) == pytest.approx(exact_one_sided, rel=0.04)


def test_binomial_cdf_handles_large_samples():
    assert binomial_cdf(4_900, 10_000, 0.5) == pytest.approx(0.0228, abs=0.001)


def test_invalid_counts_are_rejected():
    for k, n in [(3, 2), (-1, 5), (0, 0)]:
        with pytest.raises(ValueError):
            wilson(k, n)


# ---------------------------------------------------------------- exact coverage, no simulation noise

@pytest.mark.parametrize("n", [10, 30, 60])
def test_clopper_pearson_never_covers_less_than_promised(n):
    assert min(coverage(clopper_pearson, n, RATES)) >= 0.95


@pytest.mark.parametrize("n", [10, 30, 100])
def test_wilson_covers_close_to_95_percent_on_average(n):
    values = coverage(wilson, n, RATES)
    assert 0.94 <= fmean(values) <= 0.97
    assert min(values) >= 0.92


@pytest.mark.parametrize("n, worst", [(10, 0.2), (30, 0.5)])
def test_wald_coverage_collapses_near_the_edges(n, worst):
    assert min(coverage(wald, n, RATES)) < worst


# ---------------------------------------------------------------- properties

@given(counts)
def test_intervals_stay_in_range_and_contain_the_observed_rate(count):
    k, n = count
    for method in (wilson, clopper_pearson):
        low, high = method(k, n)
        assert 0.0 <= low <= k / n <= high <= 1.0


@given(counts)
def test_more_cases_with_the_same_rate_narrow_the_interval(count):
    k, n = count
    assert width(wilson(4 * k, 4 * n)) < width(wilson(k, n))


def test_the_exact_interval_is_conservative_in_coverage_not_always_wider():
    """Found by a property test: with 0 passes in 46 cases the exact interval is slightly narrower than Wilson."""
    assert width(clopper_pearson(0, 46)) < width(wilson(0, 46))
    assert min(coverage(clopper_pearson, 46, RATES)) >= 0.95


def test_command_line(capsys):
    assert main(["intervals.py", "50", "50"]) == 0
    out = capsys.readouterr().out
    assert "Wald             95% interval [100.0%, 100.0%]" in out
    assert "below about 6.0% (rule of three)" in out
