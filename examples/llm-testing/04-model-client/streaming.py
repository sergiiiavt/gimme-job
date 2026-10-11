"""Assemble a streamed response from recorded events and measure its latency.

Chapter: LLM application anatomy and APIs (streaming)
https://gimme-job.com/learn/llm?topic=llm-application-anatomy

Recorded streams (fixtures/*.jsonl) are replayed through the same code that handles live streams,
so streaming behaviour is tested without network access.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AssembledStream:
    text: str
    complete: bool
    stop_reason: str | None
    time_to_first_token_s: float | None
    total_s: float
    output_tokens: int | None
    tool_calls: list[dict] = field(default_factory=list)
    error: str | None = None


def load_events(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def assemble(events: list[dict]) -> AssembledStream:
    text: list[str] = []
    partial_tools: dict[int, dict] = {}
    first_token_at = None
    stop_reason = None
    output_tokens = None
    error = None
    for event in events:
        kind = event["type"]
        if kind == "text_delta":
            if first_token_at is None:
                first_token_at = event["at"]
            text.append(event["text"])
        elif kind == "tool_delta":
            tool = partial_tools.setdefault(event["index"], {"name": event.get("name"), "arguments": ""})
            tool["arguments"] += event["arguments"]
        elif kind == "stop":
            stop_reason = event["stop_reason"]
            output_tokens = event.get("output_tokens")
        elif kind == "error":
            error = event["message"]
    tool_calls = [{"name": tool["name"], "arguments": json.loads(tool["arguments"])}
                  for _, tool in sorted(partial_tools.items())] if stop_reason == "tool_use" else []
    return AssembledStream(
        text="".join(text),
        complete=stop_reason is not None and error is None,
        stop_reason=stop_reason,
        time_to_first_token_s=first_token_at,
        total_s=events[-1]["at"] if events else 0.0,
        output_tokens=output_tokens,
        tool_calls=tool_calls,
        error=error,
    )
