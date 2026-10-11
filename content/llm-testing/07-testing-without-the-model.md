# Testing LLM code without the model

Most of the code in an LLM application never needs a model to be tested. Prompt rendering, context assembly, history truncation, output parsing, tool routing and authorization, retries, streaming, guardrail wiring, logging and cost accounting are deterministic, and their defects are ordinary defects: wrong branches, missing checks, off-by-one budgets. Testing them through a real model is slow, expensive and flaky, and it hides the cause of a failure behind the randomness of generation.

This chapter shows how to test that code quickly, offline and deterministically: test doubles for model clients, dependency injection, invariant tests for context assembly, snapshot tests for prompts, record and replay of real HTTP traffic, contract fixtures for provider responses, and a test-suite layout that separates offline tests from live checks and quality evaluation.

**Prerequisites:** [LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy), [Structured output and validation](/learn/llm?topic=structured-output-validation), and basic pytest.

## What to test without a model

| Component | Behaviour to verify | Test double needed |
|---|---|---|
| Prompt rendering | Every template renders with realistic and hostile values; structure stays intact | None |
| Context assembly | System prompt kept, budget respected, newest turns kept in order, right user's data | None, or a fake tokenizer |
| Output parsing and validation | Every recorded output shape is accepted or rejected correctly | Recorded outputs |
| Stop-reason handling | Each stop reason leads to the specified action | Stub responses |
| Tool routing and authorization | Unknown tools, invalid arguments and other users' data are rejected | Scripted tool calls |
| Retries and timeouts | Only retryable errors are retried, within attempt and time limits | Failing client, fake clock |
| Streaming | Interrupted streams are never shown as complete | Recorded streams |
| Guardrail wiring | Blocked inputs never reach the model; blocked outputs never reach the user | Stub classifier |
| Logging and tracing | Every call records model, prompt version, usage and context identifiers | Spy |
| Fallbacks | Primary model failure switches to the fallback path | Failing client |

None of these tests says whether the model's answers are good. That is the job of evaluation ([Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)). The two kinds of testing complement each other: offline tests make the system reliable, evaluations make it useful.

## Test doubles for model clients

A **test double** replaces a real dependency in a test. The classic vocabulary distinguishes several kinds, and each has a clear use for model clients:

| Double | What it does | Typical use with a model client |
|---|---|---|
| Dummy | Fills a parameter that the test path never uses | A client passed to code that should not call it at all |
| Stub | Returns canned answers | Exercising parsing and post-processing of a known response |
| Spy | Records how it was called, often wrapping another double | Asserting what was sent: messages, parameters, tools, prompt version |
| Mock | Is programmed with expectations and fails when they are not met | Verifying that a call happens exactly once or never |
| Fake | A working, simplified implementation | Rule-based answers for many inputs; an in-memory order database for tools |
| Fault injector | Raises errors or returns malformed data | Timeouts, rate limits, truncated and invalid responses |

The precondition is a **seam**: the code under test must receive its client instead of creating it. The function below takes `client` as a parameter, so any double can be injected.

```python
from dataclasses import dataclass, field


@dataclass
class Reply:
    text: str
    stop_reason: str = "end"


class StubClient:
    """Stub: always returns the same canned reply."""
    def __init__(self, text: str):
        self.reply = Reply(text)

    def complete(self, messages: list[dict]) -> Reply:
        return self.reply


@dataclass
class SpyClient:
    """Spy: wraps another client and records every call it receives."""
    inner: object = None
    calls: list = field(default_factory=list)

    def complete(self, messages: list[dict]) -> Reply:
        self.calls.append(messages)
        return self.inner.complete(messages)


class FailingClient:
    """Fault injector: raises the given error on every call."""
    def __init__(self, error: Exception):
        self.error = error

    def complete(self, messages: list[dict]) -> Reply:
        raise self.error


class RuleBasedFake:
    """Fake: a working, simplified implementation with predictable behaviour."""
    def complete(self, messages: list[dict]) -> Reply:
        question = messages[-1]["content"].lower()
        if "return" in question:
            return Reply("Unworn shoes can be returned within 30 days of delivery.")
        return Reply("I cannot confirm that. Shall I connect you with a colleague?")


# The code under test receives its client: dependency injection is the testing seam.
def answer_question(question: str, client, policy: str) -> str:
    messages = [
        {"role": "system", "content": f"Answer only from this policy:\n{policy}"},
        {"role": "user", "content": question},
    ]
    try:
        reply = client.complete(messages)
    except TimeoutError:
        return "Sorry, the assistant is not available right now. Please try again."
    if reply.stop_reason != "end":
        return "Sorry, I could not finish the answer. Please try again."
    return reply.text.strip()


policy = "Unworn shoes: 30 days from delivery."

# 1. Stub: the parsing and post-processing path
assert answer_question("Can I return shoes?", StubClient("  Yes, within 30 days.  "), policy) == "Yes, within 30 days."

# 2. Spy: what exactly was sent to the model
spy = SpyClient(RuleBasedFake())
answer_question("Can I return shoes?", spy, policy)
sent = spy.calls[0]
assert sent[0]["role"] == "system" and policy in sent[0]["content"]
assert sent[-1] == {"role": "user", "content": "Can I return shoes?"}

# 3. Fault injection: the timeout path
assert "not available" in answer_question("Hi", FailingClient(TimeoutError()), policy)

# 4. Fake: behaviour across several inputs without a model
fake = RuleBasedFake()
assert "30 days" in answer_question("Can I return worn shoes?", fake, policy)
assert "colleague" in answer_question("Do you ship to Mars?", fake, policy)
print("stub, spy, fault injection and fake: all checks passed")
```

