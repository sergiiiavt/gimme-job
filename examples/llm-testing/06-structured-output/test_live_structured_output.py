"""Optional live check of provider-native structured output plus the same validation pipeline.

Run with:  LLM_PROVIDER=openai|anthropic LLM_MODEL=<pinned model id> <PROVIDER>_API_KEY=... pytest -m live
Install the provider SDKs first:  uv sync --extra live  (or pip install openai anthropic)
"""

import os

import pytest

from pipeline import semantic_errors
from triage_contract import TicketTriage

pytestmark = pytest.mark.live
PROVIDER = os.environ.get("LLM_PROVIDER", "")
MODEL = os.environ.get("LLM_MODEL", "")
SYSTEM = "Classify the customer message for the support team. Use null for unknown values."
MESSAGE = "Hi, I want to return my order A-1042, the shoes are too small."


def native_structured_triage(message: str) -> TicketTriage | None:
    if PROVIDER == "openai":
        openai = pytest.importorskip("openai")
        response = openai.OpenAI().responses.parse(
            model=MODEL,
            input=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": message}],
            text_format=TicketTriage,
        )
        return response.output_parsed
    anthropic = pytest.importorskip("anthropic")
    response = anthropic.Anthropic().messages.parse(
        model=MODEL, max_tokens=500, system=SYSTEM,
        messages=[{"role": "user", "content": message}],
        output_format=TicketTriage,
    )
    return None if response.stop_reason in ("refusal", "max_tokens") else response.parsed_output


def test_native_structured_output_still_needs_semantic_validation():
    if PROVIDER not in {"openai", "anthropic"} or not MODEL:
        pytest.skip("set LLM_PROVIDER (openai or anthropic), LLM_MODEL and the provider API key")
    result = native_structured_triage(MESSAGE)
    assert result is not None, "refusal or truncation: the application must fall back"
    assert result.category == "returns"
    assert semantic_errors(result, MESSAGE) == []          # the schema cannot check this; code must
