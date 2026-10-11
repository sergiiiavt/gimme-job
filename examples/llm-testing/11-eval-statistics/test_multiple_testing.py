import random

from hypothesis import given
from hypothesis import strategies as st

from multiple_testing import bonferroni, holm

p_value_sets = st.dictionaries(st.text(min_size=1, max_size=8), st.floats(min_value=0.0, max_value=1.0), min_size=1, max_size=20)


def test_chapter_example():
    p_values = {"lang=uk": 0.004, "feature=refunds": 0.03, "feature=delivery": 0.20, "lang=en": 0.45}
    assert holm(p_values) == {"lang=uk": True, "feature=refunds": False, "feature=delivery": False, "lang=en": False}


def test_holm_finds_more_than_bonferroni_when_several_effects_are_real():
    p_values = {"a": 0.010, "b": 0.015, "c": 0.020, "d": 0.300}
    assert sum(bonferroni(p_values).values()) == 1
    assert sum(holm(p_values).values()) == 3


@given(p_value_sets)
def test_holm_rejects_everything_bonferroni_rejects(p_values):
    by_holm, by_bonferroni = holm(p_values), bonferroni(p_values)
    assert list(by_holm) == list(p_values), "results keep the order of the input"
    assert all(by_holm[name] for name, rejected in by_bonferroni.items() if rejected)


@given(p_value_sets)
def test_nothing_is_significant_when_every_p_value_is_above_alpha(p_values):
    above = {name: max(p, 0.051) for name, p in p_values.items()}
    assert not any(holm(above).values())


def test_holm_keeps_false_alarms_near_five_percent_when_nothing_changed():
    rng = random.Random(12)
    trials, slices = 4000, 20
    corrected = uncorrected = 0
    for _ in range(trials):
        p_values = {f"slice-{i}": rng.random() for i in range(slices)}
        corrected += any(holm(p_values).values())
        uncorrected += any(p <= 0.05 for p in p_values.values())
    assert corrected / trials <= 0.06
    assert uncorrected / trials > 0.6
