# LLM application anatomy and APIs

A production LLM feature is mostly ordinary software wrapped around a few calls to a model API. Those calls are remote, slow, metered, rate-limited and probabilistic, and every one of those properties creates defects that have nothing to do with the quality of the model. This chapter takes the running example, the Stride support assistant, apart: its components, the request and response of a model call, the ways a call ends, streaming, errors and retries, cost, and what must be recorded so that any behaviour can be reproduced and tested.

**Prerequisites:** [How LLMs generate text](/learn/llm?topic=llm-foundations); basic HTTP and JSON ([API & Integration](/learn/api)).

## Architecture of an LLM application

The Stride assistant answers questions about policies and orders. Its request path looks like this:

```diagram
 browser chat widget
        │  HTTPS, user session
        ▼
 API gateway ─────────── authentication, rate limiting, request size limits
        │
        ▼
 conversation orchestrator ── loads conversation state, enforces turn and cost budgets
        │
        ├─► input guardrails ─────── blocks abusive or out-of-scope input, redacts PII
        │
        ├─► context assembly ─────── system prompt template (versioned), history window,
        │                            retrieved policy chunks, user profile, tool definitions
        │
        ├─► model client ─────────── provider SDK, timeouts, retries, fallback model
        │        │
        │        └─► tool loop ────── get_order_status(order_id) with authorization check
        │
        ├─► output parsing ───────── structured output validation, citation check
        │
        ├─► output guardrails ────── policy and safety filters
        │
        └─► response + trace ─────── answer, citations, trace ID, usage and latency metrics
```

Only the model calls inside the model client are probabilistic. Everything else is deterministic code and should be tested with ordinary unit and integration tests, using a fake model where a model call is involved, as the retry and streaming examples in this chapter show.

| Component | Deterministic? | Typical defects | Main test technique |
|---|---|---|---|
| API gateway | Yes | Missing auth, no size limits, no rate limits | API and security tests |
| Orchestrator | Yes | Lost or mixed-up conversation state, unbounded loops, no budgets | Unit and integration tests |
| Input guardrails | Mostly (may call a classifier model) | Over-blocking, under-blocking, PII leaking into prompts | Classification metrics on labelled inputs |
| Context assembly | Yes | Wrong template version, history window drops the system prompt, wrong user's data | Unit tests and snapshot tests of rendered prompts |
| Model client | Wrapper yes, model no | Wrong stop-reason handling, retry storms, missing timeouts | Fake-client tests, fault injection |
| Tool loop | Wrapper yes | Missing authorization, unvalidated arguments, infinite loops | Unit tests, agent evaluation |
| Output parsing | Yes | Crashes on invalid JSON, accepts invalid citations | Unit tests with recorded bad outputs |
| Output guardrails | Mostly | Same as input guardrails | Classification metrics |
| Model output quality | No | Wrong, unfaithful, irrelevant or unsafe answers | Evaluation with datasets and scorers |

The table shows a recurring point: **most of an LLM application is testable with conventional techniques.** Model evaluation is necessary but it is not a substitute for those tests.

## The model call: request and response

All major chat APIs share one conceptual shape: a list of **messages** with roles, plus **parameters**, sent to a **model**; the response contains generated content, a **stop reason** and **usage** counts.

```json
{
  "model": "<pinned model id>",
  "messages": [
    {"role": "system", "content": "You are Stride's support assistant. Answer only from the POLICY section..."},
    {"role": "user", "content": "Can I return shoes I wore once?"}
  ],
  "temperature": 0,
  "max_tokens": 500,
  "tools": [{"name": "get_order_status", "description": "...", "parameters": {"type": "object"}}]
}
```

| Role | Purpose | Testing note |
|---|---|---|
| system (or developer) | Instructions from the application: persona, rules, format | Must survive history truncation; treat as public, never put secrets in it |
| user | The end user's message | Untrusted input |
| assistant | Earlier model replies, or a prefilled start of the reply | History you send back is also input; it can be manipulated if stored client-side |
| tool | Result of a tool call | Untrusted data from an external system |

