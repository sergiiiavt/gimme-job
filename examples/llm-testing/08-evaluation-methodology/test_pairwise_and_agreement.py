import json
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from agreement import agreement, cohen_kappa, interpretation
from agreement import main as agreement_main
from pairwise import all_pairs, uncovered_pairs

HERE = Path(__file__).parent
DIMENSIONS = json.loads((HERE / "data" / "dimensions.json").read_text(encoding="utf-8"))
LABELS = [json.loads(line) for line in (HERE / "data" / "labels.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]

dimension_sets = st.dictionaries(
    st.sampled_from(["persona", "intent", "language", "difficulty", "channel"]),
    st.lists(st.sampled_from(["a", "b", "c", "d"]), min_size=1, max_size=4, unique=True),
    min_size=2, max_size=4,
)


# ---------------------------------------------------------------- pairwise selection

def test_nine_specs_cover_every_pair_of_the_chapter_dimensions():
    chosen = all_pairs(DIMENSIONS)
    assert len(chosen) == 9
    assert uncovered_pairs(DIMENSIONS, chosen) == set()


@settings(max_examples=60)
@given(dimension_sets)
def test_all_pairs_always_covers_every_pair_with_no_more_than_all_combinations(dimensions):
    chosen = all_pairs(dimensions)
    total = 1
    for values in dimensions.values():
        total *= len(values)
    assert uncovered_pairs(dimensions, chosen) == set()
    assert len(chosen) <= total
    sizes = sorted(len(values) for values in dimensions.values())
    assert len(chosen) >= sizes[-1] * sizes[-2], "every pair of the two largest dimensions needs its own case"


def test_removing_any_chosen_spec_leaves_a_pair_uncovered():
    chosen = all_pairs(DIMENSIONS)
    for index in range(len(chosen)):
        assert uncovered_pairs(DIMENSIONS, chosen[:index] + chosen[index + 1:]), index


# ---------------------------------------------------------------- agreement

def test_chapter_example():
    result = agreement(LABELS)
    assert (round(result.observed, 2), round(result.expected, 2), round(result.kappa, 2)) == (0.87, 0.82, 0.26)
    assert result.disagreements == ["a12", "a13", "a23", "a30"]


def test_kappa_is_one_for_identical_labels_and_zero_or_less_for_chance_agreement():
    labels = ["pass", "fail", "pass", "pass"]
    assert cohen_kappa(labels, labels)[2] == pytest.approx(1.0)
    assert cohen_kappa(["pass"] * 10, ["pass"] * 10)[2] == 1.0
    assert cohen_kappa(["pass", "fail"] * 5, ["fail", "pass"] * 5)[2] < 0


@given(st.lists(st.tuples(st.sampled_from(["pass", "fail"]), st.sampled_from(["pass", "fail"])), min_size=1, max_size=40))
def test_kappa_is_symmetric_and_bounded(pairs):
    first, second = [a for a, _ in pairs], [b for _, b in pairs]
    observed, expected, kappa = cohen_kappa(first, second)
    assert kappa == pytest.approx(cohen_kappa(second, first)[2])
    assert -1.0 <= kappa <= 1.0 and 0.0 <= expected <= 1.0 and 0.0 <= observed <= 1.0


def test_interpretation_scale():
    assert [interpretation(k) for k in (0.9, 0.7, 0.5, 0.3, 0.1, -0.2)] == [
        "almost perfect", "substantial", "moderate", "fair", "slight", "no better than chance"]


def test_command_line(capsys):
    assert agreement_main(["agreement.py", str(HERE / "data" / "labels.jsonl")]) == 0
    assert "kappa 0.26 (fair)" in capsys.readouterr().out
