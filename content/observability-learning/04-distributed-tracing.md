# Distributed tracing

A single user action often crosses many services: a web server, an API gateway, two back-end services, a database, a queue and a third-party API. When the action is slow or fails, logs from each service tell part of the story, and metrics say that something is wrong somewhere. A distributed trace shows the whole path of that one request, with the time spent at every step and the step where it failed.

This chapter covers traces and spans, how context travels between services, sampling, how to read a trace, how QA uses traces for flaky tests and performance work, and what correlation looks like before a system has tracing. The signals are introduced in [Observability for QA engineers](/learn/observability?topic=observability-for-qa).

**Prerequisites:** [Observability for QA engineers](/learn/observability?topic=observability-for-qa), [Logs that answer questions](/learn/observability?topic=structured-logs).

## Traces and spans

A **trace** is the record of one request through the system. It is made of **spans**: timed operations such as handling an HTTP request, calling another service or running a database query. Spans form a tree through their parent ids.

```diagram
trace 4bf92f3577b34da6a3ce929d0e0e4736                         total 2,430 ms
└─ POST /checkout                (web, server)                  0 ─────────────── 2,430
   ├─ SELECT cart                (web → db, client)             12 ─ 38
   ├─ POST /payments             (web → payments, client)       45 ──────────── 2,410
   │  └─ POST /payments          (payments, server)             50 ──────────── 2,400
   │     ├─ fraud check          (payments, internal)           55 ── 140
   │     └─ POST bank-api        (payments → bank, client)      150 ─────────── 2,390  status=Error (timeout)
   └─ render receipt             (web, internal)                not reached
```

OpenTelemetry defines what a span carries:

| Field | Meaning |
|---|---|
| Name | What the operation is, such as `POST /payments` |
| Trace id, span id, parent span id | Which trace it belongs to and where it sits in the tree; the root span has no parent |
| Start and end time | When it ran |
| Attributes | Key-value details: route, status code, database system, feature flag |
| Events | Timestamped notes inside the span, similar to log lines |
| Links | Connections to spans in other traces, for example the job a message started |
| Status | Unset (completed), Error, or Ok when set explicitly |

Spans also have a kind: **server** and **client** for the two sides of a synchronous call, **producer** and **consumer** for asynchronous messages, and **internal** for work inside one process.

## Context propagation

A trace survives a network hop only if the caller passes its context to the callee. The W3C Trace Context recommendation standardizes this with the `traceparent` header, which OpenTelemetry uses by default:

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  │                                │                └ flags: 01 = sampled
             │  │                                └ parent id: 16 hex characters, the caller's span
             │  └ trace id: 32 hex characters, shared by every span of the request
             └ version: 00
```

The callee keeps the trace id, records the incoming parent id as its parent, creates its own span id and sends a new `traceparent` downstream. An optional `tracestate` header carries vendor-specific data. Instrumentation libraries do this automatically for common HTTP clients and servers; queues and custom protocols often need it done by hand.

Because test tools are clients, a test can start a trace itself by sending a `traceparent` with a trace id it chose, and then look that trace up when it fails. The code below parses and validates a header and builds the header for the next hop, as a propagator does:

```python
import re
import uuid

TRACEPARENT = r"([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})"

def parse_traceparent(header):
    match = re.fullmatch(TRACEPARENT, header.strip())
    if not match:
        return None
    version, trace_id, parent_id, flags = match.groups()
    if version == "ff" or set(trace_id) == {"0"} or set(parent_id) == {"0"}:
        return None
    return {"trace_id": trace_id, "parent_id": parent_id, "sampled": (int(flags, 16) & 1) == 1}

def child_traceparent(incoming):
    context = parse_traceparent(incoming)
    if context is None:
        context = {"trace_id": uuid.uuid4().hex, "parent_id": None, "sampled": True}
    span_id = uuid.uuid4().hex[:16]
    flags = "01" if context["sampled"] else "00"
    return f"00-{context['trace_id']}-{span_id}-{flags}", context

for header in [
    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
    "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
    "not-a-trace-header",
]:
    outgoing, context = child_traceparent(header)
    print("in: ", header)
    print("out:", outgoing, "| continues trace" if context["parent_id"] else "| new trace")
