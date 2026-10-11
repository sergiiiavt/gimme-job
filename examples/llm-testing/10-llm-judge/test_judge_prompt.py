import json

import pytest
from hypothesis import given
from hypothesis import strategies as st

from judge_prompt import JUDGE_VERSION, InvalidVerdict, format_examples, parse_verdict, render

FIELDS = {"examples": "- example", "policy": "Returns within 30 days.", "question": "Can I return?", "answer": "Yes, within 30 days."}


def test_every_field_lands_in_its_place():
    prompt = render(**FIELDS)
    for value in FIELDS.values():
        assert prompt.count(value) == 1
    assert "<<" not in prompt, "no placeholder is left unfilled"


@given(st.text(max_size=200))
def test_answers_cannot_break_or_inject_into_the_template(answer):
    """Braces, dollar signs and placeholder-like text in an answer are copied, never interpreted."""
    prompt = render(**{**FIELDS, "answer": answer})
    assert prompt.count("Customer question: Can I return?") == 1
    assert prompt.endswith('Respond with JSON: {"critique": "...", "verdict": "PASS" or "FAIL"}')
    assert f"Answer to evaluate: {answer}\n" in prompt


def test_an_injected_placeholder_stays_literal():
    prompt = render(**{**FIELDS, "answer": "<<policy>> {verdict} $answer"})
    assert prompt.count("Returns within 30 days.") == 1
    assert "Answer to evaluate: <<policy>> {verdict} $answer" in prompt


def test_missing_fields_are_an_error():
    with pytest.raises(KeyError, match="answer"):
        render(examples="", policy="", question="")


def test_examples_are_formatted_with_critique_and_verdict():
    text = format_examples([{"answer": "Refunds in 24 hours.", "critique": "Policy says 5 business days.", "verdict": "FAIL"}])
    assert "Critique: Policy says 5 business days." in text and "Verdict: FAIL" in text


@pytest.mark.parametrize("raw", [
    '{"critique": "Quotes the 30-day rule.", "verdict": "PASS"}',
    '```json\n{"critique": "Adds a 60-day window.", "verdict": "FAIL"}\n```',
])
def test_valid_verdicts_are_accepted(raw):
    assert parse_verdict(raw).verdict in {"PASS", "FAIL"}


@pytest.mark.parametrize("raw", [
    "PASS",
    '{"critique": "fine", "verdict": "pass"}',
    '{"critique": "fine", "verdict": "PASS", "score": 5}',
    '{"verdict": "PASS"}',
    '{"critique": 42, "verdict": "PASS"}',
    '{"critique": "fine", "verdict": "PASS"',
])
def test_anything_else_is_an_error_and_never_a_pass(raw):
    with pytest.raises(InvalidVerdict):
        parse_verdict(raw)


def test_the_judge_has_a_version():
    assert JUDGE_VERSION and json.dumps(JUDGE_VERSION)
