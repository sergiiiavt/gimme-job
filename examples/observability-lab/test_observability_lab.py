"""Checks for the observability lab: telemetry formats, the service's signals, SLO maths and the canary decision.

    python -m unittest discover -s examples/observability-lab -v
"""

from __future__ import annotations

import io
import json
import math
import re
import unittest
import urllib.request

from canary import judge
from lab import run
from service import Faults, LabService, running
from slo import Objective, burn_rate, evaluate, latency, parse_metrics
from synthetic import check
from telemetry import Counter, Histogram, Registry, TraceContext, child_span, new_trace, parse_traceparent

VALID = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
LOG_FIELDS = {"ts", "level", "service", "version", "event", "method", "route", "status", "duration_ms", "trace_id", "span_id", "parent_span_id"}


def log_records(stream: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in stream.getvalue().splitlines()]


class TraceContextTests(unittest.TestCase):
    def test_a_valid_header_is_parsed(self):
        context = parse_traceparent(VALID)
        self.assertEqual(context, TraceContext("4bf92f3577b34da6a3ce929d0e0e4736", "00f067aa0ba902b7", "01"))
        self.assertEqual(context.header(), VALID)

    def test_invalid_headers_start_a_new_trace_instead_of_failing(self):
        invalid = [
            None,
            "",
            "garbage",
            "00-00000000000000000000000000000000-00f067aa0ba902b7-01",  # all-zero trace id
            "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01",  # all-zero parent id
            "ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",  # forbidden version
            "00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01",  # upper-case hex
            "00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01",  # trace id too short
            VALID + "-extra",  # version 00 has exactly four fields
        ]
        for header in invalid:
            with self.subTest(header=header):
                self.assertIsNone(parse_traceparent(header))

    def test_a_child_span_keeps_the_trace_and_gets_a_new_span_id(self):
        parent = parse_traceparent(VALID)
        child = child_span(parent)
        self.assertEqual(child.trace_id, parent.trace_id)
        self.assertNotEqual(child.span_id, parent.span_id)
        self.assertRegex(new_trace().header(), r"^00-[0-9a-f]{32}-[0-9a-f]{16}-01$")


class ExpositionFormatTests(unittest.TestCase):
    def setUp(self):
        self.registry = Registry()
        self.counter = self.registry.register(Counter("lab_events_total", "Events.", ("kind",)))
        self.histogram = self.registry.register(Histogram("lab_duration_seconds", "Durations.", (0.1, 0.5, 1.0)))
        for value in [0.05, 0.2, 0.2, 0.7, 3.0]:
            self.histogram.observe(value)
        self.counter.inc(kind='say "hi"\n')

    def test_help_and_type_come_once_and_before_the_samples(self):
        lines = self.registry.render().splitlines()
        for name, kind in [("lab_events_total", "counter"), ("lab_duration_seconds", "histogram")]:
            type_line = lines.index(f"# TYPE {name} {kind}")
            self.assertEqual(lines[type_line - 1].split()[:3], ["#", "HELP", name])
            first_sample = next(index for index, line in enumerate(lines) if line.startswith(name) and not line.startswith("#"))
            self.assertLess(type_line, first_sample)
            self.assertEqual(sum(1 for line in lines if line.startswith(f"# TYPE {name} ")), 1)
        self.assertTrue(self.registry.render().endswith("\n"))

    def test_histogram_buckets_are_cumulative_and_end_with_inf(self):
        samples = parse_metrics(self.registry.render())
        buckets = [sample for sample in samples if sample.name == "lab_duration_seconds_bucket"]
        self.assertEqual([sample.labels["le"] for sample in buckets], ["0.1", "0.5", "1", "+Inf"])
        self.assertEqual([sample.value for sample in buckets], [1, 3, 4, 5])
        count = next(sample.value for sample in samples if sample.name == "lab_duration_seconds_count")
        total = next(sample.value for sample in samples if sample.name == "lab_duration_seconds_sum")
        self.assertEqual(buckets[-1].value, count)
        self.assertTrue(math.isclose(total, 4.15))

    def test_label_values_are_escaped_and_survive_a_round_trip(self):
        self.assertIn('kind="say \\"hi\\"\\n"', self.registry.render())
        sample = next(sample for sample in parse_metrics(self.registry.render()) if sample.name == "lab_events_total")
        self.assertEqual(sample.labels["kind"], 'say "hi"\n')

    def test_counters_only_go_up_and_labels_are_fixed(self):
        with self.assertRaises(ValueError):
            self.counter.inc(-1, kind="x")
        with self.assertRaises(ValueError):
            self.counter.inc(kind="x", extra="y")


