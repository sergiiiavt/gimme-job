"""A black-box synthetic check: calls the service from outside, the way a user would.

Each step sends its own traceparent, so a failed step comes with a trace id that leads straight to
the service's log line for that request.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Callable

from telemetry import new_trace

USER_AGENT = "observability-lab-probe/1.0"


@dataclass(frozen=True)
class Step:
    name: str
    ok: bool
    status: int
    duration_ms: float
    trace_id: str
    problem: str = ""

    def line(self) -> str:
        result = "ok" if self.ok else f"FAILED ({self.problem})"
        return f"{self.name:<7} {self.status} {self.duration_ms:6.1f} ms trace {self.trace_id} {result}"


def health_is_ok(body: object) -> str:
    return "" if isinstance(body, dict) and body.get("status") == "ok" else "health body is not status ok"


def search_has_results(body: object) -> str:
    results = body.get("results") if isinstance(body, dict) else None
    return "" if isinstance(results, list) and results else "search returned no results"


CHECKS: list[tuple[str, str, Callable[[object], str]]] = [
    ("health", "/healthz", health_is_ok),
    ("search", "/api/search?q=qa", search_has_results),
]


def fetch(url: str, headers: dict[str, str], timeout: float) -> tuple[int, bytes]:
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        with error:
            return error.code, error.read()


def run_step(base_url: str, name: str, path: str, validate: Callable[[object], str], latency_budget: float, timeout: float) -> Step:
    trace = new_trace()
    started = time.perf_counter()
    try:
        status, raw = fetch(base_url + path, {"traceparent": trace.header(), "user-agent": USER_AGENT}, timeout)
    except (urllib.error.URLError, TimeoutError) as error:
        elapsed = (time.perf_counter() - started) * 1000
        return Step(name, False, 0, elapsed, trace.trace_id, f"unreachable: {error}")
    elapsed = (time.perf_counter() - started) * 1000
    problem = ""
    if status != 200:
        problem = f"status {status}"
    else:
        try:
            problem = validate(json.loads(raw))
        except json.JSONDecodeError:
            problem = "body is not JSON"
    if not problem and elapsed > latency_budget * 1000:
        problem = f"slower than {latency_budget * 1000:.0f} ms"
    return Step(name, not problem, status, elapsed, trace.trace_id, problem)


def check(base_url: str, latency_budget: float = 0.5, timeout: float = 2.0) -> list[Step]:
    return [run_step(base_url, name, path, validate, latency_budget, timeout) for name, path, validate in CHECKS]


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
    steps = check(target)
    for step in steps:
        print(step.line())
    sys.exit(0 if all(step.ok for step in steps) else 1)
