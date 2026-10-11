import asyncio
import itertools
import json
from contextlib import contextmanager

import pytest
from hypothesis import given
from hypothesis import strategies as st

from tracing import Span, Tracer, export, failure_stage, luhn_valid, redact, trace_cost, trace_problems

PRICES = {"large-model": {"input": 3.00, "cache_read": 0.30, "output": 15.00}}  # EUR per million tokens


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def new_tracer(tracer_class=Tracer) -> tuple[Tracer, FakeClock]:
    clock, numbers = FakeClock(), itertools.count(1)
    return tracer_class(clock=clock, new_id=lambda: f"id{next(numbers)}"), clock


def answer(tracer: Tracer, clock: FakeClock, retrieved=("doc-returns",), tool_fails=False) -> list[dict]:
    """One request to a support assistant: retrieval, a model call that asks for a tool, the tool, the answer."""
    with tracer.agent("support-assistant", "conv-1") as agent:
        with tracer.retrieval("help-center", "Can I return shoes I wore once? I am ana.k@example.com") as span:
            clock.advance(0.12)
            span.set("gen_ai.retrieval.documents", [{"id": document, "score": 0.81} for document in retrieved])
        with tracer.chat("large-model", "anthropic", "support-answer", "v14") as span:
            clock.advance(0.9)
            span.set("gen_ai.usage.input_tokens", 5200).set("gen_ai.usage.cache_read.input_tokens", 4000)
            span.set("gen_ai.usage.output_tokens", 60).set("gen_ai.response.time_to_first_chunk", 0.45)
        try:
            with tracer.tool("lookup_order", "call-1", {"order_id": "A-1042", "email": "ana.k@example.com"}):
                clock.advance(0.3)
                if tool_fails:
                    raise TimeoutError("the order service did not answer")
        except TimeoutError:
            agent.set("support.fallback", "apology")
        with tracer.chat("large-model", "anthropic", "support-answer", "v14") as span:
            clock.advance(1.4)
            span.set("gen_ai.usage.input_tokens", 5600).set("gen_ai.usage.cache_read.input_tokens", 5000)
            span.set("gen_ai.usage.output_tokens", 180).set("gen_ai.output.messages", [
                {"role": "assistant", "parts": [{"type": "text", "content": "Yes. We will email ana.k@example.com."}]}])
    return export(tracer.finished)


def test_spans_form_one_tree_with_the_conventional_names_and_kinds():
    records = answer(*new_tracer())
    root = records[-1]
    assert [(record["name"], record["kind"]) for record in records] == [
        ("retrieval help-center", "CLIENT"), ("chat large-model", "CLIENT"), ("execute_tool lookup_order", "INTERNAL"),
        ("chat large-model", "CLIENT"), ("invoke_agent support-assistant", "INTERNAL")]
    assert root["parent_span_id"] is None
    assert all(record["parent_span_id"] == root["span_id"] for record in records[:-1])
    assert len({record["trace_id"] for record in records}) == 1
    assert trace_problems(records) == []


def test_a_handled_error_marks_only_its_span_and_an_unhandled_one_marks_every_enclosing_span():
    records = answer(*new_tracer(), tool_fails=True)
    status = {record["name"]: (record["status"], record["attributes"].get("error.type")) for record in records}
    assert status["execute_tool lookup_order"] == ("ERROR", "TimeoutError")
    assert status["invoke_agent support-assistant"] == ("UNSET", None)

    tracer, _ = new_tracer()
    with pytest.raises(KeyError):
        with tracer.agent("support-assistant", "conv-2"), tracer.tool("lookup_order", "call-9", {}):
            raise KeyError("A-1042")
    assert [span.status for span in tracer.finished] == ["ERROR", "ERROR"]


def test_personal_data_never_leaves_the_process():
    tracer, clock = new_tracer()
    exported = json.dumps(answer(tracer, clock))
    assert "ana.k@example.com" not in exported and exported.count("[EMAIL]") == 3
    # inside the process the data is still there for the code that needs it
    assert "ana.k@example.com" in tracer.finished[0].attributes["gen_ai.retrieval.query.text"]