Output:

```text
stub, spy, fault injection and fake: all checks passed
```

### Creating the seam

If code creates its client internally, tests have to patch it. Prefer moving creation to the edge of the application:

```python
# Hard to test: the client is created inside the function.
def answer_question(question: str) -> str:
    client = OpenAI()                       # every test needs patching and network
    ...

# Testable: the client is a parameter with a production default created at startup.
class SupportAssistant:
    def __init__(self, client: ModelClient, retriever: Retriever, clock: Clock):
        self.client, self.retriever, self.clock = client, retriever, clock
```

When you cannot change the code yet, pytest's `monkeypatch` fixture can replace a module attribute for one test. Treat that as a temporary measure: tests that patch internals break whenever the internals are refactored.

```python
def test_answer_uses_the_fallback_message_on_timeout(monkeypatch):
    monkeypatch.setattr(support, "create_client", lambda: FailingClient(TimeoutError()))
    assert "not available" in support.answer_question("Hi")
```

### Mocks: use them for interactions, not for answers

A mock that asserts the exact text of a prompt couples the test to an implementation detail; every harmless prompt edit breaks it. Use mocks and spies to verify **interactions that matter**: the model is not called when the input guardrail blocks; the tool is called with the authenticated user's ID; the fallback model is called after the primary fails. Verify the exact prompt text with snapshot tests instead, where changes are reviewed deliberately (see below).

## Testing context assembly

Context assembly decides what the model sees: system prompt, conversation history, retrieved documents, user profile, tool definitions, within a token budget. Its defects are silent: a dropped system prompt or another user's data in the context does not raise an exception, it changes behaviour.

Test it with **invariants** that must hold for every conversation, and check them on many generated conversations:

```python
import random


def count_tokens(text: str) -> int:
    """Deterministic stand-in for the real tokenizer (about four characters per token)."""
    return max(1, len(text) // 4)


def build_messages(system: str, history: list[dict], question: str, budget: int) -> list[dict]:
    """Keep the system prompt and the new question; add history from newest to oldest while it fits."""
    fixed = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    used = sum(count_tokens(m["content"]) for m in fixed)
    if used > budget:
        raise ValueError("system prompt and question alone exceed the budget")
    kept = []
    for message in reversed(history):
        cost = count_tokens(message["content"])
        if used + cost > budget:
            break
        kept.append(message)
        used += cost
    return [fixed[0], *reversed(kept), fixed[1]]


def check_invariants(messages: list[dict], system: str, history: list[dict], question: str, budget: int) -> None:
    assert messages[0] == {"role": "system", "content": system}, "system prompt must survive"
    assert messages[-1] == {"role": "user", "content": question}, "new question must be last"
    assert sum(count_tokens(m["content"]) for m in messages) <= budget, "budget must hold"
    middle = messages[1:-1]
    assert middle == history[len(history) - len(middle):], "only the newest turns, in original order"


# Example-based test
history = [{"role": "user", "content": "Hi " * 30}, {"role": "assistant", "content": "Hello! " * 30},
           {"role": "user", "content": "Order A-1042?"}, {"role": "assistant", "content": "It ships today."}]
messages = build_messages("Answer from the policy.", history, "And returns?", budget=40)
print([m["content"][:16] for m in messages])
check_invariants(messages, "Answer from the policy.", history, "And returns?", 40)

# Randomized test: many conversations, the same invariants
rng = random.Random(4)
for _ in range(500):
    turns = [{"role": rng.choice(["user", "assistant"]), "content": "w" * rng.randint(1, 400)}
             for _ in range(rng.randint(0, 30))]
    budget = rng.randint(20, 600)
    question = "q" * rng.randint(1, 60)
    try:
        check_invariants(build_messages("system rules", turns, question, budget), "system rules", turns, question, budget)
    except ValueError:
        assert count_tokens("system rules") + count_tokens(question) > budget
print("500 random conversations: invariants hold")
```

