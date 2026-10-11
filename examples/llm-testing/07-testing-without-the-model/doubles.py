"""Test doubles for model clients: dummy, stub, scripted stub, spy, mock, fake and fault injector.

Chapter: Testing LLM code without the model (test doubles for model clients)
https://gimme-job.com/learn/llm?topic=testing-without-the-model
"""

from dataclasses import dataclass, field

from assistant import Reply


class DummyClient:
    """Dummy: for paths that must never reach the model. Calling it is a test failure."""
    def complete(self, messages: list[dict]) -> Reply:
        raise AssertionError("the model must not be called on this path")


class StubClient:
    """Stub: always returns the same canned reply."""
    def __init__(self, reply: Reply):
        self.reply = reply

    def complete(self, messages: list[dict]) -> Reply:
        return self.reply


class ScriptedClient:
    """Stub that returns a different scripted reply on each call (multi-step flows such as tool use)."""
    def __init__(self, *replies: Reply):
        self.replies = list(replies)

    def complete(self, messages: list[dict]) -> Reply:
        if not self.replies:
            raise AssertionError("more model calls than scripted")
        return self.replies.pop(0)


@dataclass
class SpyClient:
    """Spy: wraps another client and records every call."""
    inner: object
    calls: list[list[dict]] = field(default_factory=list)

    def complete(self, messages: list[dict]) -> Reply:
        self.calls.append([dict(message) for message in messages])
        return self.inner.complete(messages)


class MockClient:
    """Mock: programmed with an expectation about the number of calls, verified at the end."""
    def __init__(self, reply: Reply, expected_calls: int):
        self.reply = reply
        self.expected_calls = expected_calls
        self.actual_calls = 0

    def complete(self, messages: list[dict]) -> Reply:
        self.actual_calls += 1
        return self.reply

    def verify(self) -> None:
        assert self.actual_calls == self.expected_calls, (
            f"expected {self.expected_calls} model calls, got {self.actual_calls}")


class FailingClient:
    """Fault injector: raises the given exception on every call."""
    def __init__(self, error: Exception):
        self.error = error

    def complete(self, messages: list[dict]) -> Reply:
        raise self.error


class RuleBasedFake:
    """Fake: a simplified working implementation with predictable answers."""
    def complete(self, messages: list[dict]) -> Reply:
        question = messages[-1]["content"].lower()
        if "return" in question:
            return Reply("Unworn shoes can be returned within 30 days of delivery.", input_tokens=120, output_tokens=12)
        return Reply("I cannot confirm that. Shall I connect you with a colleague?", input_tokens=110, output_tokens=12)
