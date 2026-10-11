import json
from pathlib import Path

import pytest

from fact_scorer import FACTS, check_facts
from harness import load_cases, read_jsonl
from validate_scorer import agreement, main

HERE = Path(__file__).parent
LABELLED_PATH = HERE / "data" / "labelled_answers.jsonl"
CASES = {case["id"]: case for case in load_cases()}
LABELLED = read_jsonl(LABELLED_PATH)

# Every fact pattern has wordings it must accept and near misses it must reject.
FACT_EXAMPLES = {
    "return-window-30-days": (
        ["within 30 days", "a 30-day window", "thirty days", "one month", "протягом 30 днів", "протягом місяця", "у вас є місяць"],
        ["within 60 days", "within 300 days", "3 days", "30 hours", "протягом 60 днів"]),
    "counted-from-delivery": (
        ["30 days from delivery", "after the parcel arrives", "from the day it was delivered", "з дня доставки", "від дати отримання"],
        ["30 days from the order date", "from purchase", "з дня замовлення"]),
    "unworn": (
        ["unworn items", "items that have not been worn", "never worn", "не ношені речі", "якщо ви не вдягали"],
        ["worn items", "gently worn", "ношені речі"]),
    "tags-attached": (
        ["with the tags attached", "the tag is still on", "з бирками", "з етикетками"],
        ["tagged in a photo", "on stage"]),
    "returns-page": (
        ["at https://shop.example/returns", "https://shop.example/returns."],
        ["https://shop.example/returnsx", "https://shop.example/returns".replace("https", "http"),  # without TLS
         "https://shop-example.com/returns"]),
    "refund-original-payment": (
        ["to your original payment method", "the card you paid with", "the account you used",
         "на той самий спосіб оплати", "на початковий спосіб оплати", "на картку, якою ви платили"],
        ["to a new card", "as store credit", "на іншу картку"]),
    "refund-5-business-days": (
        ["within 5 business days", "five working days", "протягом 5 робочих днів",
         "п'яти робочих днів", "п\u2019яти робочих днів", "п\u02bcяти робочих днів"],
        ["5-7 business days", "15 business days", "5 days", "протягом 7 робочих днів"]),
    "refund-after-return-received": (
        ["after we receive your return", "once your return arrives", "when the return reaches our warehouse",
         "після отримання повернення", "після того, як повернення надійде", "коли повернення надійде"],
        ["after you send the parcel", "after ordering", "після відправлення"]),
    "standard-delivery-3-5-days": (
        ["3-5 business days", "3 to 5 business days", "three to five working days", "3\u20135 business days",
         "3-5 робочих днів", "від 3 до 5 робочих днів", "від трьох до п'яти робочих днів"],
        ["2-3 business days", "3-7 business days", "13-5 business days", "5 business days", "3-5 days"]),
    "free-delivery-over-50": (
        ["free for orders over 50 EUR", "free delivery above €50", "free from 50 euros",
         "безкоштовна для замовлень понад 50 EUR", "від 50 євро"],
        ["over 500 EUR", "over 50 dollars", "always free", "понад 500 EUR"]),
    "tracking-page": (
        ["https://shop.example/track", "at https://shop.example/track."],
        ["https://shop.example/tracking", "https://shop.example.evil.test/track"]),
    "promises-exception": (
        ["we can make an exception", "no problem, we will accept it", "зробимо виняток", "без проблем"],
        ["exceptional quality", "виняткова якість"]),
    "guarantees-delivery-date": (
        ["we guarantee delivery by Friday", "guaranteed delivery", "гарантуємо доставку"],
        ["delivery is usually fast", "доставка зазвичай швидка"]),
    "asks-for-card-details": (
        ["please send your card number", "what is the CVV", "назвіть номер картки"],
        ["the card you paid with", "card payment"]),
}


def test_every_fact_has_accepted_and_rejected_examples():
    assert FACT_EXAMPLES.keys() == FACTS.keys(), "a new fact needs examples before it is trusted"


@pytest.mark.parametrize("fact_id", sorted(FACT_EXAMPLES))
def test_fact_patterns_accept_real_wordings_and_reject_near_misses(fact_id):
    accepted, rejected = FACT_EXAMPLES[fact_id]
    for text in accepted:
        assert FACTS[fact_id].found_in(text), f"{fact_id} must accept {text!r}"
    for text in rejected:
        assert not FACTS[fact_id].found_in(text), f"{fact_id} must reject {text!r}"


# ---------------------------------------------------------------- validation against human labels

def test_the_scorer_agrees_with_every_human_label():
    result = agreement(CASES, LABELLED)
    assert result.agreed == result.total == 20
    assert result.false_passes == {} and result.false_failures == {}


def test_the_naive_number_rule_rejects_good_answers_that_repeat_the_customer():
    result = agreement(CASES, LABELLED, allow_echoed_numbers=False)
    assert set(result.false_failures) == {"a01", "a02", "a07", "a15"}
    assert result.false_passes == {}, "the bug creates false regressions, not missed failures"
    assert all(reason.startswith("unsupported numbers") for reason in result.false_failures.values())


def test_the_labelled_set_covers_both_languages_and_both_verdicts():
    languages = {CASES[item["case"]]["lang"] for item in LABELLED}
    assert languages == {"en", "uk"}
    assert {item["human"] for item in LABELLED} == {True, False}


def test_validation_command_fails_when_the_scorer_disagrees(capsys):
    assert main(["validate_scorer.py", str(LABELLED_PATH)]) == 0
    assert "agrees with human labels on 20/20 answers" in capsys.readouterr().out
    assert main(["validate_scorer.py", str(LABELLED_PATH), "--naive"]) == 1
    assert "a07: unsupported numbers: 1042" in capsys.readouterr().out


# ---------------------------------------------------------------- the scorer, rule by rule

def check(case_id: str, answer: str, **options):
    case = CASES[case_id]
    return check_facts(answer, case["question"], case["must_state"], case["must_not_state"], case["sources"], **options)


def test_failures_name_every_problem():
    result = check("c01", "We can make an exception: returns within 60 days!")
    assert result.failures == (
        "missing: returns are accepted for 30 days",
        "missing: the return window starts at delivery",
        "forbidden: promises an exception to the policy",
        "unsupported numbers: 60",
    )


def test_numbers_must_come_from_the_retrieved_sources_or_the_question():
    good = "Order A-1042 is refunded to your original payment method within 5 business days after we receive your return."
    assert check("c03", good).passed
    invented = check("c03", good.replace("5 business days", "7 business days"))
    assert "unsupported numbers: 7" in invented.failures


def test_known_limit_a_pattern_cannot_read_negation():
    """Pinned on purpose: this correct answer is rejected. If such answers appear in real outputs,
    add them to the labelled set and refine the rule or move it to a model judge."""
    result = check("c05", "Standard delivery takes 3-5 business days; dates are estimates, not guarantees.")
    assert result.failures == ("forbidden: guarantees a delivery date",)


def test_unknown_fact_ids_fail_when_the_cases_load(tmp_path):
    case = dict(json.loads((HERE / "data" / "cases.jsonl").read_text(encoding="utf-8").splitlines()[0]))
    case["must_state"] = ["return-window-60-days"]
    (tmp_path / "cases.jsonl").write_text(json.dumps(case) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="unknown facts"):
        load_cases(tmp_path / "cases.jsonl")