The same call in three common SDKs (run on your own machine; set the API key and a pinned model ID in environment variables):

```python
# OpenAI Chat Completions API
import os
from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model=os.environ["LLM_MODEL"],
    messages=[
        {"role": "system", "content": "You are Stride's support assistant."},
        {"role": "user", "content": "Can I return shoes I wore once?"},
    ],
    temperature=0,
    max_completion_tokens=500,
)
choice = response.choices[0]
print(choice.message.content)
print(choice.finish_reason, response.usage.prompt_tokens, response.usage.completion_tokens)
```

```python
# OpenAI Responses API
import os
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model=os.environ["LLM_MODEL"],
    instructions="You are Stride's support assistant.",
    input="Can I return shoes I wore once?",
    max_output_tokens=500,
)
print(response.output_text)
print(response.status, response.usage.input_tokens, response.usage.output_tokens)
```

```python
# Anthropic Messages API: the system prompt is a top-level parameter and max_tokens is required
import os
import anthropic

client = anthropic.Anthropic()
message = client.messages.create(
    model=os.environ["LLM_MODEL"],
    system="You are Stride's support assistant.",
    messages=[{"role": "user", "content": "Can I return shoes I wore once?"}],
    temperature=0,
    max_tokens=500,
)
print(message.content[0].text)
print(message.stop_reason, message.usage.input_tokens, message.usage.output_tokens)
```

Differences between providers are small but they matter for tests: where the system prompt goes, whether `max_tokens` is required, how content is structured (a string or a list of content blocks), and the names of stop reasons and usage fields. Many teams wrap providers behind one internal interface, or use a gateway library such as LiteLLM, so that the rest of the application and its tests deal with one normalized shape.

## Stop reasons: how a call ends

Every response says why generation stopped. Each reason requires different handling, and each handling path needs a test.

| Normalized meaning | OpenAI Chat `finish_reason` | Anthropic `stop_reason` | Correct application behaviour |
|---|---|---|---|
| Finished normally | `stop` | `end_turn`, `stop_sequence` | Validate and deliver |
| Hit the output limit | `length` | `max_tokens`, `model_context_window_exceeded` | Never deliver as complete: retry with a larger limit, or shorten the request, or show a notice |
| Wants to call a tool | `tool_calls` | `tool_use` | Execute the tool (with authorization) and call the model again |
| Blocked or refused | `content_filter` | `refusal` | Show a safe template and log for review |
| Must continue | not applicable | `pause_turn` (server-side tool loops) | Send the conversation back to continue |

The most common production bug in this area is **treating a truncated response as complete**. It shows up as cut-off sentences in the UI, or as JSON parse errors that are blamed on the model. The handler below maps provider values to one vocabulary and decides the next action; the test cases cover every branch, including an unknown value from a future API version, which must fail closed.

```python
from dataclasses import dataclass, field

# One vocabulary for the whole application, whatever the provider calls it.
OPENAI_FINISH = {"stop": "end", "length": "max_tokens", "tool_calls": "tool_use",
                 "content_filter": "blocked"}
ANTHROPIC_STOP = {"end_turn": "end", "max_tokens": "max_tokens", "stop_sequence": "end",
                  "tool_use": "tool_use", "refusal": "blocked", "pause_turn": "continue",
                  "model_context_window_exceeded": "max_tokens"}


@dataclass
class ModelResponse:
    text: str
    stop_reason: str                      # normalized value
    output_tokens: int
    tool_calls: list = field(default_factory=list)


def handle(response: ModelResponse, max_tokens: int) -> str:
    """Decide what the application does next. Every branch needs its own test."""
    if response.stop_reason == "end":
        return "deliver answer"
    if response.stop_reason == "tool_use":
        return f"run {len(response.tool_calls)} tool call(s) and call the model again"
    if response.stop_reason == "max_tokens":
        if max_tokens < 4000:
            return "retry once with a larger max_tokens"
        return "show a shortened-answer notice and log a truncation"
    if response.stop_reason == "blocked":
        return "show the refusal template and log for review"
    if response.stop_reason == "continue":
        return "send the conversation back so the model can continue"
    return "fail closed: unknown stop reason"


cases = [
    ("normal answer", ModelResponse("You can return...", OPENAI_FINISH["stop"], 42), 1000),
    ("tool request", ModelResponse("", ANTHROPIC_STOP["tool_use"], 18, [{"name": "get_order"}]), 1000),
    ("truncated, small budget", ModelResponse('{"answer": "You can re', OPENAI_FINISH["length"], 1000), 1000),
    ("truncated, large budget", ModelResponse("...", ANTHROPIC_STOP["max_tokens"], 8000), 8000),
    ("provider refusal", ModelResponse("", ANTHROPIC_STOP["refusal"], 0), 1000),
    ("new provider value", ModelResponse("", "something_new", 0), 1000),
]
for name, response, budget in cases:
    print(f"{name:<24} -> {handle(response, budget)}")
```