Output:

```text
['Answer from the ', 'Order A-1042?', 'It ships today.', 'And returns?']
500 random conversations: invariants hold
```

Other invariants worth checking in real systems: retrieved documents belong to the requesting tenant; personal data is redacted before it enters the context; tool definitions match the user's permissions; the context never exceeds the model's window minus the reserved output budget. For production code, use the provider's real tokenizer in these tests; a wrong token estimate is itself a common defect.

## Snapshot tests for prompts

A **snapshot** (golden-file) test renders a prompt for fixed inputs and compares it with a committed file. Any change to the rendered text fails the test until someone reviews the difference and updates the snapshot. This catches unintended changes: a refactoring that drops a rule, a template variable that renders as empty, an example accidentally duplicated.

```python
# pip install syrupy
def test_support_prompt_snapshot(snapshot):
    rendered = render_system(policy_chunks=["Returns: 30 days from delivery."], few_shot_examples=["Q: ... A: ..."])
    assert rendered == snapshot          # pytest --snapshot-update rewrites the file after review
```

Snapshots have one well-known failure mode: people update them without reading the diff. Keep them small (one snapshot per template, with short fixed inputs), review snapshot diffs like prompt diffs ([Prompts as testable artifacts](/learn/llm?topic=prompts-as-artifacts)), and never use snapshots for model output, which varies by design.

## Record and replay

Some tests need real HTTP traffic: the integration between your client wrapper and the provider SDK, request headers, error bodies, streaming formats. **Record and replay** captures real interactions once and replays them afterwards. With vcrpy (or the pytest-recording plugin built on it), a test runs against the real API the first time and stores the exchange in a cassette file; later runs replay the cassette without network access.

```python
# pip install vcrpy
import vcr

replay = vcr.VCR(
    cassette_library_dir="tests/cassettes",
    record_mode="none",                       # CI: never touch the network; fail if a cassette is missing
    filter_headers=["authorization", "x-api-key", "openai-organization"],
    match_on=["method", "scheme", "host", "path", "body"],
)


@replay.use_cassette("refund_question.yaml")
def test_client_wrapper_parses_a_real_response():
    response = assistant.client.complete([{"role": "user", "content": "Can I return worn shoes?"}])
    assert response.stop_reason == "end"
    assert response.input_tokens > 0
```

Rules that keep cassettes safe and useful:

- **Filter secrets** (API keys, organization IDs, cookies) before the first recording, and scan cassettes in CI for anything that looks like a key.
- **Record deliberately.** Use a mode that records only when explicitly asked (`once` locally, `none` in CI), so a test never silently calls a paid API.
- **Match on the request body.** Otherwise a changed prompt replays an old answer and the test passes for the wrong reason.
- **Re-record on purpose,** for example when upgrading the SDK, and review the cassette diff.
- **Do not assert on generated text** in replayed tests beyond what the parsing code handles. The replayed answer was produced once by a model; it is a fixture, not a quality measurement.

## Contract fixtures for provider responses

Recorded cassettes show common responses. Rare shapes, such as tool calls, refusals, truncation, content filters, multiple tool calls and empty content, may never appear in your recordings, yet your parsing code must handle them. **Contract fixtures** are response bodies in the shape the provider documents, stored as JSON files and used to test the normalization code. When the SDK or API version changes, compare new real responses with the fixtures.

