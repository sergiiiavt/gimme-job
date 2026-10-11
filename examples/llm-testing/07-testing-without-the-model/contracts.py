"""Normalize provider response bodies into one shape, tested against contract fixtures.

Chapter: Testing LLM code without the model (contract fixtures for provider responses)
https://gimme-job.com/learn/llm?topic=testing-without-the-model
"""

import json

from assistant import Reply

OPENAI_STOP = {"stop": "end", "length": "max_tokens", "tool_calls": "tool_use", "content_filter": "blocked"}
ANTHROPIC_STOP = {"end_turn": "end", "stop_sequence": "end", "max_tokens": "max_tokens",
                  "model_context_window_exceeded": "max_tokens", "tool_use": "tool_use", "refusal": "blocked"}


def from_openai_chat(body: dict) -> Reply:
    choice = body["choices"][0]
    message = choice["message"]
    calls = [{"name": call["function"]["name"], "arguments": json.loads(call["function"]["arguments"])}
             for call in message.get("tool_calls") or []]
    usage = body.get("usage") or {}
    return Reply(text=message.get("content") or "", stop_reason=OPENAI_STOP.get(choice.get("finish_reason"), "unknown"),
                 tool_calls=calls, input_tokens=usage.get("prompt_tokens", 0), output_tokens=usage.get("completion_tokens", 0))


def from_anthropic_messages(body: dict) -> Reply:
    blocks = body.get("content") or []
    text = "".join(block["text"] for block in blocks if block["type"] == "text")
    calls = [{"name": block["name"], "arguments": block["input"]} for block in blocks if block["type"] == "tool_use"]
    usage = body.get("usage") or {}
    return Reply(text=text, stop_reason=ANTHROPIC_STOP.get(body.get("stop_reason"), "unknown"), tool_calls=calls,
                 input_tokens=usage.get("input_tokens", 0), output_tokens=usage.get("output_tokens", 0))
