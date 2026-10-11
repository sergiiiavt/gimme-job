"""A small support assistant built around an injected model client: the testing seam.

Chapter: Testing LLM code without the model
https://gimme-job.com/learn/llm?topic=testing-without-the-model
"""

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

from context import build_messages
from tools import run_tool_call

SYSTEM_TEMPLATE = """You are the customer-support assistant of Stride, an online shoe store.
Answer only from the policy below. If it does not cover the question, offer a human agent.

<policy>
{policy}
</policy>"""
REFUSAL = "I can only help with Stride orders, returns, delivery and sizes."
UNAVAILABLE = "Sorry, the assistant is not available right now. Please try again."
INCOMPLETE = "Sorry, I could not finish the answer. Please try again."


@dataclass
class Reply:
    text: str = ""
    stop_reason: str = "end"                       # normalized: end, max_tokens, tool_use, blocked
    tool_calls: list[dict] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0


class ModelClient(Protocol):
    def complete(self, messages: list[dict]) -> Reply: ...


@dataclass
class Answer:
    text: str
    events: list[str]
    usage: tuple[int, int] = (0, 0)


def render_system(policy: str) -> str:
    return SYSTEM_TEMPLATE.format(policy=policy.strip())


@dataclass
class SupportAssistant:
    client: ModelClient
    policy: str
    is_blocked: Callable[[str], bool] = lambda text: False     # input guardrail
    budget: int = 2000
    max_tool_rounds: int = 2

    def answer(self, question: str, user_id: str, history: list[dict] | None = None) -> Answer:
        events: list[str] = []
        if self.is_blocked(question):
            events.append("blocked_by_input_guardrail")
            return Answer(REFUSAL, events)

        messages = build_messages(render_system(self.policy), history or [], question, self.budget)
        input_tokens = output_tokens = 0
        for _ in range(self.max_tool_rounds + 1):
            try:
                reply = self.client.complete(messages)
            except TimeoutError:
                events.append("model_timeout")
                return Answer(UNAVAILABLE, events, (input_tokens, output_tokens))
            input_tokens += reply.input_tokens
            output_tokens += reply.output_tokens
            events.append(f"model_call:{reply.stop_reason}")

            if reply.stop_reason == "end":
                return Answer(reply.text.strip(), events, (input_tokens, output_tokens))
            if reply.stop_reason != "tool_use" or not reply.tool_calls:
                return Answer(INCOMPLETE, events, (input_tokens, output_tokens))

            for call in reply.tool_calls:
                result = run_tool_call(call, user_id=user_id)       # identity from the session
                events.append(f"tool:{call.get('name')}:{'error' if 'error' in result else 'ok'}")
                messages.append({"role": "tool", "content": json.dumps(result)})

        events.append("tool_round_limit")
        return Answer(INCOMPLETE, events, (input_tokens, output_tokens))
