"""A small job-search service with logs, metrics and trace context, plus deterministic fault injection.

Run it on its own and look at what it emits:

    python examples/observability-lab/service.py --port 8080 --error-every 10
    curl "http://127.0.0.1:8080/api/search?q=qa"
    curl http://127.0.0.1:8080/metrics
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Iterator, Mapping, TextIO
from urllib.parse import parse_qs, urlsplit

from telemetry import Counter, Histogram, JsonLogger, Registry, child_span, new_trace, parse_traceparent

# Bucket bounds in seconds. An SLO latency threshold must be one of them (see slo.py).
LATENCY_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)

# Known routes become label values; every other path shares one value, so a scanner that requests
# thousands of random URLs cannot create thousands of time series.
ROUTES = ("/api/search", "/healthz", "/metrics")
UNMATCHED_ROUTE = "unmatched"

JOBS = [
    {"id": "job-101", "title": "QA Automation Engineer", "remote": True},
    {"id": "job-102", "title": "Senior QA Engineer (API)", "remote": False},
    {"id": "job-103", "title": "SDET, Payments", "remote": True},
    {"id": "job-104", "title": "Performance Test Engineer", "remote": True},
    {"id": "job-105", "title": "QA Lead", "remote": False},
]


@dataclass(frozen=True)
class Faults:
    """Deterministic faults: every Nth search request fails or is slow. Zero turns a fault off."""

    error_every: int = 0
    slow_every: int = 0
    slow_seconds: float = 0.15


@dataclass(frozen=True)
class Response:
    status: int
    headers: dict[str, str]
    body: bytes


def json_response(status: int, payload: object, headers: dict[str, str]) -> Response:
    return Response(status, {"content-type": "application/json", **headers}, json.dumps(payload).encode())


class LabService:
    def __init__(self, name: str = "search", version: str = "1.0.0", faults: Faults = Faults(), log_stream: TextIO | None = None):
        self.name = name
        self.version = version
        self.faults = faults
        self.logger = JsonLogger(log_stream or sys.stderr, name, version)
        self.registry = Registry()
        self.requests_total = self.registry.register(Counter(
            "http_requests_total", "HTTP requests handled, by route and status code.", ("route", "status")))
        self.duration = self.registry.register(Histogram(
            "http_request_duration_seconds", "Time spent handling an HTTP request.", LATENCY_BUCKETS, ("route",)))
        self._search_count = 0
        self._lock = threading.Lock()

    def handle(self, method: str, target: str, headers: Mapping[str, str]) -> Response:
        started = time.perf_counter()
        incoming = parse_traceparent(headers.get("traceparent"))
        span = child_span(incoming) if incoming else new_trace()
        url = urlsplit(target)
        route = url.path if url.path in ROUTES else UNMATCHED_ROUTE
        trace_headers = {"x-trace-id": span.trace_id}

        if method != "GET":
            response = json_response(405, {"error": "method not allowed"}, trace_headers)
        elif route == "/healthz":
            response = json_response(200, {"status": "ok", "version": self.version}, trace_headers)
        elif route == "/metrics":
            body = self.registry.render().encode()
            response = Response(200, {"content-type": "text/plain; version=0.0.4", **trace_headers}, body)
        elif route == "/api/search":
            response = self._search(parse_qs(url.query).get("q", [""])[0], trace_headers)
        else:
            response = json_response(404, {"error": "not found"}, trace_headers)

        elapsed = time.perf_counter() - started
        self.requests_total.inc(route=route, status=str(response.status))
        self.duration.observe(elapsed, route=route)
        # The route, never the full URL: query strings carry search terms, emails and tokens.
        self.logger.event(
            "error" if response.status >= 500 else "info",
            "http_request",
            method=method,
            route=route,
            status=response.status,
            duration_ms=round(elapsed * 1000, 2),
            trace_id=span.trace_id,
            span_id=span.span_id,
            parent_span_id=incoming.span_id if incoming else None,
        )
        return response

    def _search(self, query: str, headers: dict[str, str]) -> Response:
        with self._lock:
            self._search_count += 1
            number = self._search_count
        if self.faults.slow_every and number % self.faults.slow_every == 0:
            time.sleep(self.faults.slow_seconds)
        if self.faults.error_every and number % self.faults.error_every == 0:
            return json_response(500, {"error": "injected fault"}, headers)
        words = query.lower().split()
        results = [job for job in JOBS if all(word in job["title"].lower() for word in words)]
        return json_response(200, {"query": query, "results": results}, headers)


def make_handler(service: LabService) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            self._reply(service.handle("GET", self.path, self.headers))

        def do_POST(self) -> None:
            self._reply(service.handle("POST", self.path, self.headers))

        def _reply(self, response: Response) -> None:
            self.send_response(response.status)
            for name, value in response.headers.items():
                self.send_header(name, value)
            self.send_header("content-length", str(len(response.body)))
            self.end_headers()
            self.wfile.write(response.body)

        def log_message(self, format: str, *args: object) -> None:
            """The service writes its own structured log; the default access log would duplicate it."""

    return Handler


@contextmanager
def running(service: LabService, port: int = 0) -> Iterator[str]:
    """Serves on localhost in a background thread and yields the base URL."""
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(service))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--version", default="1.0.0")
    parser.add_argument("--error-every", type=int, default=0)
    parser.add_argument("--slow-every", type=int, default=0)
    options = parser.parse_args()
    service = LabService(version=options.version, faults=Faults(options.error_every, options.slow_every))
    with running(service, options.port) as base_url:
        print(f"serving {base_url} (Ctrl+C to stop)", file=sys.stderr)
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