```python
import json

# Contract fixtures: response bodies in the shape the providers document, saved as JSON files.
# They let the parsing code be tested against every shape it must handle, including rare ones.
OPENAI_TOOL_CALL = """{
  "choices": [{"finish_reason": "tool_calls", "message": {"role": "assistant", "content": null,
    "tool_calls": [{"id": "call_1", "type": "function",
      "function": {"name": "get_order_status", "arguments": "{\\"order_id\\": \\"A-1042\\"}"}}]}}],
  "usage": {"prompt_tokens": 812, "completion_tokens": 19}
}"""
ANTHROPIC_TOOL_CALL = """{
  "stop_reason": "tool_use",
  "content": [{"type": "text", "text": "Let me check."},
              {"type": "tool_use", "id": "toolu_1", "name": "get_order_status", "input": {"order_id": "A-1042"}}],
  "usage": {"input_tokens": 790, "output_tokens": 24}
}"""
ANTHROPIC_REFUSAL = """{"stop_reason": "refusal", "content": [], "usage": {"input_tokens": 50, "output_tokens": 0}}"""


def normalize_openai(body: dict) -> dict:
    choice = body["choices"][0]
    calls = [{"name": c["function"]["name"], "arguments": json.loads(c["function"]["arguments"])}
             for c in choice["message"].get("tool_calls") or []]
    return {"text": choice["message"].get("content") or "", "stop": choice["finish_reason"],
            "tool_calls": calls, "tokens": (body["usage"]["prompt_tokens"], body["usage"]["completion_tokens"])}


def normalize_anthropic(body: dict) -> dict:
    text = "".join(block["text"] for block in body["content"] if block["type"] == "text")
    calls = [{"name": block["name"], "arguments": block["input"]}
             for block in body["content"] if block["type"] == "tool_use"]
    return {"text": text, "stop": body["stop_reason"], "tool_calls": calls,
            "tokens": (body["usage"]["input_tokens"], body["usage"]["output_tokens"])}


openai = normalize_openai(json.loads(OPENAI_TOOL_CALL))
anthropic = normalize_anthropic(json.loads(ANTHROPIC_TOOL_CALL))
refusal = normalize_anthropic(json.loads(ANTHROPIC_REFUSAL))

# The same logical event must look the same after normalization, whatever the provider.
assert openai["tool_calls"] == anthropic["tool_calls"] == [{"name": "get_order_status", "arguments": {"order_id": "A-1042"}}]
assert openai["text"] == "" and anthropic["text"] == "Let me check."      # OpenAI content is null here
assert refusal == {"text": "", "stop": "refusal", "tool_calls": [], "tokens": (50, 0)}
print("openai   :", openai)
print("anthropic:", anthropic)
```

Output:

```text
openai   : {'text': '', 'stop': 'tool_calls', 'tool_calls': [{'name': 'get_order_status', 'arguments': {'order_id': 'A-1042'}}], 'tokens': (812, 19)}
anthropic: {'text': 'Let me check.', 'stop': 'tool_use', 'tool_calls': [{'name': 'get_order_status', 'arguments': {'order_id': 'A-1042'}}], 'tokens': (790, 24)}
```

Note two details that contract fixtures catch and happy-path tests do not: OpenAI returns `content: null` when the model only calls tools, and tool arguments arrive as a JSON **string** that must be parsed (and can be invalid). Anthropic returns arguments as an object, and text and tool calls can share one response.

## Testing tool routing and authorization

When the model requests a tool call, the request is **untrusted input**: the model can choose a tool that does not exist, send invalid arguments, or be manipulated into asking for another customer's data. The router that executes tool calls is security-critical code and is fully testable without a model.

```python
ORDERS = {"A-1042": {"owner": "u-17", "status": "shipped"}, "A-2001": {"owner": "u-99", "status": "packed"}}


class ToolError(Exception):
    """Returned to the model as a tool result; never shown raw to the user."""


def get_order_status(order_id: str, *, user_id: str) -> dict:
    order = ORDERS.get(order_id)
    if order is None or order["owner"] != user_id:          # one answer for missing and foreign orders
        raise ToolError("order not found")
    return {"order_id": order_id, "status": order["status"]}


TOOLS = {"get_order_status": {"function": get_order_status, "required": {"order_id": str}}}


def run_tool_call(call: dict, user_id: str) -> dict:
    """Validate a tool call requested by the model and execute it for the CURRENT user only."""
    spec = TOOLS.get(call.get("name"))
    if spec is None:
        return {"error": f"unknown tool {call.get('name')!r}"}
    arguments = call.get("arguments")
    if not isinstance(arguments, dict) or set(arguments) != set(spec["required"]):
        return {"error": "invalid arguments"}
    if not all(isinstance(arguments[k], t) for k, t in spec["required"].items()):
        return {"error": "invalid argument types"}
    try:
        return {"result": spec["function"](**arguments, user_id=user_id)}
    except ToolError as error:
        return {"error": str(error)}


cases = [
    ("own order", {"name": "get_order_status", "arguments": {"order_id": "A-1042"}}),
    ("order of another customer", {"name": "get_order_status", "arguments": {"order_id": "A-2001"}}),
    ("model injects user_id", {"name": "get_order_status", "arguments": {"order_id": "A-2001", "user_id": "u-99"}}),
    ("unknown tool", {"name": "issue_refund", "arguments": {"order_id": "A-1042"}}),
    ("wrong argument type", {"name": "get_order_status", "arguments": {"order_id": 1042}}),
]
for name, call in cases:
    print(f"{name:<26} -> {run_tool_call(call, user_id='u-17')}")
```

