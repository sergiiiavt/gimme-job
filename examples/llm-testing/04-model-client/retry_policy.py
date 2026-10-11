"""A bounded retry policy for model API calls, testable without waiting.

Chapter: LLM application anatomy and APIs (errors, retries and timeouts)
https://gimme-job.com/learn/llm?topic=llm-application-anatomy

Rules: retry only retryable errors; exponential backoff with full jitter; honour Retry-After;
bound attempts and total time; never retry a 429 that reports exhausted quota.
"""

import random
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol, TypeVar

RETRYABLE_STATUSES = frozenset({408, 429, 500, 502, 503, 504, 529})
NON_RECOVERABLE_CODES = frozenset({"insufficient_quota", "billing_hard_limit_reached"})

T = TypeVar("T")


class ApiError(Exception):
    def __init__(self, status: int, retry_after: float | None = None, code: str = ""):
        super().__init__(f"HTTP {status} {code}".strip())
        self.status = status
        self.retry_after = retry_after
        self.code = code


class Clock(Protocol):
    def now(self) -> float: ...
    def sleep(self, seconds: float) -> None: ...


class SystemClock:
    def now(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        time.sleep(seconds)


@dataclass
class FakeClock:
    """Lets tests 'sleep' instantly while recording how long the code would have waited."""
    current: float = 0.0
    sleeps: list[float] = field(default_factory=list)

    def now(self) -> float:
        return self.current

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.current += seconds


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 4
    base_delay: float = 0.5
    max_delay: float = 8.0
    deadline: float = 20.0

    def is_retryable(self, error: ApiError) -> bool:
        return error.status in RETRYABLE_STATUSES and error.code not in NON_RECOVERABLE_CODES

    def delay(self, error: ApiError, attempt: int, rng: random.Random) -> float:
        if error.retry_after is not None:
            return error.retry_after
        return rng.uniform(0, min(self.max_delay, self.base_delay * 2 ** attempt))


def call_with_retries(call: Callable[[], T], policy: RetryPolicy, clock: Clock, rng: random.Random) -> T:
    start = clock.now()
    for attempt in range(1, policy.max_attempts + 1):
        try:
            return call()
        except ApiError as error:
            if not policy.is_retryable(error) or attempt == policy.max_attempts:
                raise
            delay = policy.delay(error, attempt, rng)
            if clock.now() - start + delay > policy.deadline:
                raise
            clock.sleep(delay)
    raise AssertionError("unreachable")
