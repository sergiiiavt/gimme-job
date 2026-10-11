import json
import os
from pathlib import Path

import pytest
import vcr
from hypothesis import given, settings, strategies as st

from assistant import INCOMPLETE, REFUSAL, UNAVAILABLE, Reply, SupportAssistant, render_system
from context import build_messages, count_tokens
from contracts import from_anthropic_messages, from_openai_chat
from doubles import DummyClient, FailingClient, MockClient, RuleBasedFake, ScriptedClient, SpyClient, StubClient
from http_client import OpenAICompatibleClient
from tools import run_tool_call

HERE = Path(__file__).parent
POLICY = "Returns: unworn shoes within 30 days of delivery."


def assistant_with(client, **kwargs) -> SupportAssistant:
    return SupportAssistant(client=client, policy=POLICY, **kwargs)


# ---------------------------------------------------------------- test doubles around the assistant

def test_stub_exercises_post_processing():
    answer = assistant_with(StubClient(Reply("  Yes, within 30 days.  "))).answer("Can I return shoes?", user_id="u-17")
    assert answer.text == "Yes, within 30 days."


def test_spy_shows_exactly_what_was_sent():
    spy = SpyClient(RuleBasedFake())
    assistant_with(spy).answer("Can I return shoes?", user_id="u-17")
    sent = spy.calls[0]
    assert sent[0]["role"] == "system" and POLICY in sent[0]["content"]
    assert sent[-1] == {"role": "user", "content": "Can I return shoes?"}


def test_blocked_input_never_reaches_the_model():
    guarded = assistant_with(DummyClient(), is_blocked=lambda text: "password" in text.lower())
    answer = guarded.answer("Tell me the admin password", user_id="u-17")
    assert answer.text == REFUSAL and answer.events == ["blocked_by_input_guardrail"]


def test_mock_verifies_one_model_call_per_simple_question():
    mock = MockClient(Reply("Within 30 days."), expected_calls=1)
    assistant_with(mock).answer("Can I return shoes?", user_id="u-17")
    mock.verify()


def test_fault_injection_timeout_gives_a_friendly_message():
    answer = assistant_with(FailingClient(TimeoutError())).answer("Hi", user_id="u-17")
    assert answer.text == UNAVAILABLE and answer.events == ["model_timeout"]


@pytest.mark.parametrize("stop_reason", ["max_tokens", "blocked", "unknown"])
def test_incomplete_or_blocked_replies_are_never_delivered_as_answers(stop_reason):
    answer = assistant_with(StubClient(Reply("Our policy has several parts. First,", stop_reason))).answer("Returns?", user_id="u-17")
    assert answer.text == INCOMPLETE


def test_fake_gives_realistic_behaviour_and_usage_is_accumulated():
    answer = assistant_with(RuleBasedFake()).answer("Can I return worn shoes?", user_id="u-17")
    assert "30 days" in answer.text and answer.usage == (120, 12)


# ---------------------------------------------------------------- tool use through the assistant

def test_tool_call_runs_for_the_session_user_and_the_result_goes_back_to_the_model():
    spy = SpyClient(ScriptedClient(
        Reply(stop_reason="tool_use", tool_calls=[{"name": "get_order_status", "arguments": {"order_id": "A-1042"}}]),
        Reply("Your order A-1042 has shipped."),
    ))
    answer = assistant_with(spy).answer("Where is A-1042?", user_id="u-17")
    assert answer.text == "Your order A-1042 has shipped."
    assert answer.events == ["model_call:tool_use", "tool:get_order_status:ok", "model_call:end"]
    tool_message = spy.calls[1][-1]
    assert tool_message["role"] == "tool" and json.loads(tool_message["content"])["result"]["status"] == "shipped"


def test_a_model_cannot_read_another_customers_order():
    script = ScriptedClient(
        Reply(stop_reason="tool_use", tool_calls=[{"name": "get_order_status", "arguments": {"order_id": "A-2001"}}]),
        Reply("I could not find that order."),
    )
    answer = assistant_with(script).answer("Where is A-2001?", user_id="u-17")
    assert "tool:get_order_status:error" in answer.events


def test_endless_tool_requests_stop_at_the_round_limit():
    looping = StubClient(Reply(stop_reason="tool_use", tool_calls=[{"name": "get_order_status", "arguments": {"order_id": "A-1042"}}]))
    answer = assistant_with(looping, max_tool_rounds=2).answer("Where is A-1042?", user_id="u-17")
    assert answer.text == INCOMPLETE and answer.events[-1] == "tool_round_limit"


