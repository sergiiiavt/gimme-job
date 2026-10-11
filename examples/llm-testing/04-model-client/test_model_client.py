import random
from pathlib import Path

import pytest

from cost import EXAMPLE_PRICES, cost_per_resolved_task, request_cost
from model_client import ModelResponse, next_action, normalize_stop_reason
from retry_policy import ApiError, FakeClock, RetryPolicy, call_with_retries
from streaming import assemble, load_events

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------- stop reasons

@pytest.mark.parametrize(
    ("provider", "raw", "normalized"),
    [
        ("openai", "stop", "end"),
        ("openai", "length", "max_tokens"),
        ("openai", "tool_calls", "tool_use"),
        ("openai", "content_filter", "blocked"),
        ("anthropic", "end_turn", "end"),
        ("anthropic", "stop_sequence", "end"),
        ("anthropic", "max_tokens", "max_tokens"),
        ("anthropic", "model_context_window_exceeded", "max_tokens"),
        ("anthropic", "tool_use", "tool_use"),
        ("anthropic", "refusal", "blocked"),
        ("anthropic", "pause_turn", "continue"),
        ("anthropic", "a_value_added_next_year", "unknown"),
        ("openai", None, "unknown"),
    ],
)
def test_provider_stop_reasons_map_to_one_vocabulary(provider, raw, normalized):
    assert normalize_stop_reason(provider, raw) == normalized


@pytest.mark.parametrize(
    ("response", "max_tokens", "action"),
    [
        (ModelResponse("Answer", "end"), 500, "deliver"),
        (ModelResponse("", "tool_use", tool_calls=[{"name": "get_order_status"}]), 500, "run_tools"),
        (ModelResponse("", "tool_use"), 500, "fail_closed"),
        (ModelResponse('{"answer": "You can re', "max_tokens"), 500, "retry_with_larger_limit"),
        (ModelResponse("Long answer...", "max_tokens"), 8000, "deliver_with_truncation_notice"),
        (ModelResponse("", "blocked"), 500, "show_refusal_template"),
        (ModelResponse("", "continue"), 500, "continue_turn"),
        (ModelResponse("", "unknown"), 500, "fail_closed"),
    ],
)
def test_every_stop_reason_has_a_defined_next_action(response, max_tokens, action):
    assert next_action(response, max_tokens) == action


# ---------------------------------------------------------------- retries

class ScriptedCall:
    """Fake model call: returns or raises the scripted outcomes in order."""
    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def __call__(self):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def run(*outcomes, policy=RetryPolicy()):
    call, clock = ScriptedCall(*outcomes), FakeClock()
    result = call_with_retries(call, policy, clock, random.Random(0))
    return result, call.calls, clock


def test_retries_rate_limits_and_server_errors_then_succeeds():
    result, calls, clock = run(ApiError(429, retry_after=2.0), ApiError(503), "ok")
    assert (result, calls) == ("ok", 3)
    assert clock.sleeps[0] == 2.0                      # Retry-After is honoured


@pytest.mark.parametrize("error", [ApiError(400), ApiError(401), ApiError(404), ApiError(429, code="insufficient_quota")])
def test_non_retryable_errors_fail_immediately(error):
    call, clock = ScriptedCall(error, "ok"), FakeClock()
    with pytest.raises(ApiError):
        call_with_retries(call, RetryPolicy(), clock, random.Random(0))
    assert call.calls == 1 and clock.sleeps == []


def test_attempts_are_bounded():
    call, clock = ScriptedCall(*[ApiError(503)] * 10), FakeClock()
    with pytest.raises(ApiError):
        call_with_retries(call, RetryPolicy(max_attempts=4), clock, random.Random(0))
    assert call.calls == 4


def test_total_waiting_time_respects_the_deadline():
    call, clock = ScriptedCall(ApiError(429, retry_after=60.0), "ok"), FakeClock()
    with pytest.raises(ApiError):
        call_with_retries(call, RetryPolicy(deadline=20.0), clock, random.Random(0))
    assert clock.sleeps == []


def test_backoff_is_jittered_and_capped():
    policy = RetryPolicy(base_delay=0.5, max_delay=8.0)
    rng = random.Random(1)
    delays = [policy.delay(ApiError(503), attempt, rng) for attempt in range(1, 10) for _ in range(20)]
    assert all(0 <= delay <= 8.0 for delay in delays)
    assert len({round(delay, 6) for delay in delays}) > 100   # jitter: clients do not retry in lockstep


# ---------------------------------------------------------------- streaming

def test_a_complete_stream_is_assembled_and_timed():
    stream = assemble(load_events(FIXTURES / "complete_answer.jsonl"))
    assert stream.complete and stream.stop_reason == "end"
    assert stream.text == "You can return unworn shoes within 30 days of delivery."
    assert stream.time_to_first_token_s == 0.64
    assert stream.output_tokens == 12


def test_a_dropped_connection_is_never_a_complete_answer():
    stream = assemble(load_events(FIXTURES / "dropped_connection.jsonl"))
    assert not stream.complete
    assert stream.output_tokens is None                 # usage is unknown: log it


def test_a_stream_that_hits_the_limit_reports_truncation():
    stream = assemble(load_events(FIXTURES / "truncated_at_limit.jsonl"))
    assert stream.stop_reason == "max_tokens"
    assert next_action(ModelResponse(stream.text, stream.stop_reason), max_tokens=500) == "retry_with_larger_limit"


def test_tool_call_fragments_are_assembled_before_execution():
    stream = assemble(load_events(FIXTURES / "tool_call.jsonl"))
    assert stream.tool_calls == [{"name": "get_order_status", "arguments": {"order_id": "A-1042"}}]


def test_an_error_event_mid_stream_is_handled_like_an_api_error():
    stream = assemble(load_events(FIXTURES / "provider_error.jsonl"))
    assert not stream.complete and stream.error == "overloaded"


# ---------------------------------------------------------------- cost

def test_cost_per_request_with_and_without_prompt_caching():
    large = EXAMPLE_PRICES["large-model"]
    assert round(request_cost(large, 8000, 600), 4) == 0.0330
    assert round(request_cost(large, 8000, 600, cached_tokens=2000), 4) == 0.0276


def test_cost_per_resolved_task_includes_failed_conversations():
    per_request = request_cost(EXAMPLE_PRICES["large-model"], 4650, 220)
    assert round(cost_per_resolved_task(per_request, requests_per_task=2.4, resolution_rate=0.8), 4) == 0.0517


def test_prompt_growth_is_a_cost_regression():
    large = EXAMPLE_PRICES["large-model"]
    growth = request_cost(large, 4650 + 1500, 220) / request_cost(large, 4650, 220) - 1
    assert round(growth, 2) == 0.26
