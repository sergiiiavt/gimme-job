import pytest

from refund_oracles import check_refund_answer, probability_all_pass, runs_to_reveal_failure

GOOD = ("You can return unworn shoes within 30 days of delivery for a full refund. "
        "Start a return at https://stride.example/returns.")


def test_a_correct_answer_passes_every_property():
    assert check_refund_answer(GOOD) == []


@pytest.mark.parametrize(
    ("answer", "violation"),
    [
        (GOOD.replace("30 days", "two weeks"), "does not state the 30-day return window"),
        (GOOD + " Refunds are guaranteed.", "promises more than the policy allows"),
        (GOOD + " No questions asked!", "promises more than the policy allows"),
        (GOOD.replace("https://stride.example/returns", "our website"), "does not link to the returns page"),
    ],
)
def test_each_property_catches_its_defect(answer, violation):
    assert violation in check_refund_answer(answer)


def test_word_limit_boundary():
    base_words = len(GOOD.split())
    at_limit = GOOD + " ok" * (80 - base_words)
    over_limit = at_limit + " ok"
    assert len(at_limit.split()) == 80
    assert check_refund_answer(at_limit) == []
    assert check_refund_answer(over_limit) == ["longer than 80 words"]


def test_property_oracles_cannot_detect_a_wrong_reference_point():
    """Documented limitation: "30 days of purchase" passes every property but contradicts the
    policy ("30 days of delivery"). A reference-based or model-based oracle is needed for it."""
    wrong = GOOD.replace("of delivery", "of purchase")
    assert check_refund_answer(wrong) == []


@pytest.mark.parametrize(("failure_rate", "runs"), [(0.2, 14), (0.05, 59), (0.01, 299)])
def test_runs_needed_to_reveal_a_failure_with_95_percent_probability(failure_rate, runs):
    assert runs_to_reveal_failure(failure_rate) == runs


def test_a_flawed_feature_usually_survives_a_few_manual_checks():
    assert round(probability_all_pass(0.9, 5), 2) == 0.59
    assert round(probability_all_pass(0.7, 3), 2) == 0.34


@pytest.mark.parametrize("bad", [0.0, 1.0, -0.1, 1.5])
def test_invalid_failure_rates_are_rejected(bad):
    with pytest.raises(ValueError):
        runs_to_reveal_failure(bad)
