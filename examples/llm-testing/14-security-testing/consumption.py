"""Limits against unbounded consumption: input size, output cap, and a per-user token budget.

Chapter: Security, red teaming and guardrails (unbounded consumption)
https://gimme-job.com/learn/llm?topic=security-red-teaming
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str = ""
    max_output_tokens: int = 0


def estimate_tokens(text: str) -> int:
    """A deliberate overestimate for limits: about four characters per token, at least one per word."""
    return max(len(text) // 4 + 1, len(text.split()))


class UsageLimiter:
    """Refuses oversized inputs and spends a per-user budget of tokens that refills over time.
    The clock is injected so that tests control time."""

    def __init__(self, clock, max_input_tokens: int = 2_000, max_output_tokens: int = 800,
                 budget_tokens: int = 20_000, refill_per_second: float = 5.0) -> None:
        self.clock = clock
        self.max_input_tokens, self.max_output_tokens = max_input_tokens, max_output_tokens
        self.budget_tokens, self.refill_per_second = budget_tokens, refill_per_second
        self.balances: dict[str, tuple[float, float]] = {}  # user -> (tokens, last update)

    def _balance(self, user: str) -> float:
        tokens, updated = self.balances.get(user, (self.budget_tokens, self.clock()))
        now = self.clock()
        return min(self.budget_tokens, tokens + (now - updated) * self.refill_per_second)

    def check(self, user: str, message: str) -> Decision:
        needed = estimate_tokens(message)
        if needed > self.max_input_tokens:
            return Decision(False, f"input of about {needed} tokens is above the limit of {self.max_input_tokens}")
        cost = needed + self.max_output_tokens  # reserve the worst case
        balance = self._balance(user)
        if cost > balance:
            return Decision(False, f"budget exhausted: {balance:.0f} tokens left, {cost} needed")
        self.balances[user] = (balance - cost, self.clock())
        return Decision(True, max_output_tokens=self.max_output_tokens)
