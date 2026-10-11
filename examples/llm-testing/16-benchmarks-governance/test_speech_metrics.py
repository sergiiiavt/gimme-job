import pytest
from hypothesis import given
from hypothesis import strategies as st

from speech_metrics import align, character_errors, normalize, rate_by_slice, word_errors


def levenshtein(a: list[str], b: list[str]) -> int:
    """An independent edit distance, row by row, for comparison."""
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        current = [i]
        for j, y in enumerate(b, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (x != y)))
        previous = current
    return previous[-1]


def test_the_example_of_the_chapter():
    errors = word_errors("refund my order four two one", "refund my border for two one please")
    assert (errors.substitutions, errors.deletions, errors.insertions) == (2, 0, 1)
    assert errors.rate == 0.5


def test_edge_cases():
    assert word_errors("check my order", "check my order").rate == 0
    assert word_errors("check my order", "").rate == 1.0  # three deletions
    assert word_errors("hi", "hi there how are you").rate == 4.0  # insertions can push the rate above 1
    with pytest.raises(ValueError):
        _ = word_errors("", "anything").rate


def test_case_and_punctuation_are_not_errors():
    assert normalize("  Refund, my ORDER!  ") == "refund my order"
    assert word_errors("Refund my order.", "refund my order").total == 0


def test_character_errors_for_ocr():
    errors = character_errors("invoice 2041", "inv0ice 2O41")
    assert (errors.substitutions, errors.total) == (2, 2)


WORDS = st.lists(st.sampled_from(["refund", "my", "order", "four", "for", "two", "one", "please"]), max_size=10)


@given(WORDS, WORDS)
def test_the_alignment_finds_the_minimum_number_of_edits(reference, hypothesis):
    errors = align(reference, hypothesis)
    assert errors.total == levenshtein(reference, hypothesis)
    # every reference word is matched, substituted or deleted; every recognized word matched, substituted or inserted
    matched = len(reference) - errors.substitutions - errors.deletions
    assert matched == len(hypothesis) - errors.substitutions - errors.insertions >= 0


def test_slices_pool_errors_instead_of_averaging_utterances():
    records = [
        {"slice": "accent-a", "reference": "yes please", "recognized": "yes peas"},  # 1 error in 2 words
        {"slice": "accent-a", "reference": " ".join(["word"] * 20), "recognized": " ".join(["word"] * 19 + ["ward"])},
        {"slice": "accent-b", "reference": "cancel my order", "recognized": "cancel my order"},
    ]
    rates = rate_by_slice(records)
    assert rates == {"accent-a": pytest.approx(2 / 22), "accent-b": 0.0}
    averaged = (0.5 + 0.05) / 2
    assert averaged > 3 * rates["accent-a"]  # the short utterance would dominate an average of rates
