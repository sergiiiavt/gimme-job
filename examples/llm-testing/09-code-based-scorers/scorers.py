"""Scorers for the answers of a support assistant.

Chapter: Code-based scorers and metrics
https://gimme-job.com/learn/llm?topic=code-based-scorers

Every scorer is a plain function (case, answer) -> Score with a reason, so each one can be
unit-tested on its own and reused from an evaluation framework that accepts custom code assertions.
The answer contract is checked first; content scorers run only on answers that satisfy it, so one
broken output produces one clear failure instead of six derived ones.
"""

import json
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from fact_scorer import check_facts

MAX_WORDS = 80
ALLOWED_LINK_HOSTS = frozenset({"shop.example"})
ALLOWED_EMAILS = frozenset({"support@shop.example"})
URL = re.compile(r"https?://[^\s<>\"')\]]+")
# Matching starts only where a run of address characters starts, and possessive quantifiers never
# give characters back, so a long output without spaces is scanned in linear time, not quadratic.
EMAIL = re.compile(r"(?<![\w.+-])[\w.+-]++@[\w-]++(?:\.[\w-]++)+")
CARD = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
PHONE = re.compile(r"\+\d[\d ()-]{8,}\d")
RUSSIAN_ONLY_LETTERS = frozenset("ыэъё")


@dataclass(frozen=True)
class Score:
    scorer: str
    passed: bool
    reason: str = ""


def parse_answer(raw: str) -> tuple[dict | None, Score]:
    """The answer contract: a JSON object with a non-empty string "answer" and a list of string "citations"."""
    def rejected(reason: str) -> tuple[None, Score]:
        return None, Score("contract", False, reason)

    try:
        data = json.loads(raw)
    except (ValueError, RecursionError) as error:  # deeply nested input exhausts the recursion limit
        return rejected(f"not JSON: {type(error).__name__}: {str(error)[:80]}")
    if not isinstance(data, dict):
        return rejected(f"expected a JSON object, got {type(data).__name__}")
    if set(data) != {"answer", "citations"}:
        return rejected(f"expected the fields answer and citations, got {sorted(data)}")
    if not isinstance(data["answer"], str) or not data["answer"].strip():
        return rejected("answer must be a non-empty string")
    if not isinstance(data["citations"], list) or not all(isinstance(doc, str) for doc in data["citations"]):
        return rejected("citations must be a list of strings")
    return data, Score("contract", True)


def answer_length(case: dict, answer: dict) -> Score:
    words = len(answer["answer"].split())
    return Score("length", words <= MAX_WORDS, f"{words} words, at most {MAX_WORDS} allowed")


def language(case: dict, answer: dict) -> Score:
    """Script share plus language-specific letters. A heuristic: a short Russian sentence without
    ы, э, ъ or ё passes as Ukrainian; a language-identification model is the stronger option."""
    text = URL.sub(" ", answer["answer"])
    letters = [ch for ch in text.lower() if ch.isalpha()]
    if not letters:
        return Score("language", False, "no letters to identify the language")
    cyrillic = sum("\u0400" <= ch <= "\u04ff" for ch in letters) / len(letters)
    if case["lang"] == "uk":
        russian = sorted(set(letters) & RUSSIAN_ONLY_LETTERS)
        if russian:
            return Score("language", False, f"expected Ukrainian, found the Russian letters {russian}")
        return Score("language", cyrillic >= 0.8, f"{cyrillic:.0%} of the letters are Cyrillic")
    latin = sum("a" <= ch <= "z" for ch in letters) / len(letters)
    return Score("language", latin >= 0.8, f"{latin:.0%} of the letters are Latin")


def facts(case: dict, answer: dict) -> Score:
    result = check_facts(answer["answer"], case["question"], case["must_state"], case["must_not_state"], case["sources"])
    return Score("facts", result.passed, "; ".join(result.failures))


def citations(case: dict, answer: dict) -> Score:
    if not answer["citations"]:
        return Score("citations", False, "no citation")
    unknown = [doc for doc in answer["citations"] if doc not in case["retrieved"]]
    return Score("citations", not unknown, f"cites documents that were not retrieved: {unknown}" if unknown else "")


def _allowed_link(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:  # for example "https://[" is not a valid URL at all
        return False
    return parts.scheme == "https" and parts.hostname in ALLOWED_LINK_HOSTS


def links(case: dict, answer: dict) -> Score:
    outside = [url for url in URL.findall(answer["answer"]) if not _allowed_link(url)]
    return Score("links", not outside, f"links outside the allow-list: {outside}" if outside else "")


def luhn_valid(number: str) -> bool:
    digits = [int(ch) for ch in number if ch.isdigit()]
    checksum = sum(digits[-1::-2]) + sum(sum(divmod(2 * digit, 10)) for digit in digits[-2::-2])
    return checksum % 10 == 0


def personal_data(case: dict, answer: dict) -> Score:
    text = answer["answer"]
    found = [f"e-mail {email}" for email in EMAIL.findall(text) if email.lower() not in ALLOWED_EMAILS]
    found += [f"card number {number}" for number in CARD.findall(text) if luhn_valid(number)]
    found += [f"phone number {number}" for number in PHONE.findall(text)]
    return Score("personal_data", not found, f"personal data in the answer: {found}" if found else "")


CONTENT_SCORERS = (answer_length, language, facts, citations, links, personal_data)


def score_answer(case: dict, raw: str) -> list[Score]:
    answer, contract = parse_answer(raw)
    if answer is None:
        return [contract]
    return [contract, *(scorer(case, answer) for scorer in CONTENT_SCORERS)]
