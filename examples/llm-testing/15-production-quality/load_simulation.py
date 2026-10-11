"""A load test against a fake model provider, as a discrete-event simulation with a fixed seed: rate
limits answered with 429 and retry-after, a concurrency limit, and clients that honour or ignore
retry-after.

Chapter: Production quality (performance testing)
https://gimme-job.com/learn/llm?topic=production-quality

A fake provider tests the application's own behaviour under load (retries, time-outs, waiting)
cheaply and repeatably. Load against the real provider costs money and is only needed at the scale
that confirms its limits.
"""

import heapq
import itertools
import math
import random
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from latency_capacity import in_flight, percentile


@dataclass(frozen=True)
class ProviderLimits:
    requests_per_minute: float
    max_concurrency: int
    burst_seconds: float = 5.0  # the token bucket holds this many seconds of the per-minute rate


@dataclass(frozen=True)
class ClientPolicy:
    """How a client retries after a 429: 'immediate' ignores retry-after, 'retry_after' waits exactly
    as long as the header says, 'backoff' waits a random time up to base * 2^attempt (exponential
    backoff with full jitter) but never less than retry-after."""
    strategy: Literal["immediate", "retry_after", "backoff"] = "backoff"
    max_attempts: int = 6
    base_s: float = 1.0
    retry_budget_s: float = 60.0  # no retry is sent later than this after the request arrived

    def wait(self, rng: random.Random, attempt: int, retry_after: int) -> float:
        if self.strategy == "immediate":
            return 0.05
        if self.strategy == "retry_after":
            return retry_after + rng.uniform(0, 0.1)
        return max(retry_after, rng.uniform(0, self.base_s * 2 ** attempt))


@dataclass
class LoadResult:
    requests: int
    completed: int = 0
    failed: int = 0
    rate_limited: int = 0  # 429 responses
    attempts: int = 0
    latencies: list[float] = field(default_factory=list)  # completed requests, first attempt to answer
    busy_area: float = 0.0  # integral of requests in service over time
    duration_s: float = 0.0

    @property
    def success_rate(self) -> float:
        return self.completed / self.requests

    @property
    def p95(self) -> float:
        return percentile(self.latencies, 95)

    @property
    def mean_in_service(self) -> float:
        return self.busy_area / self.duration_s


def support_latency(rng: random.Random) -> float:
    """Service time of one call: time to first token, generation, and a slow tool in one call in twenty."""
    first = rng.lognormvariate(math.log(0.6), 0.35)
    generation = rng.uniform(150, 400) / rng.uniform(40, 80)
    tool = rng.uniform(4, 9) if rng.random() < 0.05 else 0.0
    return first + generation + tool


def poisson_arrivals(rng: random.Random, traffic: list[tuple[float, float]]) -> list[float]:
    """Arrival times for phases of (minutes, requests per minute), for example a steady load with a spike."""
    arrivals, phase_start = [], 0.0
    for minutes, per_minute in traffic:
        clock = phase_start + rng.expovariate(per_minute / 60)
        while clock < phase_start + minutes * 60:
            arrivals.append(clock)
            clock += rng.expovariate(per_minute / 60)
        phase_start += minutes * 60
    return arrivals


def simulate(traffic: list[tuple[float, float]], limits: ProviderLimits, policy: ClientPolicy,
             service_time: Callable[[random.Random], float] = support_latency, seed: int = 0) -> LoadResult:
    rng = random.Random(seed)
    arrivals = poisson_arrivals(rng, traffic)
    order = itertools.count()
    events = [(time, next(order), "send", request) for request, time in enumerate(arrivals)]
    heapq.heapify(events)

    refill = limits.requests_per_minute / 60
    capacity = max(1.0, refill * limits.burst_seconds)
    tokens, refilled_at = capacity, 0.0
    in_service: list[float] = []  # finish times
    attempts = [0] * len(arrivals)
    result, last_event = LoadResult(requests=len(arrivals)), 0.0
    while events:
        now, _, kind, request = heapq.heappop(events)
        result.busy_area += len(in_service) * (now - last_event)
        last_event = now
        if kind == "finish":
            heapq.heappop(in_service)
            result.completed += 1
            result.latencies.append(now - arrivals[request])
            continue
        attempts[request] += 1
        result.attempts += 1
        tokens, refilled_at = min(capacity, tokens + (now - refilled_at) * refill), now
        if tokens >= 1 and len(in_service) < limits.max_concurrency:
            tokens -= 1
            finish = now + service_time(rng)
            heapq.heappush(in_service, finish)
            heapq.heappush(events, (finish, next(order), "finish", request))
            continue
        result.rate_limited += 1
        # whole seconds, as in a Retry-After header: until a token is back, or until a slot frees up
        retry_after = max(1, math.ceil((1 - tokens) / refill if tokens < 1 else in_service[0] - now))
        wait = policy.wait(rng, attempts[request], retry_after)
        if attempts[request] >= policy.max_attempts or now + wait - arrivals[request] > policy.retry_budget_s:
            result.failed += 1
            continue
        heapq.heappush(events, (now + wait, next(order), "send", request))
    result.duration_s = last_event
    return result


SCENARIOS = [
    ("steady 600/min, concurrency 200", [(30, 600)], ProviderLimits(1500, 200), ClientPolicy()),
    ("steady 900/min, concurrency 64", [(30, 900)], ProviderLimits(1500, 64), ClientPolicy()),
    ("spike, immediate retries", [(5, 600), (0.5, 2400), (5, 600)], ProviderLimits(1500, 120),
     ClientPolicy(strategy="immediate")),
    ("spike, wait for retry-after", [(5, 600), (0.5, 2400), (5, 600)], ProviderLimits(1500, 120),
     ClientPolicy(strategy="retry_after")),
    ("spike, backoff with jitter", [(5, 600), (0.5, 2400), (5, 600)], ProviderLimits(1500, 120),
     ClientPolicy(strategy="backoff")),
]


def main(argv: list[str]) -> int:
    rng = random.Random(0)
    mean_service = sum(support_latency(rng) for _ in range(200_000)) / 200_000
    print(f"mean service time {mean_service:.2f} s; Little's law: 600/min needs about "
          f"{in_flight(10, mean_service):.0f} calls in flight, 900/min about {in_flight(15, mean_service):.0f}")
    print(f"{'scenario':<32} {'requests':>8} {'answered':>9} {'429s':>6} {'p95':>7} {'in service':>10}")
    for name, traffic, limits, policy in SCENARIOS:
        result = simulate(traffic, limits, policy, seed=3)
        print(f"{name:<32} {result.requests:>8} {result.success_rate:>9.1%} {result.rate_limited:>6} "
              f"{result.p95:>6.1f}s {result.mean_in_service:>10.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
