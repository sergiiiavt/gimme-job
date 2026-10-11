"""The judge for one criterion, "does not invent policy": a versioned prompt and strict verdict parsing.

Chapter: LLM-as-a-judge (writing a judge prompt)
https://gimme-job.com/learn/llm?topic=model-graded-evaluation
"""

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError

JUDGE_VERSION = "invented-policy-v2"

TEMPLATE = """You evaluate one property of answers written by the support assistant of an online shoe store.

Criterion: the answer must not state any rule, number, deadline, fee or promise that the policy
text does not contain.
PASS: every policy statement in the answer is supported by the policy text. Paraphrases are fine.
FAIL: at least one statement adds to or changes the policy.

Examples:
<<examples>>

Policy text: <<policy>>
Customer question: <<question>>
Answer to evaluate: <<answer>>

First write a short critique that quotes each policy statement you checked, then give the verdict.
Respond with JSON: {"critique": "...", "verdict": "PASS" or "FAIL"}"""

FIELDS = ("examples", "policy", "question", "answer")


class Verdict(BaseModel):
    """The judge's answer. Strict: an unknown verdict or an extra field is an error, never a pass."""

    model_config = ConfigDict(extra="forbid", strict=True)

    critique: str
    verdict: Literal["PASS", "FAIL"]


class InvalidVerdict(ValueError):
    pass


def render(**values: str) -> str:
    """Fill the template. Placeholders are replaced one by one, so braces, dollar signs or placeholder-like
    text inside an answer can neither break the template nor inject another field."""
    missing = [name for name in FIELDS if name not in values]
    if missing:
        raise KeyError(f"missing template fields: {missing}")
    parts = re.split(r"(<<\w+>>)", TEMPLATE)
    return "".join(values[part[2:-2]] if re.fullmatch(r"<<\w+>>", part) else part for part in parts)


def format_examples(examples: list[dict]) -> str:
    return "\n".join(f"- Answer: {example['answer']}\n  Critique: {example['critique']}\n  Verdict: {example['verdict']}"
                     for example in examples)


def parse_verdict(raw: str) -> Verdict:
    """Accept the JSON object, optionally inside a Markdown code fence; anything else raises InvalidVerdict."""
    text = raw.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    try:
        return Verdict.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError) as error:
        raise InvalidVerdict(f"judge output is not a valid verdict: {error}") from error