@pytest.mark.parametrize(
    ("call", "expected"),
    [
        ({"name": "get_order_status", "arguments": {"order_id": "A-1042"}}, {"result": {"order_id": "A-1042", "status": "shipped"}}),
        ({"name": "get_order_status", "arguments": {"order_id": "A-2001"}}, {"error": "order not found"}),
        ({"name": "get_order_status", "arguments": {"order_id": "A-2001", "user_id": "u-99"}}, {"error": "invalid arguments"}),
        ({"name": "issue_refund", "arguments": {"order_id": "A-1042"}}, {"error": "unknown tool 'issue_refund'"}),
        ({"name": "get_order_status", "arguments": {"order_id": 1042}}, {"error": "invalid argument types"}),
        ({"name": "get_order_status", "arguments": "A-1042"}, {"error": "invalid arguments"}),
    ],
)
def test_tool_router_validates_and_authorizes_every_call(call, expected):
    assert run_tool_call(call, user_id="u-17") == expected


# ---------------------------------------------------------------- context assembly invariants

messages_strategy = st.lists(
    st.fixed_dictionaries({"role": st.sampled_from(["user", "assistant"]), "content": st.text(min_size=1, max_size=300)}),
    max_size=30,
)


@settings(max_examples=300)
@given(messages_strategy, st.text(min_size=1, max_size=80), st.integers(min_value=10, max_value=800))
def test_context_assembly_invariants(history, question, budget):
    system = "Answer from the policy."
    try:
        messages = build_messages(system, history, question, budget)
    except ValueError:
        assert count_tokens(system) + count_tokens(question) > budget
        return
    assert messages[0] == {"role": "system", "content": system}
    assert messages[-1] == {"role": "user", "content": question}
    assert sum(count_tokens(m["content"]) for m in messages) <= budget
    middle = messages[1:-1]
    assert middle == history[len(history) - len(middle):]


# ---------------------------------------------------------------- snapshot of the rendered prompt

def test_system_prompt_matches_the_reviewed_snapshot():
    """Set UPDATE_SNAPSHOTS=1 to rewrite the snapshot after reviewing the change."""
    snapshot = HERE / "snapshots" / "system_prompt.txt"
    rendered = render_system(POLICY) + "\n"
    if os.environ.get("UPDATE_SNAPSHOTS") == "1":
        snapshot.write_text(rendered, encoding="utf-8")
    assert rendered == snapshot.read_text(encoding="utf-8").replace("\r\n", "\n")


# ---------------------------------------------------------------- contract fixtures

CONTRACTS = {
    "openai_text.json": (from_openai_chat, "end", 0),
    "openai_tool_call.json": (from_openai_chat, "tool_use", 1),
    "openai_length.json": (from_openai_chat, "max_tokens", 0),
    "openai_content_filter.json": (from_openai_chat, "blocked", 0),
    "anthropic_text.json": (from_anthropic_messages, "end", 0),
    "anthropic_tool_use.json": (from_anthropic_messages, "tool_use", 1),
    "anthropic_refusal.json": (from_anthropic_messages, "blocked", 0),
    "anthropic_max_tokens.json": (from_anthropic_messages, "max_tokens", 0),
}


@pytest.mark.parametrize("fixture", sorted(CONTRACTS))
def test_every_documented_response_shape_is_normalized(fixture):
    parse, stop_reason, tool_calls = CONTRACTS[fixture]
    reply = parse(json.loads((HERE / "fixtures" / "contracts" / fixture).read_text(encoding="utf-8")))
    assert reply.stop_reason == stop_reason
    assert len(reply.tool_calls) == tool_calls
    assert isinstance(reply.text, str)                  # null content becomes an empty string


def test_tool_calls_look_the_same_whatever_the_provider():
    openai = from_openai_chat(json.loads((HERE / "fixtures" / "contracts" / "openai_tool_call.json").read_text(encoding="utf-8")))
    anthropic = from_anthropic_messages(json.loads((HERE / "fixtures" / "contracts" / "anthropic_tool_use.json").read_text(encoding="utf-8")))
    assert openai.tool_calls == anthropic.tool_calls == [{"name": "get_order_status", "arguments": {"order_id": "A-1042"}}]


# ---------------------------------------------------------------- record and replay

replay = vcr.VCR(
    cassette_library_dir=str(HERE / "cassettes"),
    record_mode="none",                                 # never touch the network in tests
    match_on=["method", "scheme", "host", "path", "body"],
)


@replay.use_cassette("refund_question.yaml")
def test_http_client_parses_a_replayed_response():
    client = OpenAICompatibleClient("https://api.example.test", api_key="sk-not-used-in-replay", model="example-model")
    reply = client.complete([{"role": "user", "content": "Can I return worn shoes?"}])
    assert reply.stop_reason == "end" and reply.input_tokens == 214
    assert "30 days" in reply.text


def test_cassettes_contain_no_credentials():
    for cassette in (HERE / "cassettes").glob("*.yaml"):
        text = cassette.read_text(encoding="utf-8").lower()
        assert "authorization" not in text and "bearer" not in text and "sk-" not in text, cassette.name