class ServiceSignalTests(unittest.TestCase):
    def setUp(self):
        self.logs = io.StringIO()
        self.service = LabService(version="2.0.0", log_stream=self.logs)

    def test_every_request_writes_one_json_event_with_the_agreed_fields(self):
        self.service.handle("GET", "/api/search?q=qa", {})
        self.service.handle("GET", "/healthz", {})
        records = log_records(self.logs)
        self.assertEqual(len(records), 2)
        for record in records:
            self.assertEqual(set(record), LOG_FIELDS)
            self.assertEqual(record["version"], "2.0.0")

    def test_the_query_string_is_never_logged(self):
        self.service.handle("GET", "/api/search?q=qa&email=anna%40example.com&token=s3cret", {})
        text = self.logs.getvalue()
        for secret in ["s3cret", "anna", "email", "token"]:
            self.assertNotIn(secret, text)

    def test_incoming_trace_context_is_continued_and_returned_to_the_caller(self):
        response = self.service.handle("GET", "/api/search?q=qa", {"traceparent": VALID})
        record = log_records(self.logs)[0]
        self.assertEqual(record["trace_id"], "4bf92f3577b34da6a3ce929d0e0e4736")
        self.assertEqual(record["parent_span_id"], "00f067aa0ba902b7")
        self.assertNotEqual(record["span_id"], "00f067aa0ba902b7")
        self.assertEqual(response.headers["x-trace-id"], record["trace_id"])

    def test_an_invalid_traceparent_starts_a_new_trace(self):
        self.service.handle("GET", "/healthz", {"traceparent": "00-not-a-trace-01"})
        record = log_records(self.logs)[0]
        self.assertRegex(record["trace_id"], r"^[0-9a-f]{32}$")
        self.assertIsNone(record["parent_span_id"])

    def test_unknown_paths_share_one_route_label(self):
        for index in range(100):
            self.assertEqual(self.service.handle("GET", f"/scan/{index}", {}).status, 404)
        series = [line for line in self.service.registry.render().splitlines() if line.startswith("http_requests_total{")]
        self.assertEqual(series, ['http_requests_total{route="unmatched",status="404"} 100'])

    def test_injected_errors_are_counted_as_5xx_and_logged_as_errors(self):
        service = LabService(faults=Faults(error_every=4), log_stream=self.logs)
        statuses = [service.handle("GET", "/api/search?q=qa", {}).status for _ in range(20)]
        self.assertEqual(statuses.count(500), 5)
        self.assertIn('http_requests_total{route="/api/search",status="500"} 5', service.registry.render())
        self.assertEqual(sum(1 for record in log_records(self.logs) if record["level"] == "error"), 5)


