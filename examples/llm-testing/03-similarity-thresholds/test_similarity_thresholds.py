import math
import random
from pathlib import Path

import pytest
from hypothesis import assume, given, strategies as st

from ann import IvfIndex, random_unit_vectors, recall_at_k
from calibrate import choose_threshold, load_pairs, stats_at, sweep
from similarity import cosine, dot, euclidean, normalize

PAIRS = load_pairs(Path(__file__).parent / "data" / "labelled_pairs.jsonl")
vectors = st.lists(st.floats(min_value=-100, max_value=100), min_size=4, max_size=4)


# ---------------------------------------------------------------- similarity measures

@given(vectors, vectors)
def test_cosine_is_bounded(a, b):
    assume(math.sqrt(dot(a, a)) > 1e-6 and math.sqrt(dot(b, b)) > 1e-6)
    assert -1 - 1e-9 <= cosine(a, b) <= 1 + 1e-9


@given(vectors, vectors)
def test_for_unit_vectors_dot_equals_cosine_and_distance_follows(a, b):
    assume(math.sqrt(dot(a, a)) > 1e-3 and math.sqrt(dot(b, b)) > 1e-3)
    ua, ub = normalize(a), normalize(b)
    assert math.isclose(dot(ua, ub), cosine(a, b), abs_tol=1e-9)
    assert math.isclose(euclidean(ua, ub) ** 2, 2 - 2 * cosine(a, b), abs_tol=1e-9)


def test_dimension_mismatch_is_an_error():
    with pytest.raises(ValueError):
        dot([1.0, 2.0], [1.0])


# ---------------------------------------------------------------- threshold calibration

def test_calibration_data_has_hard_negatives_in_the_overlap_zone():
    negatives_above_080 = [score for score, equivalent in PAIRS if not equivalent and score >= 0.80]
    assert len(negatives_above_080) >= 5, "a calibration set needs same-topic, different-meaning pairs"


def test_no_threshold_separates_the_classes_perfectly():
    table = sweep(PAIRS, 0.70, 0.95, 0.01)
    assert not any(row.precision == 1.0 and row.recall == 1.0 for row in table)


def test_precision_requirement_selects_the_highest_recall_threshold():
    chosen = choose_threshold(sweep(PAIRS, 0.76, 0.90, 0.01), min_precision=0.9)
    assert chosen is not None
    assert chosen.threshold == 0.90
    assert round(chosen.recall, 2) == 0.42


def test_a_looser_requirement_trades_precision_for_recall():
    strict = stats_at(PAIRS, 0.90)
    loose = stats_at(PAIRS, 0.80)
    assert loose.recall > strict.recall
    assert loose.precision < strict.precision


# ---------------------------------------------------------------- approximate search

def test_index_recall_grows_with_the_number_of_probed_lists():
    rng = random.Random(3)
    docs = random_unit_vectors(400, 12, rng)
    queries = random_unit_vectors(15, 12, rng)
    index = IvfIndex(docs, n_lists=8, rng=rng)
    recalls = [recall_at_k(index, queries, k=10, nprobe=n) for n in [1, 2, 4, 8]]
    assert recalls == sorted(recalls)
    assert recalls[-1] == 1.0            # probing every list equals exact search
    assert recalls[0] < 0.8              # a single list misses true neighbours
