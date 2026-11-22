"""Reads Prometheus text exposition and computes SLIs, error-budget burn rate and SLO verdicts.

The same arithmetic a monitoring system runs on scraped metrics, written out so it can be tested.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

SAMPLE = re.compile(r"([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+(\S+)(?:\s+-?\d+)?")
LABEL = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"')


@dataclass(frozen=True)
class Sample:
    name: str
    labels: dict[str, str]
    value: float


def unescape(value: str) -> str:
    return re.sub(r"\\(.)", lambda match: "\n" if match.group(1) == "n" else match.group(1), value)


def parse_metrics(text: str) -> list[Sample]:
    samples: list[Sample] = []
    for number, line in enumerate(text.splitlines(), start=1):
        if not line.strip() or line.startswith("#"):
            continue
        match = SAMPLE.fullmatch(line.strip())
        if not match:
            raise ValueError(f"line {number} is not a sample: {line!r}")
        name, raw_labels, raw_value = match.groups()
        labels = {key: unescape(value) for key, value in LABEL.findall(raw_labels or "")}
        samples.append(Sample(name, labels, float(raw_value)))
    return samples


def total(samples: list[Sample], name: str, **labels: str) -> float:
    return sum(sample.value for sample in samples
               if sample.name == name and all(sample.labels.get(key) == value for key, value in labels.items()))


def availability(samples: list[Sample], route: str) -> tuple[float, float]:
    """Good and total requests: every response that is not a 5xx counts as good."""
    all_requests = [sample for sample in samples if sample.name == "http_requests_total" and sample.labels.get("route") == route]
    count = sum(sample.value for sample in all_requests)
    bad = sum(sample.value for sample in all_requests if sample.labels.get("status", "").startswith("5"))
    return count - bad, count


def latency(samples: list[Sample], route: str, threshold_seconds: float) -> tuple[float, float]:
    """Requests served within the threshold, and all requests, read from histogram buckets.

    The threshold must be a bucket bound: a histogram only knows how many requests fell into each
    bucket, not where inside it, so any other threshold would be a guess.
    """
    buckets = [sample for sample in samples if sample.name == "http_request_duration_seconds_bucket" and sample.labels.get("route") == route]
    within = [sample.value for sample in buckets if math.isclose(float(sample.labels["le"]), threshold_seconds)]
    if not within:
        bounds = sorted({float(sample.labels["le"]) for sample in buckets})
        raise ValueError(f"{threshold_seconds}s is not a bucket bound of {route}; bounds are {bounds}")
    return within[0], total(samples, "http_request_duration_seconds_count", route=route)


def burn_rate(good: float, count: float, objective: float) -> float:
    """How fast the error budget is being spent: 1.0 uses exactly the budget over the SLO window."""
    if count == 0:
        return 0.0
    return (1 - good / count) / (1 - objective)


@dataclass(frozen=True)
class Objective:
    name: str
    target: float
    threshold_seconds: float | None = None


@dataclass(frozen=True)
class Verdict:
    objective: Objective
    good: float
    count: float

    @property
    def ratio(self) -> float:
        return self.good / self.count if self.count else 1.0

    @property
    def burn_rate(self) -> float:
        return burn_rate(self.good, self.count, self.objective.target)

    @property
    def met(self) -> bool:
        return self.ratio >= self.objective.target

    def line(self) -> str:
        status = "met" if self.met else "MISSED"
        return (f"{self.objective.name:<12} {self.ratio:7.2%} of {int(self.count):>3} "
                f"(target {self.objective.target:.0%}, burn rate {self.burn_rate:5.1f}) {status}")


DEFAULT_OBJECTIVES = (
    Objective("availability", 0.99),
    Objective("latency", 0.95, threshold_seconds=0.1),
)


def evaluate(metrics_text: str, route: str = "/api/search", objectives: tuple[Objective, ...] = DEFAULT_OBJECTIVES) -> list[Verdict]:
    samples = parse_metrics(metrics_text)
    verdicts = []
    for objective in objectives:
        if objective.threshold_seconds is None:
            good, count = availability(samples, route)
        else:
            good, count = latency(samples, route, objective.threshold_seconds)
        verdicts.append(Verdict(objective, good, count))
    return verdicts
