"""A minimal client for an OpenAI-compatible chat endpoint, used to demonstrate record and replay.

Chapter: Testing LLM code without the model (record and replay)
https://gimme-job.com/learn/llm?topic=testing-without-the-model
"""

import json
import urllib.request

from assistant import Reply
from contracts import from_openai_chat


class OpenAICompatibleClient:
    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def complete(self, messages: list[dict]) -> Reply:
        payload = json.dumps({"model": self.model, "messages": messages}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/v1/chat/completions",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"},
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            return from_openai_chat(json.loads(response.read().decode("utf-8")))
