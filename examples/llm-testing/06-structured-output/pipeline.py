"""extract -> parse -> normalize -> validate (schema) -> validate (semantics) -> repair -> fallback.

Chapter: Structured output and validation
https://gimme-job.com/learn/llm?topic=structured-output-validation
"""

import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field

from pydantic import ValidationError

from triage_contract import FALLBACK, TicketTriage

# A model is any callable taking (customer message, feedback from the previous attempt) -> raw text.
Model = Callable[[str, list[str]], str]
UKRAINIAN = re.compile(r"[а-яіїєґ]")


@dataclass
class TriageOutcome:
    result: TicketTriage
    attempts: int
    fell_back: bool
    events: list[str] = field(default_factory=list)      # what monitoring counts: repairs, fallbacks


def extract_json(text: str) -> str:
    """Models sometimes wrap JSON in prose or a Markdown fence: take the outermost object."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object found")
    return text[start:end + 1]


def normalize(data: dict) -> dict:
    """Repair harmless drift only: enum casing and surrounding whitespace."""
    fixed = dict(data)
    for key in ("category", "language"):
        if isinstance(fixed.get(key), str):
            fixed[key] = fixed[key].strip().lower()
    return fixed


def semantic_errors(triage: TicketTriage, message: str) -> list[str]:
    """Rules the schema cannot express: the output must agree with the input."""
    errors = []
    if triage.order_id is not None and triage.order_id not in message:
        errors.append(f"order_id {triage.order_id} does not appear in the message")
    expected_language = "uk" if UKRAINIAN.search(message.lower()) else "en"
    if triage.language != expected_language:
        errors.append(f"language should be {expected_language}")
    return errors


def parse_and_validate(raw: str, message: str) -> tuple[TicketTriage | None, list[str]]:
    try:
        data = json.loads(extract_json(raw))
    except ValueError as error:                             # json.JSONDecodeError is a ValueError
        return None, [f"not valid JSON: {error}"]
    if not isinstance(data, dict):
        return None, ["top-level value must be an object"]
    try:
        # strict: "2" is not an integer and true is not an integer in this contract
        triage = TicketTriage.model_validate(normalize(data), strict=True)
    except ValidationError as error:
        return None, [f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}" for item in error.errors()]
    errors = semantic_errors(triage, message)
    return (None, errors) if errors else (triage, [])


def triage(message: str, model: Model, max_attempts: int = 2) -> TriageOutcome:
    feedback: list[str] = []
    events: list[str] = []
    for attempt in range(1, max_attempts + 1):
        result, errors = parse_and_validate(model(message, feedback), message)
        if result is not None:
            return TriageOutcome(result, attempt, fell_back=False, events=events)
        events.append(f"invalid output on attempt {attempt}: {errors}")
        feedback = errors                                   # goes into the repair prompt
    events.append("fallback")
    return TriageOutcome(FALLBACK, max_attempts, fell_back=True, events=events)


def repair_prompt(errors: list[str]) -> str:
    return ("Your previous output was invalid. Errors: " + "; ".join(errors)
            + ". Return only the corrected JSON object with the same fields.")