class SloTests(unittest.TestCase):
    def test_slis_are_read_from_counters_and_histogram_buckets(self):
        service = LabService(faults=Faults(error_every=10, slow_every=4, slow_seconds=0.12), log_stream=io.StringIO())
        for _ in range(40):
            service.handle("GET", "/api/search?q=qa", {})
        availability, latency_verdict = evaluate(service.registry.render())
        self.assertEqual((availability.good, availability.count), (36, 40))
        self.assertEqual((latency_verdict.good, latency_verdict.count), (30, 40))
        self.assertFalse(availability.met)
        self.assertAlmostEqual(availability.burn_rate, 10.0)

    def test_a_latency_threshold_must_be_a_bucket_bound(self):
        service = LabService(log_stream=io.StringIO())
        service.handle("GET", "/api/search?q=qa", {})
        samples = parse_metrics(service.registry.render())
        self.assertEqual(latency(samples, "/api/search", 0.25)[1], 1)
        with self.assertRaisesRegex(ValueError, "not a bucket bound"):
            latency(samples, "/api/search", 0.3)

    def test_burn_rate_is_the_error_ratio_divided_by_the_budget(self):
        self.assertAlmostEqual(burn_rate(999, 1000, 0.999), 1.0)
        self.assertAlmostEqual(burn_rate(9856, 10000, 0.999), 14.4)
        self.assertEqual(burn_rate(0, 0, 0.999), 0.0)


class CanaryTests(unittest.TestCase):
    @staticmethod
    def verdicts(faults: Faults, count: int):
        service = LabService(faults=faults, log_stream=io.StringIO())
        for _ in range(count):
            service.handle("GET", "/api/search?q=qa", {})
        return evaluate(service.registry.render(), objectives=(Objective("availability", 0.99),))

    def test_a_canary_that_fails_more_often_is_rolled_back(self):
        decision = judge(self.verdicts(Faults(), 60), self.verdicts(Faults(error_every=8), 60))
        self.assertEqual(decision.action, "rollback")
        self.assertIn("availability", decision.reasons[0])

    def test_a_healthy_canary_is_promoted(self):
        self.assertEqual(judge(self.verdicts(Faults(), 60), self.verdicts(Faults(), 60)).action, "promote")

    def test_too_little_traffic_means_wait_not_promote(self):
        decision = judge(self.verdicts(Faults(), 60), self.verdicts(Faults(error_every=8), 7))
        self.assertEqual(decision.action, "wait")


class SyntheticCheckTests(unittest.TestCase):
    def test_a_healthy_service_passes_every_step(self):
        with running(LabService(log_stream=io.StringIO())) as base_url:
            steps = check(base_url)
        self.assertEqual([step.name for step in steps], ["health", "search"])
        self.assertTrue(all(step.ok for step in steps), [step.line() for step in steps])

    def test_a_failed_step_carries_a_trace_id_that_finds_the_log_line(self):
        logs = io.StringIO()
        with running(LabService(faults=Faults(error_every=1), log_stream=logs)) as base_url:
            search = check(base_url)[1]
        self.assertFalse(search.ok)
        self.assertEqual(search.problem, "status 500")
        matching = [record for record in log_records(logs) if record["trace_id"] == search.trace_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["status"], 500)

    def test_an_unreachable_service_is_reported_not_raised(self):
        with running(LabService(log_stream=io.StringIO())) as base_url:
            pass
        steps = check(base_url, timeout=0.5)
        self.assertFalse(any(step.ok for step in steps))
        self.assertTrue(all(step.problem.startswith("unreachable") for step in steps))

    def test_the_metrics_endpoint_serves_the_text_format(self):
        with running(LabService(log_stream=io.StringIO())) as base_url:
            check(base_url)
            with urllib.request.urlopen(f"{base_url}/metrics", timeout=2) as response:
                content_type = response.headers["content-type"]
                text = response.read().decode()
        self.assertTrue(content_type.startswith("text/plain"))
        self.assertTrue(re.search(r'^http_requests_total\{route="/healthz",status="200"\} 1$', text, re.M))


class LabRunTests(unittest.TestCase):
    def test_the_lab_rolls_back_the_faulty_canary_and_finds_the_failed_request(self):
        output = io.StringIO()
        decision = run(out=output)
        self.assertEqual(decision.action, "rollback")
        text = output.getvalue()
        self.assertIn("ROLLBACK", text)
        self.assertIn("1 log line(s) with this trace id", text)


if __name__ == "__main__":
    unittest.main()
