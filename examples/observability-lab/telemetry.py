"""Telemetry for the lab service: JSON logs, Prometheus metrics and W3C trace context.

Standard library only, so every line can be read and tested. Production code would use the
OpenTelemetry SDK and a Prometheus client library; the formats on the wire are the same.
"""

from __future__ import annotations

import json
import math
import re
import secrets
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, TextIO

# ---------------------------------------------------------------------------
# Trace context: the W3C traceparent header, version 00
# ---------------------------------------------------------------------------

TRACEPARENT = re.compile(r"([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-.*)?")


@dataclass(frozen=True)
class TraceContext:
    trace_id: str
    span_id: str
    flags: str = "01"

    def header(self) -> str:
        return f"00-{self.trace_id}-{self.span_id}-{self.flags}"


def parse_traceparent(value: str | None) -> TraceContext | None:
    """Returns the incoming context, or None when the header is missing or invalid.

    An invalid header is not an error: the receiver starts a new trace instead.
    """
    if not value:
        return None
    match = TRACEPARENT.fullmatch(value.strip())
    if not match:
        return None
    version, trace_id, span_id, flags, rest = match.groups()
    if version == "ff" or (version == "00" and rest):
        return None
    if trace_id == "0" * 32 or span_id == "0" * 16:
        return None
    return TraceContext(trace_id, span_id, flags)


def new_trace() -> TraceContext:
    return TraceContext(secrets.token_hex(16), secrets.token_hex(8), "01")


def child_span(parent: TraceContext) -> TraceContext:
    """Same trace, new span: what a service does when a request arrives with a traceparent."""
    return TraceContext(parent.trace_id, secrets.token_hex(8), parent.flags)


# ---------------------------------------------------------------------------
# Metrics in the Prometheus text exposition format
# ---------------------------------------------------------------------------

LabelKey = tuple[tuple[str, str], ...]


def format_value(value: float) -> str:
    if math.isinf(value):
        return "+Inf" if value > 0 else "-Inf"
    return str(int(value)) if float(value).is_integer() else repr(float(value))


def escape_label_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def format_labels(labels: LabelKey) -> str:
    if not labels:
        return ""
    return "{" + ",".join(f'{name}="{escape_label_value(value)}"' for name, value in labels) + "}"


class Metric:
    kind = "untyped"

    def __init__(self, name: str, help_text: str, label_names: tuple[str, ...] = ()):
        self.name = name
        self.help_text = help_text
        self.label_names = label_names
        self._lock = threading.Lock()

    def _key(self, labels: dict[str, str]) -> LabelKey:
        if set(labels) != set(self.label_names):
            raise ValueError(f"{self.name} expects labels {self.label_names}, got {sorted(labels)}")
        return tuple((name, str(labels[name])) for name in self.label_names)

    def lines(self) -> list[str]:
        raise NotImplementedError


class Counter(Metric):
    kind = "counter"

    def __init__(self, name: str, help_text: str, label_names: tuple[str, ...] = ()):
        super().__init__(name, help_text, label_names)
        self._values: dict[LabelKey, float] = {}

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        if amount < 0:
            raise ValueError("a counter only goes up")
        key = self._key(labels)
        with self._lock:
            self._values[key] = self._values.get(key, 0.0) + amount

    def lines(self) -> list[str]:
        with self._lock:
            return [f"{self.name}{format_labels(key)} {format_value(value)}" for key, value in sorted(self._values.items())]


@dataclass
class HistogramSeries:
    counts: list[float]
    total: float = 0.0


class Histogram(Metric):
    kind = "histogram"

    def __init__(self, name: str, help_text: str, buckets: tuple[float, ...], label_names: tuple[str, ...] = ()):
        super().__init__(name, help_text, label_names)
        if not buckets or list(buckets) != sorted(set(buckets)):
            raise ValueError("bucket bounds must be unique and increasing")
        self.buckets = tuple(buckets) + (math.inf,)
        self._series: dict[LabelKey, HistogramSeries] = {}

    def observe(self, value: float, **labels: str) -> None:
        key = self._key(labels)
        with self._lock:
            series = self._series.setdefault(key, HistogramSeries([0.0] * len(self.buckets)))
            for index, bound in enumerate(self.buckets):
                if value <= bound:
                    series.counts[index] += 1
            series.total += value

    def lines(self) -> list[str]:
        """Buckets are cumulative: each one counts every observation less than or equal to its bound."""
        output: list[str] = []
        with self._lock:
            for key, series in sorted(self._series.items()):
                for bound, count in zip(self.buckets, series.counts):
                    labels = key + (("le", format_value(bound)),)
                    output.append(f"{self.name}_bucket{format_labels(labels)} {format_value(count)}")
                output.append(f"{self.name}_sum{format_labels(key)} {format_value(series.total)}")
                output.append(f"{self.name}_count{format_labels(key)} {format_value(series.counts[-1])}")
        return output


class Registry:
    def __init__(self) -> None:
        self._metrics: list[Metric] = []

    def register(self, metric: Metric) -> Metric:
        if any(existing.name == metric.name for existing in self._metrics):
            raise ValueError(f"{metric.name} is already registered")
        self._metrics.append(metric)
        return metric

    def render(self) -> str:
        """One HELP and one TYPE line per metric, before its first sample; lines end with a newline."""
        lines: list[str] = []
        for metric in self._metrics:
            lines.append(f"# HELP {metric.name} {metric.help_text}")
            lines.append(f"# TYPE {metric.name} {metric.kind}")
            lines.extend(metric.lines())
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Structured logs: one JSON object per line
# ---------------------------------------------------------------------------


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class JsonLogger:
    def __init__(self, stream: TextIO, service: str, version: str, clock: Callable[[], str] = utc_now):
        self.stream = stream
        self.service = service
        self.version = version
        self.clock = clock
        self._lock = threading.Lock()

    def event(self, level: str, event: str, **fields: object) -> None:
        record = {"ts": self.clock(), "level": level, "service": self.service, "version": self.version, "event": event}
        record.update(fields)
        line = json.dumps(record, ensure_ascii=False)
        with self._lock:
            self.stream.write(line + "\n")
            self.stream.flush()
