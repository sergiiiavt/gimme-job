"""Optional live checks against a real provider.

Run with:  LLM_PROVIDER=openai LLM_MODEL=<pinned model id> OPENAI_API_KEY=... pytest -m live
       or  LLM_PROVIDER=anthropic LLM_MODEL=<pinned model id> ANTHROPIC_API_KEY=... pytest -m live
Install the provider SDKs first:  uv sync --extra live  (or pip install openai anthropic)
"""

import os

import pytest

from model_client import ModelResponse, next_action, normalize_stop_reason

pytestmark = pytest.mark.live
PROVIDER = os.environ.get("LLM_PROVIDER", "")
MODEL = os.environ.get("LLM_MODEL", "")


@pytest.fixture
def call_model():
    if PROVIDER not in {"openai", "anthropic"} or not MODEL:
        pytest.skip("set LLM_PROVIDER (openai or anthropic), LLM_MODEL and the provider API key")
    if PROVIDER == "openai":
        openai = pytest.importorskip("openai")
        client = openai.OpenAI()

        def call(prompt: str, max_tokens: int) -> ModelResponse:
            response = client.chat.completions.create(
                model=MODEL, messages=[{"role": "user", "content": prompt}], max_completion_tokens=max_tokens)
            choice = response.choices[0]
            return ModelResponse(choice.message.content or "", normalize_stop_reason("openai", choice.finish_reason),
                                 response.usage.prompt_tokens, response.usage.completion_tokens)
        return call

    anthropic = pytest.importorskip("anthropic")
    client = anthropic.Anthropic()

    def call(prompt: str, max_tokens: int) -> ModelResponse:
        message = client.messages.create(
            model=MODEL, max_tokens=max_tokens, messages=[{"role": "user", "content": prompt}])
        text = "".join(block.text for block in message.content if block.type == "text")
        return ModelResponse(text, normalize_stop_reason("anthropic", message.stop_reason),
                             message.usage.input_tokens, message.usage.output_tokens)
    return call


def test_a_short_answer_ends_normally_and_reports_usage(call_model):
    response = call_model("Reply with the single word OK.", max_tokens=50)
    assert response.stop_reason == "end"
    assert next_action(response, max_tokens=50) == "deliver"
    assert response.input_tokens > 0 and response.output_tokens > 0


def test_a_tiny_output_limit_is_reported_as_truncation(call_model):
    response = call_model("List twenty shoe brands, one per line.", max_tokens=8)
    assert response.stop_reason == "max_tokens"
    assert next_action(response, max_tokens=8) == "retry_with_larger_limit"
