"""A small tracer for LLM features: nested spans with the OpenTelemetry attribute names for generative
AI, redaction before export, cost per trace, and checks that a trace can explain a failure.

Chapter: Production quality (tracing and observability)
https://gimme-job.com/learn/llm?topic=production-quality

Span names and attributes follow the OpenTelemetry semantic conventions for generative AI
(https://github.com/open-telemetry/semantic-conventions-genai): "chat {model}" and
"retrieval {data source}" are CLIENT spans, "execute_tool {tool}" and "invoke_agent {agent}" are
INTERNAL. A real system uses the OpenTelemetry SDK or a tool such as Langfuse or Phoenix; this tracer
keeps the same data model small enough to test every rule.
"""

import contextvars
import json
import re
import secrets
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field

_current_span: contextvars.ContextVar["Span | None"] = contextvars.ContextVar("current_span", default=None)

OPERATION = "gen_ai.operation.name"
MODEL = "gen_ai.request.model"
PROMPT_VERSION = "gen_ai.prompt.version"
INPUT_TOKENS = "gen_ai.usage.input_tokens"  # includes cached input tokens
OUTPUT_TOKENS = "gen_ai.usage.output_tokens"
CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens"
DOCUMENTS = "gen_ai.retrieval.documents"
REQUIRED = {
    "chat": [MODEL, "gen_ai.provider.name", PROMPT_VERSION, INPUT_TOKENS, OUTPUT_TOKENS],
    "execute_tool": ["gen_ai.tool.name", "gen_ai.tool.call.id"],
    "retrieval": ["gen_ai.data_source.id", DOCUMENTS],
    "invoke_agent": ["gen_ai.agent.name", "gen_ai.conversation.id"],
}


@dataclass
class Span:
    trace_id: str
    span_id: str
    parent_id: str | None
    name: str
    kind: str
    start: float
    end: float | None = None
    status: str = "UNSET"
    attributes: dict = field(default_factory=dict)

    def set(self, key: str, value) -> "Span":
        self.attributes[key] = value
        return self


class Tracer:
    def __init__(self, clock: Callable[[], float] = time.monotonic, new_id: Callable[[], str] | None = None):
        self.clock = clock
        self.new_id = new_id or (lambda: secrets.token_hex(8))
        self.finished: list[Span] = []

    @contextmanager
    def span(self, name: str, kind: str = "INTERNAL", attributes: dict | None = None) -> Iterator[Span]:
        """A span that becomes the parent of every span opened inside it, also in concurrent asyncio
        tasks, because the current span is a context variable and not a shared stack."""
        parent = _current_span.get()
        span = Span(trace_id=parent.trace_id if parent else self.new_id(), span_id=self.new_id(),
                    parent_id=parent.span_id if parent else None, name=name, kind=kind, start=self.clock(),
                    attributes=dict(attributes or {}))
        token = _current_span.set(span)
        try:
            yield span
        except Exception as error:
            span.status = "ERROR"
            span.attributes["error.type"] = type(error).__name__
            raise
        finally:
            span.end = self.clock()
            _current_span.reset(token)
            self.finished.append(span)

    def agent(self, name: str, conversation_id: str):
        return self.span(f"invoke_agent {name}", "INTERNAL", {
            OPERATION: "invoke_agent", "gen_ai.agent.name": name, "gen_ai.conversation.id": conversation_id})

    def retrieval(self, data_source: str, query: str):
        return self.span(f"retrieval {data_source}", "CLIENT", {
            OPERATION: "retrieval", "gen_ai.data_source.id": data_source, "gen_ai.retrieval.query.text": query})

    def chat(self, model: str, provider: str, prompt_name: str, prompt_version: str):
        return self.span(f"chat {model}", "CLIENT", {
            OPERATION: "chat", MODEL: model, "gen_ai.provider.name": provider,
            "gen_ai.prompt.name": prompt_name, PROMPT_VERSION: prompt_version})

    def tool(self, name: str, call_id: str, arguments: dict):
        return self.span(f"execute_tool {name}", "INTERNAL", {
            OPERATION: "execute_tool", "gen_ai.tool.name": name, "gen_ai.tool.call.id": call_id,
            "gen_ai.tool.call.arguments": json.dumps(arguments, ensure_ascii=False)})


