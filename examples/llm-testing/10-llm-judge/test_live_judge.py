"""Optional live check: the same judge prompt and verdict contract on a real model.

Run with:  LLM_PROVIDER=openai|anthropic LLM_MODEL=<pinned model id> <PROVIDER>_API_KEY=... pytest -m live
Install the provider SDKs first:  uv sync --extra live  (or pip install openai anthropic)

This checks integration only: four answers are too few to validate a judge. Validation needs the
labelled sets and judge_validation.py.
"""

import os
from pathlib import Path

import pytest

from judge_prompt import format_examples, parse_verdict, render

pytestmark = pytest.mark.live
PROVIDER = os.environ.get("LLM_PROVIDER", "")
MODEL = os.environ.get("LLM_MODEL", "")
POLICY = (Path(__file__).parent / "data" / "policy.txt").read_text(encoding="utf-8").strip()
EXAMPLES = format_examples([
    {"answer": "Returns are accepted within 30 days of delivery.", "critique": "Matches the 30-day rule.", "verdict": "PASS"},
    {"answer": "Refunds arrive within 24 hours.", "critique": "The policy says 5 business days.", "verdict": "FAIL"},
])
CASES = [
    ("Can I return shoes after 40 days?", "No. Returns are accepted within 30 days of delivery, so 40 days is too late.", "PASS"),
    ("How long does standard delivery take?", "Standard delivery takes 3-5 business days.", "PASS"),
    ("Can I return shoes after 40 days?", "Yes, returns are accepted within 60 days of delivery.", "FAIL"),
    ("Can you guarantee delivery by Friday?", "Yes, we guarantee delivery by Friday.", "FAIL"),
]


def ask(prompt: str) -> str:
    if PROVIDER == "openai":
        openai = pytest.importorskip("openai")
        return openai.OpenAI().responses.create(model=MODEL, input=prompt).output_text
    anthropic = pytest.importorskip("anthropic")
    response = anthropic.Anthropic().messages.create(model=MODEL, max_tokens=800, temperature=0,
                                                     messages=[{"role": "user", "content": prompt}])
    return "".join(block.text for block in response.content if block.type == "text")


@pytest.mark.parametrize("question, answer, expected", CASES)
def test_live_judge_returns_valid_verdicts(question, answer, expected):
    if PROVIDER not in {"openai", "anthropic"} or not MODEL:
        pytest.skip("set LLM_PROVIDER (openai or anthropic), LLM_MODEL and the provider API key")
    verdict = parse_verdict(ask(render(examples=EXAMPLES, policy=POLICY, question=question, answer=answer)))
    assert verdict.verdict == expected, verdict.critique