def test_cost_per_trace_bills_cached_input_tokens_at_the_cache_price():
    records = answer(*new_tracer())
    first = (1200 * 3.00 + 4000 * 0.30 + 60 * 15.00) / 1_000_000
    second = (600 * 3.00 + 5000 * 0.30 + 180 * 15.00) / 1_000_000
    assert trace_cost(records, PRICES) == pytest.approx(first + second)
    without_cache = ((5200 + 5600) * 3.00 + (60 + 180) * 15.00) / 1_000_000
    assert trace_cost(records, PRICES) < without_cache / 3


def test_a_trace_that_cannot_explain_a_failure_is_reported():
    records = answer(*new_tracer())
    del records[1]["attributes"]["gen_ai.prompt.version"]
    records[2]["end"] = None
    without_root = records[:-1]
    problems = trace_problems(without_root)
    assert "chat large-model: missing gen_ai.prompt.version" in problems
    assert "execute_tool lookup_order: did not end properly" in problems
    assert sum(1 for problem in problems if "is not in the trace" in problem) == 4


def test_retrieval_failures_are_told_apart_from_generation_failures():
    assert failure_stage(answer(*new_tracer()), {"doc-returns"}) == "generation"
    assert failure_stage(answer(*new_tracer(), retrieved=("doc-shipping",)), {"doc-returns"}) == "retrieval"


class StackTracer(Tracer):
    """The naive design: one shared stack of open spans for the whole process."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stack: list[Span] = []

    @contextmanager
    def span(self, name, kind="INTERNAL", attributes=None):
        parent = self.stack[-1] if self.stack else None
        span = Span(parent.trace_id if parent else self.new_id(), self.new_id(), parent.span_id if parent else None,
                    name, kind, self.clock(), attributes=dict(attributes or {}))
        self.stack.append(span)
        try:
            yield span
        finally:
            self.stack.remove(span)
            span.end = self.clock()
            self.finished.append(span)


async def two_tools_at_once(tracer: Tracer) -> tuple[str, dict[str, str]]:
    async def call(name: str):
        with tracer.tool(name, f"call-{name}", {}):
            await asyncio.sleep(0)

    with tracer.agent("support-assistant", "conv-3") as agent:
        await asyncio.gather(call("lookup_order"), call("lookup_customer"))
    return agent.span_id, {span.name: span.parent_id for span in tracer.finished if span is not agent}


def test_concurrent_tool_calls_get_the_right_parent():
    agent_id, parents = asyncio.run(two_tools_at_once(new_tracer()[0]))
    assert set(parents.values()) == {agent_id}
    # the same run with a shared stack makes the second tool a child of the first one
    agent_id, parents = asyncio.run(two_tools_at_once(new_tracer(StackTracer)[0]))
    assert parents["execute_tool lookup_customer"] != agent_id


SEPARATORS = st.text(alphabet=" ,;:()<>\n", max_size=3)
DIGITS = st.text(alphabet="0123456789", min_size=15, max_size=15)


def with_check_digit(digits: str) -> str:
    return next(digits + digit for digit in "0123456789" if luhn_valid(digits + digit))


@given(SEPARATORS, st.emails(), SEPARATORS)
def test_every_email_address_is_redacted(before, email, after):
    assert email not in redact(f"write to{before}{email}{after}today")


@given(DIGITS, st.sampled_from(["", " ", "-"]))
def test_card_numbers_are_redacted_in_any_grouping(digits, separator):
    number = with_check_digit(digits)
    grouped = separator.join(number[start:start + 4] for start in range(0, 16, 4))
    assert redact(f"my card is {grouped}, thanks") == "my card is [CARD], thanks"


@given(DIGITS)
def test_numbers_that_fail_the_luhn_check_stay_readable(digits):
    number = with_check_digit(digits)
    order = number[:-1] + str((int(number[-1]) + 1) % 10)
    assert redact(f"order {order} is late") == f"order {order} is late"


@pytest.mark.parametrize("phone", ["+380 44 123 4567", "+49 30 1234567", "+1 (555) 123-4567", "+380441234567"])
def test_international_phone_numbers_are_redacted(phone):
    assert redact(f"call me at {phone} after six") == "call me at [PHONE] after six"


@given(st.text(max_size=200))
def test_redacting_twice_changes_nothing(text):
    once = redact(text)
    assert redact(once) == once


def test_known_gaps_are_pinned():
    # patterns do not find national phone formats, names or addresses; a dedicated tool such as
    # Presidio, or not logging the text at all, is needed for those
    text = "call 044 123 4567 and ask for Olena Kovalenko, Khreshchatyk 22"
    assert redact(text) == text
