import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from text_metrics import (corpus_bleu, exact_match, lcs_length, normalize_answer, rouge_l, rouge_n,
                          sentence_bleu, token_f1, tokenize)

REFERENCE_ANSWER = "30 days from delivery"
REFERENCE_SENTENCE = "unworn shoes can be returned within 30 days of delivery"
CANDIDATES = {
    "correct paraphrase": "you may send back shoes you have not worn for a month after they arrive",
    "wrong number": "unworn shoes can be returned within 60 days of delivery",
    "opposite meaning": "unworn shoes cannot be returned within 30 days of delivery",
}

# Random Unicode text finds crashes; text built from a small vocabulary produces real overlaps.
any_text = st.text(max_size=60)
vocabulary_text = st.lists(
    st.sampled_from(["the", "a", "30", "days", "from", "delivery", "returns", "днів", "доставки", "!", ",", "«", "»"]),
    max_size=12).map(" ".join)
texts = st.one_of(any_text, vocabulary_text)
ascii_text = st.text(alphabet=st.characters(min_codepoint=32, max_codepoint=126), max_size=60)


# ---------------------------------------------------------------- worked examples from the chapter

@pytest.mark.parametrize("prediction, em, f1", [
    ("30 days from delivery", 1.0, 1.0),
    ("The 30 days, from delivery!", 1.0, 1.0),
    ("Within 30 days of the delivery date", 0.0, 0.6),
    ("60 days from delivery", 0.0, 0.75),
    ("You have a month after the parcel arrives", 0.0, 0.0),
])
def test_exact_match_and_token_f1(prediction, em, f1):
    assert exact_match(prediction, REFERENCE_ANSWER) == em
    assert token_f1(prediction, REFERENCE_ANSWER) == pytest.approx(f1)


def test_token_overlap_rewards_wording_not_truth():
    wrong, correct = "60 days from delivery", "You have a month after the parcel arrives"
    assert token_f1(wrong, REFERENCE_ANSWER) > token_f1(correct, REFERENCE_ANSWER)


def test_n_gram_metrics_score_wrong_meanings_far_above_a_correct_paraphrase():
    paraphrase = CANDIDATES["correct paraphrase"]
    assert sentence_bleu(paraphrase, REFERENCE_SENTENCE) < 0.1
    assert rouge_l(paraphrase, REFERENCE_SENTENCE).f1 < 0.1
    for name in ["wrong number", "opposite meaning"]:
        assert sentence_bleu(CANDIDATES[name], REFERENCE_SENTENCE) > 0.65, name
        assert rouge_n(CANDIDATES[name], REFERENCE_SENTENCE, 1).recall == pytest.approx(0.9), name
        assert rouge_l(CANDIDATES[name], REFERENCE_SENTENCE).f1 == pytest.approx(0.9), name


def test_corpus_bleu_is_not_the_average_of_sentence_bleu():
    candidates = [REFERENCE_SENTENCE, "refunds take five days"]
    references = [REFERENCE_SENTENCE, "refunds go to the original payment method within 5 business days"]
    average = sum(sentence_bleu(c, r) for c, r in zip(candidates, references)) / len(candidates)
    assert abs(corpus_bleu(candidates, references) - average) > 0.03


def test_corpus_bleu_needs_one_reference_per_candidate():
    with pytest.raises(ValueError):
        corpus_bleu(["one", "two"], ["one"])


# ---------------------------------------------------------------- multilingual details

def test_unicode_punctuation_and_every_ukrainian_apostrophe_are_removed():
    assert normalize_answer("«30 днів» — від доставки!") == "30 днів від доставки"
    assert normalize_answer("п'ять") == normalize_answer("п\u2019ять") == normalize_answer("п\u02bcять") == "пять"


def test_tokenizer_keeps_ukrainian_words():
    # The default rouge-score tokenizer would keep only "30" here.
    assert tokenize("Повернення протягом 30 днів.") == ["повернення", "протягом", "30", "днів"]
    assert rouge_l("Повернення протягом 30 днів", "повернення протягом 30 днів").f1 == 1.0


# ---------------------------------------------------------------- edge cases

def test_empty_texts_never_produce_impossible_scores():
    # Without the guard, the brevity penalty exp(1 - r / c) of two empty texts is e = 2.718...
    assert sentence_bleu("", "") == 0.0
    assert corpus_bleu([""], [""]) == 0.0
    assert rouge_l("", "some reference").f1 == 0.0
    assert exact_match("", "") == token_f1("", "") == 1.0, "two empty answers match, as in the SQuAD script"
    assert token_f1("", "something") == 0.0


def test_lcs_on_long_outputs():
    words = ["refund"] * 500
    assert lcs_length(words, words) == 500
    assert lcs_length(words, ["refund", "x"] * 100) == 100


# ---------------------------------------------------------------- properties

@settings(max_examples=300)
@given(texts, texts)
def test_every_score_stays_between_zero_and_one(a, b):
    scores = [exact_match(a, b), token_f1(a, b), sentence_bleu(a, b), corpus_bleu([a], [b])]
    for prf in (rouge_n(a, b, 1), rouge_n(a, b, 2), rouge_l(a, b)):
        scores += [prf.precision, prf.recall, prf.f1]
    assert all(0.0 <= score <= 1.0 for score in scores), scores


@given(texts)
def test_identical_text_gets_the_maximum_score(text):
    assert exact_match(text, text) == token_f1(text, text) == 1.0
    if tokenize(text):
        assert sentence_bleu(text, text) == 1.0
        assert rouge_n(text, text, 1).f1 == rouge_l(text, text).f1 == 1.0
    if len(tokenize(text)) >= 2:
        assert rouge_n(text, text, 2).f1 == 1.0


@given(texts, texts)
def test_token_f1_is_symmetric(a, b):
    assert token_f1(a, b) == token_f1(b, a)


@given(texts, texts)
def test_exact_match_implies_full_token_f1(a, b):
    if exact_match(a, b) == 1.0:
        assert token_f1(a, b) == 1.0


@given(texts)
def test_normalization_is_idempotent(text):
    assert normalize_answer(normalize_answer(text)) == normalize_answer(text)


@given(ascii_text, ascii_text)
def test_scores_ignore_letter_case(a, b):
    assert token_f1(a.upper(), b) == token_f1(a, b)
    assert sentence_bleu(a.upper(), b) == sentence_bleu(a, b)
    assert rouge_l(a.upper(), b) == rouge_l(a, b)