Output:

```text
normal answer            -> deliver answer
tool request             -> run 1 tool call(s) and call the model again
truncated, small budget  -> retry once with a larger max_tokens
truncated, large budget  -> show a shortened-answer notice and log a truncation
provider refusal         -> show the refusal template and log for review
new provider value       -> fail closed: unknown stop reason
```

## Streaming

With streaming, the API sends the response as a sequence of events over one HTTP connection (server-sent events): a start event, many small text deltas, possibly tool-call deltas, and a final event with the stop reason and usage. Users see text appear immediately, which is why chat interfaces stream.

Streaming creates its own failure modes:

- **Interrupted streams.** The connection can drop after some deltas. Without the final event you have a partial answer that must not be shown or stored as complete.
- **Partial structured output.** JSON arrives in fragments; parsing is only valid at the end, unless you use an incremental parser designed for it.
- **Usage only at the end.** Token counts arrive in the final event (some APIs require an option to include them). If the stream breaks, usage is unknown.
- **Client disconnects.** If the user closes the tab, the server should stop consuming the stream to avoid paying for unused tokens.
- **Latency metrics.** Time to first token (TTFT) and total time are measured from stream events.

The assembler below processes a recorded stream, measures TTFT and detects an interrupted stream.

```python
# A recorded stream: (seconds since the request was sent, event type, payload)
complete_stream = [
    (0.000, "start", None),
    (0.640, "delta", "You can return "),
    (0.700, "delta", "unworn shoes within "),
    (0.770, "delta", "30 days of delivery."),
    (0.790, "stop", {"stop_reason": "end", "output_tokens": 12}),
]
broken_stream = complete_stream[:3]          # connection dropped before the stop event


def assemble(events: list) -> dict:
    text, first_token_at, finished, usage = [], None, False, None
    for at, kind, payload in events:
        if kind == "delta":
            if first_token_at is None:
                first_token_at = at
            text.append(payload)
        elif kind == "stop":
            finished, usage = True, payload
    return {
        "text": "".join(text),
        "complete": finished,
        "time_to_first_token_s": first_token_at,
        "total_s": events[-1][0],
        "usage": usage,
    }


for name, events in [("complete", complete_stream), ("broken", broken_stream)]:
    result = assemble(events)
    print(name, result)
    if not result["complete"]:
        print("  -> must not be shown as a full answer: retry or show an error")
```

Output:

```text
complete {'text': 'You can return unworn shoes within 30 days of delivery.', 'complete': True, 'time_to_first_token_s': 0.64, 'total_s': 0.79, 'usage': {'stop_reason': 'end', 'output_tokens': 12}}
broken {'text': 'You can return unworn shoes within ', 'complete': False, 'time_to_first_token_s': 0.64, 'total_s': 0.7, 'usage': None}
  -> must not be shown as a full answer: retry or show an error
```

Recording real streams once and replaying them in tests, as in this example, is the standard way to test streaming code without network access.

### Test cases for streaming

