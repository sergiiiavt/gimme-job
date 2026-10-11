"""Fact-based scorer: required facts, forbidden claims and unsupported numbers.

Chapter: Code-based scorers and metrics (fact-based scoring)
https://gimme-job.com/learn/llm?topic=code-based-scorers

A fact is recognised by a pattern of accepted wordings in English and Ukrainian. The patterns were
written from real answers, and data/labelled_answers.jsonl keeps such answers with human labels as
the scorer's regression test (see validate_scorer.py).

Known limits, kept visible on purpose:
- A forbidden pattern cannot tell "we guarantee" from "we cannot guarantee". When such answers
  appear, add them to the labelled set and refine the pattern, or move the check to a model judge.
- The number check sees digits only; "seven days" written in words is not checked.
"""

import re
from dataclasses import dataclass

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
APOSTROPHE = "['\u2019\u02bc]"  # Ukrainian text uses all three


@dataclass(frozen=True)
class Fact:
    description: str
    pattern: str

    def found_in(self, text: str) -> bool:
        return re.search(self.pattern, text, re.IGNORECASE) is not None


FACTS: dict[str, Fact] = {
    # returns policy
    "return-window-30-days": Fact(
        "returns are accepted for 30 days",
        r"\b(30|thirty)[- ]days?\b|\b(one|a) month\b|\b30 днів\b|\bмісяц(ь|я)\b"),
    "counted-from-delivery": Fact(
        "the return window starts at delivery",
        r"\bdeliver(y|ed)\b|\barriv(e|es|ed|al)\b|\bдоставк\w*|\bотриманн\w*"),
    "unworn": Fact(
        "only unworn items can be returned",
        r"\bunworn\b|\b(not|never) (been )?worn\b|\bне ношен\w*|\bне вдягал\w*"),
    "tags-attached": Fact(
        "the tags must be attached",
        r"\btags?\b|\bбирк\w*|\bетикетк\w*"),
    "returns-page": Fact(
        "links the returns page",
        r"https://shop\.example/returns\b"),
    # refunds policy
    "refund-original-payment": Fact(
        "refunds go to the original payment method",
        r"\boriginal payment method\b|\b(card|account) you (paid with|used)\b"
        r"|\b(той самий|той же|початковий) спосіб оплати\b|\bкартк\w*, якою ви (платили|оплачували)\b"),
    "refund-5-business-days": Fact(
        "refunds arrive within 5 business days",
        r"\b(5|five) (business|working) days?\b|\b(5|п" + APOSTROPHE + r"?яти) робочих днів\b"),
    "refund-after-return-received": Fact(
        "the 5 days start when the return reaches the warehouse",
        r"\b(after|once|when) (we receive|we have received|your return (arrives|reaches)|the return (arrives|reaches))\b"
        r"|\bпісля (отримання|того, як)\b|\bколи повернення надійде\b"),
    # delivery policy
    "standard-delivery-3-5-days": Fact(
        "standard delivery takes 3 to 5 business days",
        r"\b(3|three)\s*(-|\u2013|to)\s*(5|five) (business|working) days\b"
        r"|\b3\s*[-\u2013]\s*5 робочих днів\b|\bвід (3|трьох) до (5|п" + APOSTROPHE + r"?яти) робочих днів\b"),
    "free-delivery-over-50": Fact(
        "delivery is free for orders over 50 EUR",
        r"\b(over|above|from) (€\s?50|50\s?(eur|euros?))\b|\b(понад|від) 50\s?(eur|євро)\b"),
    "tracking-page": Fact(
        "links the tracking page",
        r"https://shop\.example/track\b"),
    # claims an answer must never make
    "promises-exception": Fact(
        "promises an exception to the policy",
        r"\bexception\b|\bno problem\b|\bвиняток\b|\bбез проблем\b"),
    "guarantees-delivery-date": Fact(
        "guarantees a delivery date",
        r"\bguarantee\w*|\bгарант\w*"),
    "asks-for-card-details": Fact(
        "asks for card details",
        r"\bcard number\b|\bcvv\b|\bcvc\b|\bномер картки\b"),
}


@dataclass(frozen=True)
class FactCheck:
    passed: bool
    failures: tuple[str, ...]


def numbers_in(text: str) -> set[str]:
    return set(NUMBER.findall(text))


def unknown_facts(fact_ids) -> list[str]:
    return sorted(set(fact_ids) - FACTS.keys())


def check_facts(answer: str, question: str, must_state, must_not_state, sources: list[str],
                allow_echoed_numbers: bool = True) -> FactCheck:
    """Every required fact present, no forbidden claim, and every number in the answer supported.

    A number is supported when it appears in a retrieved source or, unless allow_echoed_numbers is
    False, in the customer's question: good answers repeat the customer's own numbers ("40 days",
    "order A-1042"), and a scorer that forbids that reports a false failure on every such answer.
    """
    failures = [f"missing: {FACTS[fact].description}" for fact in must_state if not FACTS[fact].found_in(answer)]
    failures += [f"forbidden: {FACTS[fact].description}" for fact in must_not_state if FACTS[fact].found_in(answer)]

    supported = set().union(*(numbers_in(source) for source in sources))
    if allow_echoed_numbers:
        supported |= numbers_in(question)
    unsupported = sorted(numbers_in(answer) - supported, key=lambda number: float(number.replace(",", ".")))
    if unsupported:
        failures.append(f"unsupported numbers: {', '.join(unsupported)}")
    return FactCheck(not failures, tuple(failures))
