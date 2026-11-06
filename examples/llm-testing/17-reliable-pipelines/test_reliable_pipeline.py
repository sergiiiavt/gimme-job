from dataclasses import replace
from datetime import date

import pytest

from reliable_pipeline import Fact, answer_policy, operation_message, zero_failure_upper_bound


TODAY = date(2026, 11, 6)
POLICY = Fact("returns", 3, "stride", "return_days", 30, date(2026, 1, 1), date(2027, 1, 1))


def proposal(**changes):
    return {"fact_id": "returns", "version": 3, "field": "return_days", "value": 30, **changes}


def run(raw, facts=(POLICY,), field="return_days", today=TODAY):
    return answer_policy("stride", field, today, facts, lambda _: raw)


def test_verified_value_is_rendered_from_the_registry_with_a_complete_trace():
    answer = run(proposal())
    assert answer.status == "answered"
    assert answer.text == "Return window: 30 days (policy returns, v3)."
    assert answer.trace == ("scope", "evidence", "proposal", "validate", "render")


@pytest.mark.parametrize("raw", [
    None, [], "Return window: 30 days", {},
    {"fact_id": "returns", "value": 30},
    proposal(value=True), proposal(value="30"), proposal(version=True),
    proposal(version="3"), proposal(fact_id=[]), proposal(field=None),
    proposal(text="We also pay return shipping."), proposal(judge_approved=True),
])
def test_malformed_or_extra_model_content_cannot_reach_the_published_answer(raw):
    answer = run(raw)
    assert answer.status == "abstained"
    assert answer.reason == "invalid_contract"
    assert "render" not in answer.trace


@pytest.mark.parametrize("changes", [
    {"value": 60}, {"value": -1}, {"version": 2}, {"fact_id": "invented"},
    {"field": "refund_days"},
])
def test_well_formed_but_unsupported_claims_are_blocked(changes):
    assert run(proposal(**changes)).reason == "unsupported_value"


@pytest.mark.parametrize("fact", [
    replace(POLICY, tenant="other-shop"),
    replace(POLICY, field="refund_days"),
    replace(POLICY, valid_until=TODAY),
    replace(POLICY, valid_from=date(2026, 11, 7)),
])
def test_wrong_scope_expired_and_future_evidence_are_not_sent_to_the_model(fact):
    def must_not_be_called(_):
        pytest.fail("model must not receive ineligible evidence")
    answer = answer_policy("stride", "return_days", TODAY, (fact,), must_not_be_called)
    assert answer.reason == "missing_evidence"


def test_conflicting_active_sources_require_resolution_before_generation():
    answer = run(proposal(), (POLICY, replace(POLICY, id="contradiction", value=60)))
    assert answer.reason == "conflicting_evidence"
    assert answer.trace == ("scope", "evidence")


def test_unanswerable_request_cannot_be_changed_to_an_answerable_field_by_the_model():
    assert run(proposal(), field="free_shipping").reason == "unsupported_field"
    assert run(proposal(), facts=()).reason == "missing_evidence"


def test_a_foreign_fact_reference_is_blocked_even_if_its_value_is_the_same():
    foreign = replace(POLICY, id="private", tenant="other-shop")
    assert run(proposal(fact_id="private"), (POLICY, foreign)).reason == "unsupported_value"


def test_only_authorized_evidence_reaches_generation():
    def propose(evidence):
        assert evidence == (POLICY,)
        return proposal()
    facts = (POLICY, replace(POLICY, tenant="other-shop", value=90))
    assert answer_policy("stride", "return_days", TODAY, facts, propose).status == "answered"


@pytest.mark.parametrize("error", [TimeoutError, ConnectionError])
def test_provider_failure_never_becomes_an_unverified_answer(error):
    def unavailable(_):
        raise error("provider failed")
    answer = answer_policy("stride", "return_days", TODAY, (POLICY,), unavailable)
    assert answer.reason == "provider_unavailable"
    assert "render" not in answer.trace


def test_faithfulness_to_a_bad_registry_does_not_prove_real_world_truth():
    # Deliberately incorrect fixture: this boundary cannot discover a source-owner mistake.
    bad_registry = (replace(POLICY, value=300),)
    answer = run(proposal(value=300), bad_registry)
    assert answer.status == "answered"
    assert "300 days" in answer.text


@pytest.mark.parametrize("status", ["approved", "submitted", "timeout", "unknown", "invented"])
def test_incomplete_or_unknown_operations_are_never_reported_as_success(status):
    assert "completed successfully" not in operation_message(status)


def test_success_and_failure_messages_follow_the_receipt():
    assert operation_message("succeeded") == "The operation completed successfully."
    assert operation_message("failed") == "The operation failed."


def test_zero_failures_still_have_a_nonzero_upper_risk_bound():
    upper = zero_failure_upper_bound(300)
    assert upper == pytest.approx(1 - 0.05 ** (1 / 300))
    assert upper == pytest.approx(0.009936, abs=0.000001)
    assert zero_failure_upper_bound(3000) < upper
    assert zero_failure_upper_bound(1) == pytest.approx(0.95)


@pytest.mark.parametrize("n, alpha", [(0, 0.05), (-1, 0.05), (True, 0.05), (1.5, 0.05), (10, 0), (10, 1)])
def test_statistical_bound_rejects_invalid_inputs(n, alpha):
    with pytest.raises(ValueError):
        zero_failure_upper_bound(n, alpha)
