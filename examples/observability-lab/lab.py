"""The whole lab in one run: a stable version and a canary, synthetic checks, SLOs and a canary decision.

    python examples/observability-lab/lab.py
"""

from __future__ import annotations

import io
import json
import sys
import urllib.error
import urllib.request
from typing import TextIO

from canary import CanaryDecision, judge
from service import Faults, LabService, running
from slo import evaluate
from synthetic import check
from telemetry import new_trace

QUERIES = ["qa", "engineer", "sdet", "lead", "remote"]


def send_traffic(base_url: str, count: int) -> None:
    """Search traffic as a gateway would send it: each request starts a trace and passes it on."""
    for index in range(count):
        url = f"{base_url}/api/search?q={QUERIES[index % len(QUERIES)]}"
        request = urllib.request.Request(url, headers={"traceparent": new_trace().header()})
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                response.read()
        except urllib.error.HTTPError as error:
            with error:
                error.read()


def scrape(base_url: str) -> str:
    with urllib.request.urlopen(f"{base_url}/metrics", timeout=2) as response:
        return response.read().decode()


def first_error(log_text: str) -> dict | None:
    for line in log_text.splitlines():
        record = json.loads(line)
        if record["status"] >= 500:
            return record
    return None


def run(traffic: int = 60, out: TextIO = sys.stdout) -> CanaryDecision:
    stable_logs, canary_logs = io.StringIO(), io.StringIO()
    stable = LabService(version="1.4.0", log_stream=stable_logs)
    # The canary has a bug: every 8th search fails and every 5th is slow.
    canary = LabService(version="1.5.0", faults=Faults(error_every=8, slow_every=5), log_stream=canary_logs)

    with running(stable) as stable_url, running(canary) as canary_url:
        targets = [("control 1.4.0", stable_url), ("canary 1.5.0", canary_url)]

        print("1. Synthetic checks: one request per step, from outside", file=out)
        for label, url in targets:
            for step in check(url):
                print(f"   {label:<13} {step.line()}", file=out)

        print(f"\n2. Traffic: {traffic} searches to each version", file=out)
        for _, url in targets:
            send_traffic(url, traffic)

        print("\n3. SLOs computed from each version's /metrics", file=out)
        verdicts = {}
        for label, url in targets:
            verdicts[label] = evaluate(scrape(url))
            for verdict in verdicts[label]:
                print(f"   {label:<13} {verdict.line()}", file=out)

    decision = judge(verdicts["control 1.4.0"], verdicts["canary 1.5.0"])
    print(f"\n4. Canary decision\n   {decision.line()}", file=out)

    record = first_error(canary_logs.getvalue())
    if record:
        matching = [line for line in canary_logs.getvalue().splitlines() if record["trace_id"] in line]
        print(f"\n5. From a failed request to its log line: trace {record['trace_id']}", file=out)
        print(f"   {len(matching)} log line(s) with this trace id:", file=out)
        for line in matching:
            print(f"   {line}", file=out)
    return decision


if __name__ == "__main__":
    run()