| Case | Expected behaviour |
|---|---|
| Normal stream | Text assembled completely; time to first token and total time recorded |
| Connection drops before the final event | Not shown or stored as a complete answer; the user can retry |
| Final event reports `max_tokens` | Truncation handling runs |
| Tool-call deltas in the stream | Assembled into a complete tool call before execution |
| User closes the chat | The server stops reading the stream |
| Interrupted stream without usage data | Missing usage is logged |
| Error event in the middle of the stream | Handled like an API error |
| No event within the read timeout | Stream aborted cleanly |

## Errors, retries and timeouts

Model APIs fail often enough that error handling is part of the core functionality. The status codes fall into two groups:

| Status | Meaning | Retry? |
|---|---|---|
| 400 | Invalid request, for example the input exceeds the context window | No: the same request will fail again; fix or shorten it |
| 401, 403 | Authentication or permission problem | No: alert, it is a configuration defect |
| 404 | Unknown model or endpoint, for example a retired model ID | No: alert |
| 413 | Request too large | No |
| 408, timeouts | Request or connection timed out | Yes, within the overall deadline |
| 429 | Rate limit exceeded | Yes, after the delay in the `Retry-After` header if present. Exception: a 429 that reports exhausted quota or billing problems will not recover by waiting |
| 500, 502, 503, 504 | Server or gateway error | Yes |
| 529 | Overloaded (Anthropic) | Yes |

A sound retry policy has five parts:

- **Retry only retryable errors.** Retrying a 400 wastes time and money and hides the defect.
- **Exponential backoff with jitter.** Wait about `base · 2^attempt` seconds, capped, and randomize the wait ("full jitter": a random value between 0 and that bound) so that many clients do not retry in lockstep.
- **Respect `Retry-After`** when the server provides it.
- **Bound everything.** A maximum number of attempts and an overall deadline that fits the user experience. Without them, a provider incident turns into requests that hang for minutes.
- **Never blindly retry side effects.** If a tool call already issued a refund, a retry of the whole turn must not issue it again. Use idempotency keys for side-effecting tools.

The implementation below follows these rules. Instead of real sleeping it uses a fake clock, which lets tests verify the waiting behaviour instantly; the scripted fake client plays back a sequence of failures and successes.

```python
import random

RETRYABLE = {408, 429, 500, 502, 503, 504, 529}


class ApiError(Exception):
    def __init__(self, status: int, retry_after: float | None = None, code: str = ""):
        super().__init__(f"HTTP {status} {code}".strip())
        self.status = status
        self.retry_after = retry_after
        self.code = code


class FakeClock:
    """Lets tests 'sleep' instantly while recording how long the code would have waited."""
    def __init__(self):
        self.now = 0.0

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def call_with_retries(call, clock, max_attempts=5, base=0.5, cap=8.0, deadline=20.0, seed=0):
    rng = random.Random(seed)
    start = clock.now
    for attempt in range(1, max_attempts + 1):
        try:
            return call()
        except ApiError as error:
            quota_exhausted = error.code == "insufficient_quota"   # a 429 that waiting will not fix
            if error.status not in RETRYABLE or quota_exhausted or attempt == max_attempts:
                raise
            if error.retry_after is not None:
                delay = error.retry_after                                 # the server told us how long
            else:
                delay = rng.uniform(0, min(cap, base * 2 ** attempt))     # exponential backoff, full jitter
            if clock.now - start + delay > deadline:
                raise
            clock.sleep(delay)


class ScriptedClient:
    """Fake model client: returns or raises the scripted outcomes in order."""
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def __call__(self):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def run(name, outcomes, **kwargs):
    client, clock = ScriptedClient(outcomes), FakeClock()
    try:
        result = call_with_retries(client, clock, **kwargs)
    except ApiError as error:
        result = f"raised {error}"
    print(f"{name:<34} calls={client.calls}  waited={clock.now:5.2f}s  result={result}")
    return client.calls


assert run("429 with Retry-After, 503, success",
           [ApiError(429, retry_after=2.0), ApiError(503), "ok"]) == 3
assert run("400 bad request is not retried", [ApiError(400), "ok"]) == 1
assert run("quota exhausted is not retried", [ApiError(429, code="insufficient_quota"), "ok"]) == 1
assert run("503 forever gives up after 5 tries", [ApiError(503)] * 10) == 5
assert run("Retry-After beyond the deadline", [ApiError(429, retry_after=60.0), "ok"]) == 1
print("all retry policy checks passed")
```

