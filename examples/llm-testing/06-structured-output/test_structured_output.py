import json
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis_jsonschema import from_schema

from evaluate import evaluate, load
from pipeline import parse_and_validate, repair_prompt, triage
from triage_contract import FALLBACK, json_schema

HERE = Path(__file__).parent
MESSAGE = "Hi, I want to return my order A-1042, the shoes are too small."
GOOD = ('{"category": "returns", "priority": 2, "summary": "Wants to return shoes", '
        '"needs_human": false, "order_id": "A-1042", "language": "en"}')
FIXTURES = [json.loads(line) for line in (HERE / "fixtures" / "raw_outputs.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]


def scripted(*responses):
    """Fake model: returns the scripted raw outputs in order and records the feedback it got."""
    queue = list(responses)
    seen_feedback: list[list[str]] = []

    def model(message: str, feedback: list[str]) -> str:
        seen_feedback.append(list(feedback))
        return queue.pop(0)
    model.seen_feedback = seen_feedback
    return model


# ---------------------------------------------------------------- the validator, case by case

@pytest.mark.parametrize("fixture", FIXTURES, ids=[fixture["case"] for fixture in FIXTURES])
def test_recorded_raw_outputs(fixture):
    result, errors = parse_and_validate(fixture["raw"], MESSAGE)
    if fixture["expected"] == "accepted":
        assert result is not None and errors == []
    else:
        assert result is None and errors, f"{fixture['case']} must be rejected with a reason"


def test_rejections_explain_the_field_that_failed():
    _, errors = parse_and_validate(GOOD.replace('"priority": 2', '"priority": 7'), MESSAGE)
    assert any(error.startswith("priority:") for error in errors)


# ---------------------------------------------------------------- repair and fallback

def test_a_format_error_is_repaired_on_the_second_attempt():
    model = scripted(GOOD.replace('"priority": 2', '"priority": "2"'), GOOD)
    outcome = triage(MESSAGE, model)
    assert outcome.attempts == 2 and not outcome.fell_back
    assert model.seen_feedback[1], "the repair attempt must receive the validation errors"
    assert "priority" in repair_prompt(model.seen_feedback[1])


def test_repeated_semantic_errors_end_in_a_safe_visible_fallback():
    model = scripted(GOOD.replace("A-1042", "A-9999"), GOOD.replace("A-1042", "A-7777"))
    outcome = triage(MESSAGE, model)
    assert outcome.fell_back and outcome.result == FALLBACK
    assert outcome.result.needs_human, "the fallback escalates instead of guessing"
    assert outcome.events[-1] == "fallback", "fallbacks are logged so monitoring can count them"


def test_attempts_are_bounded():
    model = scripted("not json", "still not json", "never reached")
    outcome = triage(MESSAGE, model, max_attempts=2)
    assert outcome.fell_back and len(model.seen_feedback) == 2


# ---------------------------------------------------------------- property-based: generated from the schema

@settings(max_examples=150, suppress_health_check=[HealthCheck.too_slow])
@given(from_schema(json_schema()))
def test_every_object_the_schema_allows_passes_schema_validation(obj):
    obj["order_id"] = None          # keep the semantic rules satisfied: no order id to verify
    obj["language"] = "en"          # and an English message
    result, errors = parse_and_validate(json.dumps(obj), message="Hello")
    assert errors == [] and result is not None


# ---------------------------------------------------------------- evaluation

def test_field_level_report_names_the_costly_errors():
    report = evaluate(load(HERE / "data" / "labelled_predictions.jsonl"))
    assert report.cases == 6
    assert round(report.field_accuracy["category"], 2) == 0.67
    assert report.exact_records == 2
    assert report.category_errors == {"technical -> account": 1, "billing -> returns": 1}
    assert report.missed_escalations == 1
    assert report.unnecessary_escalations == 0