Output:

```text
own order                  -> {'result': {'order_id': 'A-1042', 'status': 'shipped'}}
order of another customer  -> {'error': 'order not found'}
model injects user_id      -> {'error': 'invalid arguments'}
unknown tool               -> {'error': "unknown tool 'issue_refund'"}
wrong argument type        -> {'error': 'invalid argument types'}
```

The design decisions that the tests protect:

- **The user identity comes from the authenticated session, never from the model.** The third case shows a model trying to pass `user_id` itself; the router rejects any argument it does not expect.
- **"Not found" and "not yours" give the same answer,** so the tool cannot be used to discover which order IDs exist.
- **Errors go back to the model as tool results** so it can explain the situation to the user, and they are logged for monitoring.

## Time, randomness and concurrency

Three more sources of flaky tests have standard remedies:

- **Time.** Inject a clock. Retry and timeout logic tested with a fake clock runs instantly and deterministically ([LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy) shows a complete example). Date-dependent behaviour ("your return window ends tomorrow") needs a fixed "now".
- **Randomness.** Seed every random generator used in tests, including sampling in fakes and data generators, and print the seed on failure.
- **Asynchrony.** Streaming and parallel tool calls are usually asynchronous. Test them with an async test runner (for example pytest-asyncio), drive streams from recorded events, and test cancellation explicitly: a cancelled request must stop consuming the stream and must not leave half-written state.

## Organizing the test suite

Separate tests by what they need and how often they run:

| Layer | Needs | Speed | When it runs | Example |
|---|---|---|---|---|
| Unit (offline) | Nothing external | Milliseconds | Every commit | Parsing, routing, context assembly with doubles |
| Recorded integration | Cassettes and fixtures | Seconds | Every commit | SDK wrapper against replayed traffic |
| Live smoke | API key, network | Seconds, costs money | Nightly and before release | One real call per provider path: stop reasons, usage, structured output |
| Evaluation | Datasets, model, scorers | Minutes to hours | Pull requests that change behaviour, nightly | Quality metrics with thresholds |

Markers make the layers explicit, and the default run stays offline:

```toml
[tool.pytest.ini_options]
addopts = "-m 'not live and not eval'"
markers = [
  "live: calls a real model provider; needs API keys",
  "eval: runs an evaluation dataset against a model",
]
```

Run `pytest -m live` or `pytest -m eval` deliberately, in the pipeline stages described in [Production quality](/learn/llm?topic=production-quality).

## Example project

The method of this chapter is implemented and tested in [examples/llm-testing/07-testing-without-the-model](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/07-testing-without-the-model): a support assistant built around an injected model client, all six kinds of test doubles, context-assembly invariants checked with Hypothesis, a prompt snapshot, provider contract fixtures, a router that enforces tool authorization, and a record-and-replay test that runs offline from a committed cassette. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/07-testing-without-the-model
```

## Common mistakes

- **Testing deterministic code through a real model,** which makes tests slow, costly and flaky, and hides the cause of failures.
- **Creating the client inside business logic,** so that tests can only patch internals.
- **Mocking exact prompt text** in behavioural tests, so that every prompt edit breaks unrelated tests.
- **Cassettes with secrets,** or cassettes that do not match on the request body.
- **Only happy-path response fixtures:** no tool-call, refusal, truncation or null-content shapes.
- **Trusting tool arguments from the model,** including identity or permission fields.
- **One undifferentiated test suite** that mixes offline tests, paid live calls and slow evaluations.

## Summary

- Most LLM application code is deterministic; test it offline, with test doubles, in milliseconds.
- Dependency injection creates the seam. Use stubs for canned responses, spies to check what was sent, fakes for realistic behaviour, fault injectors for failures and mocks only for interactions that matter.
- Test context assembly with invariants over many generated conversations.
- Snapshot tests catch unintended prompt changes; review their diffs deliberately.
- Record and replay real traffic with filtered secrets and body matching; cover rare response shapes with contract fixtures.
- The tool router is security-critical: identity from the session, strict argument validation, uniform errors.
- Separate unit, recorded, live and evaluation layers with markers, and keep the default run offline.
