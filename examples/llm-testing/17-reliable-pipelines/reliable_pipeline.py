"""Offline, bounded answer publication. This is not a general hallucination detector.

The application owns the requested field, evidence, clock and final wording. The
untrusted model only proposes a value and evidence reference. Production adapters
must authenticate the caller and validate the source registry before this boundary.
"""

from dataclasses import dataclass
from datetime import date
from math import expm1, log
from typing import Callable


@dataclass(frozen=True)
class Fact:
    id: str
    version: int
    tenant: str
    field: str
    value: int
    valid_from: date
    valid_until: date


@dataclass(frozen=True)
class Answer:
    status: str
    reason: str
    text: str
    trace: tuple[str, ...]


LABELS = {"return_days": "Return window", "refund_days": "Refund processing time"}
PROPOSAL_KEYS = {"fact_id", "version", "field", "value"}


def abstain(reason: str, trace: tuple[str, ...]) -> Answer:
    return Answer("abstained", reason, "I cannot verify an answer from the current policy.", trace)


def valid_proposal(raw: object) -> bool:
    """Strict shape and types; Python's bool must not pass as an int."""
    return (
        type(raw) is dict
        and set(raw) == PROPOSAL_KEYS
        and type(raw["fact_id"]) is str
        and type(raw["field"]) is str
        and type(raw["version"]) is int
        and type(raw["value"]) is int
    )


def answer_policy(
    tenant: str,
    requested_field: str,
    today: date,
    facts: tuple[Fact, ...],
    propose: Callable[[tuple[Fact, ...]], object],
) -> Answer:
    """Publish only a matching registry value using an application-owned template.

    `tenant` comes from authentication and `requested_field` from a validated
    request. These are not taken from the proposal. Validity intervals are [from, until).
    The trusted registry supplies correctly typed, reviewed policy facts.
    """
    trace = ("scope",)
    if requested_field not in LABELS:
        return abstain("unsupported_field", trace)
    eligible = tuple(
        fact for fact in facts
        if fact.tenant == tenant and fact.field == requested_field
        and fact.valid_from <= today < fact.valid_until
    )
    trace += ("evidence",)
    if not eligible:
        return abstain("missing_evidence", trace)
    if len({fact.value for fact in eligible}) != 1:
        return abstain("conflicting_evidence", trace)
    trace += ("proposal",)
    try:
        raw = propose(eligible)
    except (TimeoutError, ConnectionError):
        return abstain("provider_unavailable", trace)
    trace += ("validate",)
    if not valid_proposal(raw):
        return abstain("invalid_contract", trace)
    fact = next((item for item in eligible if item.id == raw["fact_id"]
                 and item.version == raw["version"]), None)
    if fact is None or raw["field"] != requested_field or raw["value"] != fact.value:
        return abstain("unsupported_value", trace)
    # No generated text is appended after validation. Render from the registry.
    text = f"{LABELS[requested_field]}: {fact.value} days (policy {fact.id}, v{fact.version})."
    return Answer("answered", "verified_registry_value", text, trace + ("render",))


def operation_message(receipt_status: str) -> str:
    """Status is read from the authenticated provider/reconciliation adapter.

    An approval, submission or timeout is never described as completed work.
    This function formats receipts; it does not execute or authorize operations.
    """
    return {
        "approved": "Approved; the operation has not completed.",
        "submitted": "Submitted; completion is not yet confirmed.",
        "succeeded": "The operation completed successfully.",
        "failed": "The operation failed.",
    }.get(receipt_status, "The operation outcome is unknown; reconciliation is required.")


def zero_failure_upper_bound(n: int, alpha: float = 0.05) -> float:
    """Exact one-sided binomial bound after zero failures in n independent trials."""
    if type(n) is not int or n <= 0 or not 0 < alpha < 1:
        raise ValueError("require n > 0 and 0 < alpha < 1")
    return -expm1(log(alpha) / n)


def demo() -> None:
    facts = (Fact("returns", 3, "stride", "return_days", 30, date(2026, 1, 1), date(2027, 1, 1)),)
    for value in (30, 60):
        result = answer_policy(
            "stride", "return_days", date(2026, 11, 6), facts,
            lambda evidence: {"fact_id": evidence[0].id, "version": evidence[0].version,
                              "field": "return_days", "value": value},
        )
        print(result.status, result.reason, result.text)
    print(operation_message("timeout"))
    print(f"Zero failures in 300 trials: 95% upper bound {zero_failure_upper_bound(300):.2%}")


if __name__ == "__main__":
    demo()
