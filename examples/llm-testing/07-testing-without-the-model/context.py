"""Context assembly: what the model sees, within a token budget.

Chapter: Testing LLM code without the model (testing context assembly)
https://gimme-job.com/learn/llm?topic=testing-without-the-model
"""


def count_tokens(text: str) -> int:
    """Deterministic stand-in for the provider tokenizer (about four characters per token).
    Production tests should use the real tokenizer: a wrong estimate is itself a common defect."""
    return max(1, len(text) // 4)


def build_messages(system: str, history: list[dict], question: str, budget: int) -> list[dict]:
    """Keep the system prompt and the new question; add history from newest to oldest while it fits."""
    fixed = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    used = sum(count_tokens(message["content"]) for message in fixed)
    if used > budget:
        raise ValueError("system prompt and question alone exceed the budget")
    kept: list[dict] = []
    for message in reversed(history):
        cost = count_tokens(message["content"])
        if used + cost > budget:
            break
        kept.append(message)
        used += cost
    return [fixed[0], *reversed(kept), fixed[1]]
