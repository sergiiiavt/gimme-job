import math
import random
from collections import Counter

import pytest
from hypothesis import given, strategies as st

from bpe import detokenize, tokenize, train_bpe
from needle import accuracy_by_cell, build_case, build_suite
from sampling import greedy, sample, softmax, top_k, top_p

TRAINING = {
    "return": 20, "returns": 12, "returned": 8, "refund": 15, "refunds": 9,
    "order": 25, "orders": 10, "ordered": 6, "delivery": 14, "delivered": 9,
    "shoes": 18, "size": 11,
}
MERGES = train_bpe(TRAINING, num_merges=30)
logit_lists = st.lists(st.floats(min_value=-20, max_value=20), min_size=2, max_size=12)


# ---------------------------------------------------------------- tokenization

def test_training_is_deterministic():
    assert train_bpe(TRAINING, 30) == MERGES


def test_unseen_words_are_built_from_known_pieces():
    assert tokenize("reorder", MERGES) == ["re", "order</w>"]


def test_text_outside_the_training_data_costs_more_tokens():
    english = tokenize("returned", MERGES)
    ukrainian = tokenize("повернення", MERGES)
    assert len(english) == 3
    assert len(ukrainian) == len("повернення") + 1        # one token per character plus the end marker


@given(st.text(alphabet="abcdefghijklmnopqrstuvwxyzповерн", min_size=1, max_size=20))
def test_tokenization_never_loses_or_invents_characters(word):
    assert detokenize(tokenize(word, MERGES)) == word


# ---------------------------------------------------------------- sampling

@given(logit_lists, st.floats(min_value=0.05, max_value=5))
def test_softmax_is_a_probability_distribution(logits, temperature):
    probs = softmax(logits, temperature)
    assert math.isclose(sum(probs), 1.0, rel_tol=1e-9)
    assert all(0.0 <= p <= 1.0 for p in probs)


@given(logit_lists)
def test_softmax_preserves_the_ranking_of_logits(logits):
    probs = softmax(logits)
    assert probs[greedy(logits)] == max(probs)


def test_lower_temperature_concentrates_probability_on_the_top_token():
    logits = [6.0, 4.6, 3.4, 2.6, 1.2]
    top = [softmax(logits, t)[0] for t in [1.5, 1.0, 0.7, 0.2]]
    assert top == sorted(top)
    assert round(softmax(logits, 0.2)[0], 3) == 0.999


def test_temperature_zero_is_rejected_in_favour_of_greedy():
    with pytest.raises(ValueError):
        softmax([1.0, 2.0], 0)
    assert greedy([1.0, 2.0, 0.5]) == 1


def test_top_k_keeps_exactly_k_tokens():
    probs = softmax([6.0, 4.6, 3.4, 2.6, 1.2])
    filtered = top_k(probs, 2)
    assert sum(1 for p in filtered if p > 0) == 2
    assert math.isclose(sum(filtered), 1.0)


@pytest.mark.parametrize(("p", "kept"), [(0.5, 1), (0.8, 3), (0.9, 3), (0.95, 4), (1.0, 5)])
def test_top_p_keeps_the_smallest_set_reaching_p(p, kept):
    probs = [0.50, 0.25, 0.15, 0.07, 0.03]
    assert sum(1 for q in top_p(probs, p) if q > 0) == kept


def test_sampling_frequencies_match_probabilities():
    tokens = ["30", "thirty", "14", "60", "unlimited"]
    probs = softmax([6.0, 4.6, 3.4, 2.6, 1.2])
    rng = random.Random(0)
    counts = Counter(sample(tokens, probs, rng) for _ in range(20000))
    for token, prob in zip(tokens, probs):
        assert abs(counts[token] / 20000 - prob) < 0.01


def test_floating_point_addition_is_not_associative():
    """The root cause of non-determinism at temperature 0: reduction order changes results."""
    assert (0.1 + 0.2) + 0.3 != 0.1 + (0.2 + 0.3)


# ---------------------------------------------------------------- long context

def test_needle_is_placed_at_the_requested_depth():
    rng = random.Random(1)
    for depth in [0.0, 0.5, 1.0]:
        case = build_case(depth, 200, rng)
        sentences = case["context"].split(". ")
        needle_index = next(i for i, s in enumerate(sentences) if case["expected"] in s)
        assert needle_index == case["position"] == round(depth * 200)


def test_report_shows_accuracy_per_length_and_depth():
    suite = build_suite(lengths=[200, 2000], depths=[0.0, 0.5, 1.0], repetitions=3)

    def loses_the_middle_of_long_contexts(case: dict) -> str:
        """Stand-in for a model with the 'lost in the middle' weakness."""
        if case["length"] > 1000 and case["depth"] == 0.5:
            return "I could not find a discount code."
        return f"The code is {case['expected']}."

    report = accuracy_by_cell(suite, loses_the_middle_of_long_contexts)
    assert report[(200, 0.5)] == 1.0
    assert report[(2000, 0.5)] == 0.0
    assert report[(2000, 1.0)] == 1.0