```

An invalid or missing header starts a new trace instead of failing the request. Treat incoming context from outside your system as untrusted: it can steer which traces are kept, and baggage must never carry sensitive data.

## Sampling

Busy systems do not keep every trace. OpenTelemetry describes two approaches:

| | Head sampling | Tail sampling |
|---|---|---|
| When the decision is made | At the start of the trace, without seeing it | After most or all spans have arrived |
| Typical rule | Keep a fixed share, such as 5%, based on the trace id | Keep every trace with an error, every slow trace, a share of the rest |
| Strengths | Simple, cheap, consistent across services | Keeps the interesting traces |
| Weaknesses | Cannot guarantee that traces with errors are kept | Stateful, harder to run and operate, often vendor-specific |

Pipelines with high volume often combine both. OpenTelemetry's rule of thumb is to consider sampling from around a thousand traces per second, and to avoid it at tens of traces per second. For a test environment the practical consequence is simple: make sure the traces of your test runs are kept, for example by marking test traffic as sampled.

## Reading a trace

Most performance and reliability problems show up as a few recognisable shapes:

| Pattern in the trace | What it usually means |
|---|---|
| One long span on the critical path | The slow dependency to optimise or to time out sooner |
| Gaps where no span covers the time | Queueing, thread-pool waits, garbage collection or missing instrumentation |
| The same query repeated many times | An N+1 query pattern |
| Calls made one after another that could run in parallel | Sequential fan-out |
| A failed span followed by a similar span | A retry; several of them in a row may be a retry storm |
| The root span ends before its children | Work continuing in the background after the response was sent |

Start from the root span, follow the longest child at each level (the critical path), and look for the first span with an error status.

## Traces in QA work

| Task | How traces help |
|---|---|
| A flaky end-to-end test | Send a `traceparent` from the test; when it fails, open its trace and see which service timed out |
| Performance testing | Break a slow endpoint into the spans that take the time, rather than guessing from the total |
| Testing a new integration | Check that context is propagated across the new hop, so the trace does not split in two |
| Asserting on behaviour | Trace-based checks: the request made exactly one database call, never called a deprecated service, stayed within a time budget per span |
| Reproducing production problems | Find the trace of a reported failure by its id, attributes or time, and copy its inputs into a test |

Trace-based assertions are powerful but brittle if they check every span. Assert on the few properties that matter, such as the number of calls to a dependency or the absence of an error status.

## Case study: correlation before tracing

This site does not use distributed tracing yet. It uses the step before it: an **operation id**. Each multi-step operation, such as importing vacancies, creates an id such as `import_…` and writes it into every event of that operation: a start event, a completion event with outcome, duration and item counts, and, on failure, the stage that failed.

| What operation ids give you | What tracing would add |
|---|---|
| All events of one run, found with one query | Timing of every step, not only the total |
| The stage that failed and a safe reason | The causal tree across services |
| Duration and item counts per run | Automatic propagation between the Worker, the AI service and external calls |

Operation ids are cheap and already answer most "what happened in this run?" questions. The natural next step would be to propagate a W3C `traceparent` from the Worker to the Python AI service, so that one Learning Path Advisor request appears as a single trace across both.

## Common mistakes

- **Broken propagation.** One uninstrumented hop splits the trace in two, and the slow part disappears from view.
- **Only head sampling.** The traces with errors are exactly the ones a fixed 5% sample usually loses.
- **Spans without useful attributes.** A span named `HTTP POST` with no route or status code explains nothing.
- **High-cardinality span names.** Put ids in attributes, not in span names such as `GET /orders/48213`.
- **Trusting incoming context blindly.** External headers can be malformed or crafted; validate and start a new trace when in doubt.
- **Asserting on every span.** Trace-based tests that check the whole tree break with every refactoring.
- **Ignoring gaps.** Time not covered by any span is often where the problem is.

## Summary

A trace records one request as a tree of timed spans, with attributes, events, links and a status. Context travels between services in the W3C `traceparent` header, which keeps the trace id and passes the caller's span as the parent. Head sampling is simple but loses interesting traces; tail sampling keeps errors and slow requests at the cost of complexity. Read traces along the critical path and look for long spans, gaps, repeated calls and retries. In QA work, start traces from tests, use them to explain flaky failures and slow endpoints, and assert only on the few span properties that matter. Where there is no tracing yet, an operation id in every event is a cheap and useful first step.
