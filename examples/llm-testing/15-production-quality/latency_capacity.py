"""Latency percentiles, service level objectives, time to first token and capacity from Little's law.

Chapter: Production quality (performance testing)
https://gimme-job.com/learn/llm?topic=production-quality
"""

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from statistics import fmean, quantiles


def percentile(values: list[float], q: int) -> float:
    """The q-th percentile (1 to 99) with linear interpolation between order statistics, the
    'inclusive' method of statistics.quantiles. Other definitions, such as nearest rank, give
    different values on small samples, so state the definition next to a requirement."""
    if not 1 <= q <= 99:
        raise ValueError(f"q must be between 1 and 99, got {q}")
    if not values:
        raise ValueError("no values")
    if len(values) == 1:
        return float(values[0])
    return quantiles(values, n=100, method="inclusive")[q - 1]


def latency_summary(values: list[float]) -> dict[str, float]:
    return {"mean": fmean(values), "p50": percentile(values, 50), "p95": percentile(values, 95),
            "p99": percentile(values, 99), "max": max(values)}


def check_objectives(values: list[float], objectives: dict[str, float]) -> dict[str, tuple[float, bool]]:
    """Objectives such as {"p95": 2.0} (seconds): the measured value and whether it meets the objective."""
    report = {}
    for name, limit in objectives.items():
        if not name.startswith("p"):
            raise ValueError(f"objectives are percentiles such as p95, got {name!r}")
        value = percentile(values, int(name[1:]))
        report[name] = (value, value <= limit)
    return report


def in_flight(arrivals_per_second: float, mean_time_in_system_s: float) -> float:
    """Little's law: the average number of requests in the system is the arrival rate times the
    average time each request spends in it."""
    return arrivals_per_second * mean_time_in_system_s


def max_throughput_per_minute(concurrency: int, mean_time_in_system_s: float) -> float:
    """Little's law solved for the arrival rate: the most a concurrency limit can sustain."""
    return concurrency / mean_time_in_system_s * 60


@dataclass(frozen=True)
class StreamTiming:
    time_to_first_token: float
    total: float
    chunks: int

    @property
    def generation_time(self) -> float:
        return self.total - self.time_to_first_token


def time_stream(chunks: Iterable[str], clock: Callable[[], float]) -> tuple[str, StreamTiming]:
    """Read a streamed answer and time it from the moment the request is sent. The first token is
    the first chunk with text: providers often open a stream with empty chunks (role announcements,
    keep-alives), and counting those would make the time to first token look better than users see."""
    start, first, parts = clock(), None, []
    for chunk in chunks:
        if first is None and chunk:
            first = clock()
        parts.append(chunk)
    end = clock()
    if first is None:
        raise ValueError("the stream ended without any text")
    return "".join(parts), StreamTiming(first - start, end - start, sum(1 for part in parts if part))