Output:

```text
429 with Retry-After, 503, success calls=3  waited= 3.69s  result=ok
400 bad request is not retried     calls=1  waited= 0.00s  result=raised HTTP 400
quota exhausted is not retried     calls=1  waited= 0.00s  result=raised HTTP 429 insufficient_quota
503 forever gives up after 5 tries calls=5  waited= 6.11s  result=raised HTTP 503
Retry-After beyond the deadline    calls=1  waited= 0.00s  result=raised HTTP 429
all retry policy checks passed
```

Official SDKs include their own retry logic with configurable limits. Know their defaults and make sure your own wrapper does not multiply them: an SDK that retries twice inside a wrapper that retries five times makes up to 15 attempts per user request, which can turn a brief provider problem into a self-inflicted overload.

Two more reliability mechanisms deserve tests:

- **Timeouts at every level.** Connection timeout, read timeout between stream events, and an overall deadline per user request.
- **Fallback models.** If the primary model is unavailable, some systems switch to another model. The fallback model must pass the same evaluation suite; otherwise the fallback path is an untested product.

## Tokens, usage and cost

Providers charge per token, with separate prices for input and output tokens. Output tokens are usually several times more expensive. Cached input tokens (prompt caching: reusing an identical prompt prefix across requests) are discounted, and reasoning tokens are billed as output.

```text
cost per request = (uncached input tokens × input price
                    + cached input tokens × cached input price
                    + output tokens (including reasoning) × output price) / 1,000,000
```

Testers should own three cost measurements: cost per request, cost per conversation and, most important for the business, **cost per resolved task**. The model below uses example prices and a token budget measured from traces.

```python
# Example prices in USD per million tokens. Real prices change; read them from the provider's pricing page.
PRICES = {
    "large-model": {"input": 3.00, "cached_input": 0.30, "output": 15.00},
    "small-model": {"input": 0.25, "cached_input": 0.025, "output": 2.00},
}


def request_cost(model: str, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    price = PRICES[model]
    uncached = input_tokens - cached_tokens
    return (uncached * price["input"] + cached_tokens * price["cached_input"]
            + output_tokens * price["output"]) / 1_000_000


# Token budget of one assistant turn, measured from real traces
system_prompt, tool_definitions, history, retrieved, question = 1200, 400, 600, 2400, 50
input_tokens = system_prompt + tool_definitions + history + retrieved + question
output_tokens = 220

for model in PRICES:
    plain = request_cost(model, input_tokens, output_tokens)
    cached = request_cost(model, input_tokens, output_tokens, cached_tokens=system_prompt + tool_definitions)
    print(f"{model}: {input_tokens} in / {output_tokens} out -> ${plain:.5f} per request, "
          f"${cached:.5f} with prompt caching")

# What the business cares about: cost per resolved conversation, not per request
requests_per_conversation = 2.4
resolution_rate = 0.80
conversations_per_month = 50_000
per_request = request_cost("large-model", input_tokens, output_tokens)
per_resolved = per_request * requests_per_conversation / resolution_rate
monthly = per_request * requests_per_conversation * conversations_per_month
print(f"large-model: ${per_resolved:.4f} per resolved conversation, ${monthly:,.0f} per month")

# A prompt change that adds 1,500 tokens of instructions to every request
grown = request_cost("large-model", input_tokens + 1500, output_tokens)
print(f"prompt growth of 1,500 tokens: {grown / per_request - 1:+.0%} cost per request")
```

Output:

```text
large-model: 4650 in / 220 out -> $0.01725 per request, $0.01293 with prompt caching
small-model: 4650 in / 220 out -> $0.00160 per request, $0.00124 with prompt caching
large-model: $0.0517 per resolved conversation, $2,070 per month
prompt growth of 1,500 tokens: +26% cost per request
```

Two lessons follow. Retrieved context dominates the input in this budget, so retrieval settings (how many chunks, how long) are also cost settings. And an innocent-looking prompt edit can raise cost by a quarter; cost belongs in the regression report of every prompt change ([Production quality](/learn/llm?topic=production-quality)).

