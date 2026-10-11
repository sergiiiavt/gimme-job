"""Provider-neutral handling of model responses: stop reasons and the next action.

Chapter: LLM application anatomy and APIs
https://gimme-job.com/learn/llm?topic=llm-application-anatomy
"""

from dataclasses import dataclass, field

# One vocabulary for the whole application, whatever the provider calls it.
OPENAI_FINISH_REASONS = {
    "stop": "end",
    "length": "max_tokens",
    "tool_calls": "tool_use",
    "content_filter": "blocked",
}
ANTHROPIC_STOP_REASONS = {
    "end_turn": "end",
    "stop_sequence": "end",
    "max_tokens": "max_tokens",
    "model_context_window_exceeded": "max_tokens",
    "tool_use": "tool_use",
    "refusal": "blocked",
    "pause_turn": "continue",
}


@dataclass
class ModelResponse:
    text: str
    stop_reason: str                                   # normalized value
    input_tokens: int = 0
    output_tokens: int = 0
    tool_calls: list[dict] = field(default_factory=list)


def normalize_stop_reason(provider: str, raw: str | None) -> str:
    table = {"openai": OPENAI_FINISH_REASONS, "anthropic": ANTHROPIC_STOP_REASONS}.get(provider)
    if table is None:
        raise ValueError(f"unknown provider {provider!r}")
    return table.get(raw or "", "unknown")


def next_action(response: ModelResponse, max_tokens: int, retry_limit: int = 4000) -> str:
    """Decide what the application does next. Every branch has a test."""
    if response.stop_reason == "end":
        return "deliver"
    if response.stop_reason == "tool_use":
        return "run_tools" if response.tool_calls else "fail_closed"
    if response.stop_reason == "max_tokens":
        return "retry_with_larger_limit" if max_tokens < retry_limit else "deliver_with_truncation_notice"
    if response.stop_reason == "blocked":
        return "show_refusal_template"
    if response.stop_reason == "continue":
        return "continue_turn"
    return "fail_closed"