# Redaction runs before anything leaves the process. Emails take the characters that RFC 5322 allows
# in the local part; card numbers count only when the Luhn check passes, so order numbers stay readable.
EMAIL = re.compile(r"[\w!#$%&'*+/=?^`{|}~.-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
CARD = re.compile(r"(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)")
PHONE = re.compile(r"\+\d{1,3}(?:[ -]?\(?\d{2,4}\)?){2,5}(?!\d)")


def luhn_valid(digits: str) -> bool:
    total = 0
    for position, char in enumerate(reversed(digits)):
        value = int(char)
        if position % 2:
            value = value * 2 - 9 if value > 4 else value * 2
        total += value
    return total % 10 == 0


def redact(text: str) -> str:
    text = EMAIL.sub("[EMAIL]", text)
    text = CARD.sub(lambda match: "[CARD]" if luhn_valid(re.sub(r"\D", "", match.group())) else match.group(), text)
    return PHONE.sub("[PHONE]", text)


def redact_value(value):
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, dict):
        return {key: redact_value(item) for key, item in value.items()}
    return value


def export(spans: list[Span]) -> list[dict]:
    """Spans as JSON-ready records with every string attribute redacted."""
    return [{"trace_id": span.trace_id, "span_id": span.span_id, "parent_span_id": span.parent_id,
             "name": span.name, "kind": span.kind, "start": span.start, "end": span.end, "status": span.status,
             "attributes": redact_value(span.attributes)} for span in spans]


def span_cost(span: dict, prices: dict[str, dict[str, float]]) -> float:
    """Cost of a chat span in the currency of the price table (per million tokens). Cached input tokens
    are part of the input tokens and are billed at the cache-read price."""
    attributes = span["attributes"]
    if attributes.get(OPERATION) != "chat":
        return 0.0
    price = prices[attributes[MODEL]]
    cached = attributes.get(CACHE_READ_TOKENS, 0)
    return ((attributes[INPUT_TOKENS] - cached) * price["input"] + cached * price["cache_read"]
            + attributes[OUTPUT_TOKENS] * price["output"]) / 1_000_000


def trace_cost(spans: list[dict], prices: dict[str, dict[str, float]]) -> float:
    return sum(span_cost(span, prices) for span in spans)


def trace_problems(spans: list[dict]) -> list[str]:
    """What would make a trace useless for explaining a failure: missing required attributes, spans
    that never ended, children whose parent is not in the trace or that run outside the parent's time."""
    by_id = {span["span_id"]: span for span in spans}
    problems = []
    for span in spans:
        missing = [key for key in REQUIRED.get(span["attributes"].get(OPERATION), []) if key not in span["attributes"]]
        if missing:
            problems.append(f"{span['name']}: missing {', '.join(missing)}")
        if span["end"] is None or span["end"] < span["start"]:
            problems.append(f"{span['name']}: did not end properly")
        parent = by_id.get(span["parent_span_id"]) if span["parent_span_id"] else None
        if span["parent_span_id"] and parent is None:
            problems.append(f"{span['name']}: parent {span['parent_span_id']} is not in the trace")
        elif parent and parent["end"] is not None and span["end"] is not None and not (
                parent["start"] <= span["start"] and span["end"] <= parent["end"]):
            problems.append(f"{span['name']}: runs outside its parent {parent['name']}")
    return problems


def failure_stage(spans: list[dict], relevant_documents: set[str]) -> str:
    """For a failed answer: 'retrieval' when no relevant document was retrieved, otherwise 'generation'."""
    retrieved = {document["id"] for span in spans if span["attributes"].get(OPERATION) == "retrieval"
                 for document in span["attributes"].get(DOCUMENTS, [])}
    return "generation" if retrieved & relevant_documents else "retrieval"
