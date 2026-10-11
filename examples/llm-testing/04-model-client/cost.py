"""Token cost per request, per conversation and per resolved task.

Chapter: LLM application anatomy and APIs (tokens, usage and cost)
https://gimme-job.com/learn/llm?topic=llm-application-anatomy

Prices below are examples in USD per million tokens. Read real prices from the provider's
pricing page and keep them in configuration, not in code.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Price:
    input: float
    cached_input: float
    output: float


EXAMPLE_PRICES = {
    "large-model": Price(input=3.00, cached_input=0.30, output=15.00),
    "small-model": Price(input=0.25, cached_input=0.025, output=2.00),
}


def request_cost(price: Price, input_tokens: int, output_tokens: int, cached_tokens: int = 0) -> float:
    if not 0 <= cached_tokens <= input_tokens:
        raise ValueError("cached tokens must be between 0 and the input tokens")
    uncached = input_tokens - cached_tokens
    return (uncached * price.input + cached_tokens * price.cached_input + output_tokens * price.output) / 1_000_000


def cost_per_resolved_task(cost_per_request: float, requests_per_task: float, resolution_rate: float) -> float:
    """What a successfully resolved conversation costs, including the conversations that fail."""
    if not 0 < resolution_rate <= 1:
        raise ValueError("resolution rate must be in (0, 1]")
    return cost_per_request * requests_per_task / resolution_rate
