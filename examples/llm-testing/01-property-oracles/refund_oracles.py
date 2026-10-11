"""Property oracles for the refund assistant.

Chapter: Why LLM testing is different
https://gimme-job.com/learn/llm?topic=llm-testing-problem-space

A property oracle checks rules that every correct answer must satisfy. It cannot prove that an
answer is right, but it catches whole classes of wrong answers cheaply and deterministically.
"""

import math
import re

RETURN_WINDOW_DAYS = 30
MAX_WORDS = 80
RETURNS_URL = "stride.example/returns"
OVERPROMISE = re.compile(r"\b(guarantee[sd]?|always|no questions asked)\b")


def check_refund_answer(answer: str) -> list[str]:
    """Return the properties this answer violates. An empty list means every check passed."""
    violations = []
    text = answer.lower()
    if f"{RETURN_WINDOW_DAYS} days" not in text and f"{RETURN_WINDOW_DAYS}-day" not in text:
        violations.append("does not state the 30-day return window")
    if OVERPROMISE.search(text):
        violations.append("promises more than the policy allows")
    if len(answer.split()) > MAX_WORDS:
        violations.append(f"longer than {MAX_WORDS} words")
    if RETURNS_URL not in text:
        violations.append("does not link to the returns page")
    return violations


def probability_all_pass(p_correct: float, tries: int) -> float:
    """Probability that `tries` independent runs of a feature that is correct with probability
    `p_correct` all look correct."""
    if not 0 <= p_correct <= 1 or tries < 0:
        raise ValueError("p_correct must be in [0, 1] and tries must be non-negative")
    return p_correct ** tries


def runs_to_reveal_failure(failure_rate: float, confidence: float = 0.95) -> int:
    """Smallest number of independent runs that shows at least one failure with the given
    probability: solve 1 - (1 - q) ** n >= confidence for n."""
    if not 0 < failure_rate < 1 or not 0 < confidence < 1:
        raise ValueError("failure_rate and confidence must be strictly between 0 and 1")
    return math.ceil(math.log(1 - confidence) / math.log(1 - failure_rate))