## Recording model calls for testing

You cannot test, debug or reproduce what you did not record. For every model call, log a record like this (with personal data redacted according to your privacy rules):

```json
{
  "trace_id": "3f9c1e7a",
  "span": "answer_generation",
  "timestamp": "2026-10-11T09:14:03Z",
  "provider": "example-provider",
  "model": "<pinned model id>",
  "parameters": {"temperature": 0, "max_tokens": 500},
  "prompt_template": {"id": "support-answer", "version": "v14"},
  "messages_hash": "sha256:9b1d…",
  "retrieved_chunk_ids": ["returns-policy#2", "returns-policy#5"],
  "tools_offered": ["get_order_status"],
  "tool_calls": [],
  "stop_reason": "end",
  "usage": {"input_tokens": 4650, "output_tokens": 220, "cached_input_tokens": 1600},
  "latency_ms": {"time_to_first_token": 640, "total": 2310},
  "retries": 0,
  "output_text": "You can return unworn shoes within 30 days…",
  "outcome": {"delivered": true, "user_feedback": null}
}
```

Each field answers a testing question: *which model and prompt produced this?* (model, template version, parameters), *what did it see?* (messages hash, retrieved IDs, tools), *why did it stop?* (stop reason), *what did it cost and how long did it take?* (usage, latency) and *what happened next?* (outcome). These records become regression cases ([Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)), replay fixtures for tests such as the stream example above, and the raw material of production monitoring ([Production quality](/learn/llm?topic=production-quality)).

### Worked example: an answer that quotes a replaced policy

Question from support: why did an answer quote a return policy that was replaced last week? The log record answers it field by field:

- `retrieved_chunk_ids` shows which policy chunks the model saw; the ID of an old chunk means the index was not refreshed.
- `timestamp` shows whether the call happened before or after the policy update and the reindex.
- `prompt_template.version` and `model` exclude the prompt and the model as causes.
- `output_text` confirms what exactly was quoted.
- If the old chunk was not retrieved, the model reproduced the old policy from training data or from the conversation history; the stored history and `messages_hash` show what was in the context.

## Choices that change testing

- **Pin model versions.** Providers offer dated snapshot IDs and moving aliases. Production should use a pinned snapshot, and moving to a new one is a migration with a full evaluation run.
- **Track deprecations.** Providers retire models on published schedules. A retired model ID returns an error (often 404). Keep a calendar of retirement dates for every model you use, including judge and fallback models.
- **Local and OpenAI-compatible endpoints.** Tools such as Ollama expose an OpenAI-compatible API for local models, which is useful for free practice and offline integration tests. Behaviour, limits and error formats still differ from the production provider, so they cannot replace tests against the real one.
- **Gateways.** A gateway or abstraction library normalizes providers, adds retries, budgets and logging in one place, and makes provider switches cheaper to test.

## Common mistakes

- **Delivering truncated output** because the stop reason is never checked.
- **Retrying non-retryable errors**, or retrying without backoff, jitter, attempt limits or a deadline.
- **Layered retries** (SDK plus wrapper plus queue) that multiply attempts during incidents.
- **Untested fallback models.**
- **Measuring cost per request only**, not per conversation and per resolved task.
- **Logging too little** (no model version or prompt version) or too much (raw personal data without redaction and retention limits).

## Summary

- An LLM application is mostly deterministic software around probabilistic model calls; test that software with conventional techniques.
- Chat APIs share one shape: messages with roles, parameters, content, stop reason and usage. Normalize provider differences at the edge.
- Every stop reason needs explicit handling and a test; truncated output must never be delivered as complete.
- Streaming needs tests for interruption, partial structured output, late usage data and latency measurement.
- Retry only retryable errors, with backoff, jitter, limits and deadlines; protect side effects; test with a fake clock.
- Cost is a quality attribute: measure it per request, per conversation and per resolved task.
- Record model, version, prompt version, parameters, context identifiers, stop reason, usage and latency for every call.
