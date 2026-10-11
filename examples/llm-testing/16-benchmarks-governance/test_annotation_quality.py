import random

import pytest
from hypothesis import given
from hypothesis import strategies as st

from annotation_quality import confusions, gold_accuracy, krippendorff_alpha, reading

# Reliability data of Krippendorff (2011), example C: four observers, twelve units, missing values
N = None
EXAMPLE = [
    [1, 2, 3, 3, 2, 1, 4, 1, 2, N, N, N],
    [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, N, 3],
    [N, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, N],
    [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, N],
]
CHAPTER = {
    "ann": ["good", "good", "bad", "unsafe", "good", "bad", None, "good", "bad", "good", "unsafe", "good", "unsafe"],
    "ben": ["good", "bad", "bad", "unsafe", "good", "bad", "bad", "good", "bad", "good", "unsafe", None, "unsafe"],
    "cho": ["good", "good", "bad", "bad", "good", "bad", "bad", None, "bad", "good", "bad", "good", "bad"],
}


@pytest.mark.parametrize("metric, published", [("nominal", 0.743), ("ordinal", 0.815), ("interval", 0.849),
                                                ("ratio", 0.797)])
def test_the_published_values_of_krippendorff(metric, published):
    assert round(krippendorff_alpha(EXAMPLE, metric), 3) == published


def test_the_annotators_of_the_chapter():
    values = {group: round(krippendorff_alpha([CHAPTER[name] for name in group]), 2)
              for group in [("ann", "ben", "cho"), ("ann", "ben"), ("ann", "cho"), ("ben", "cho")]}
    assert values == {("ann", "ben", "cho"): 0.65, ("ann", "ben"): 0.87, ("ann", "cho"): 0.57, ("ben", "cho"): 0.40}
    assert confusions(CHAPTER["ann"], CHAPTER["cho"]) == {("unsafe", "bad"): 3}


def test_perfect_agreement_and_no_variation():
    assert krippendorff_alpha([["a", "b", "a"], ["a", "b", "a"]]) == 1.0
    with pytest.raises(ValueError, match="same value"):
        krippendorff_alpha([["a", "a"], ["a", "a"]])


def test_random_labels_give_alpha_near_zero():
    rng = random.Random(7)
    values = [krippendorff_alpha([[rng.choice("abc") for _ in range(60)] for _ in range(3)]) for _ in range(300)]
    assert abs(sum(values) / len(values)) < 0.03


LABELS = st.lists(st.tuples(st.sampled_from(["good", "bad", "unsafe", None]), st.sampled_from(["good", "bad", "unsafe", None]),
                            st.sampled_from(["good", "bad", "unsafe", None])), min_size=4, max_size=30)


def columns_of(rows):
    return [list(column) for column in zip(*rows)]


@given(LABELS)
def test_renaming_the_categories_does_not_change_nominal_alpha(rows):
    rename = {"good": "ok", "bad": "unsafe", "unsafe": "good", None: None}
    try:
        expected = krippendorff_alpha(columns_of(rows))
    except ValueError:
        return  # fewer than two pairable values, or no variation
    assert krippendorff_alpha(columns_of([[rename[value] for value in row] for row in rows])) == pytest.approx(expected)


@given(LABELS, st.sampled_from(["good", "bad", "unsafe"]))
def test_a_unit_labelled_by_one_annotator_does_not_count(rows, label):
    try:
        expected = krippendorff_alpha(columns_of(rows))
    except ValueError:
        return
    assert krippendorff_alpha(columns_of(rows + [(label, None, None)])) == pytest.approx(expected)


def test_gold_items_check_each_annotator():
    labels = ["good", "bad", None, "unsafe", "good", "bad", "good", "good"]
    gold = {0: "good", 1: "bad", 2: "bad", 3: "bad", 4: "good", 5: "bad"}
    correct, answered, lower = gold_accuracy(labels, gold)
    assert (correct, answered) == (4, 5)
    assert lower == pytest.approx(0.3755, abs=0.0005)  # Wilson lower bound of 4 of 5


def test_reading_of_alpha():
    assert [reading(value) for value in (0.85, 0.8, 0.7, 0.667, 0.6)] == [
        "reliable", "reliable", "tentative conclusions only", "tentative conclusions only", "do not use the labels yet"]
