# Observability lab

The fastest way to make the ideas of this path stick is to see them in one small system that you can run, break and fix. The lab is a job-search service that writes structured logs, exposes metrics and continues traces, plus the tools a QA engineer uses to judge a release with those signals: SLOs computed from metrics, a synthetic check and a canary decision.

This chapter covers what is in the lab, how to run it, how to read each signal it produces, how to compute its SLOs yourself, exercises that break it on purpose, and how each piece maps to the tools you will meet at work.

**Prerequisites:** [Logs that answer questions](/learn/observability?topic=structured-logs), [Metrics, golden signals and percentiles](/learn/observability?topic=metrics), [Distributed tracing](/learn/observability?topic=distributed-tracing), [SLIs, SLOs and error budgets](/learn/observability?topic=slo-error-budgets), [Testing in production](/learn/observability?topic=testing-in-production).

## What is in the lab

The lab in [examples/observability-lab](https://github.com/sergiiiavt/gimme-job/tree/main/examples/observability-lab) uses only the Python standard library: no Prometheus, no collector, no API key. It writes the same formats real systems use, so what you learn here applies directly to production tools.

```diagram
lab.py        starts a control (1.4.0) and a canary with a bug (1.5.0), sends traffic, judges the canary
   ↓  HTTP, a traceparent header on every request
service.py    /api/search, /healthz, /metrics; one JSON log line per request; the canary fails every 8th search
   ↓  scrape /metrics
slo.py        availability and latency SLIs, burn rate   →   canary.py   promote, roll back or wait
synthetic.py  black-box checks from outside, with a trace id on every step
```

| File | What it does |
|---|---|
| `telemetry.py` | Parses and continues W3C `traceparent`, keeps counters and histograms in the Prometheus text format, writes JSON lines |
| `service.py` | The service, with bounded route labels and deterministic faults: every Nth search fails or is slow |
| `slo.py` | Parses scraped metrics and computes SLIs, burn rate and SLO verdicts |
| `canary.py` | Compares canary and control on the same objectives |
| `synthetic.py` | Calls the service from outside, the way a user would |
| `test_observability_lab.py` | 24 checks, from format rules to the canary decision, run in this repository's CI |

## Run it

From the repository root, with Python 3.12 or newer:

```bash
python examples/observability-lab/lab.py
python -m unittest discover -s examples/observability-lab -v
```

The lab prints five steps; here is a shortened version. Timings and ids differ on every run, but the ratios do not, because the faults are deterministic:

```text
1. Synthetic checks: one request per step, from outside
   control 1.4.0 search  200    2.5 ms trace bf3e05c1... ok
   canary 1.5.0  search  200    2.9 ms trace 5ca4b647... ok
3. SLOs computed from each version's /metrics
   control 1.4.0 availability 100.00% of  61 (target 99%, burn rate   0.0) met
   canary 1.5.0  availability  88.52% of  61 (target 99%, burn rate  11.5) MISSED
   canary 1.5.0  latency       80.33% of  61 (target 95%, burn rate   3.9) MISSED
4. Canary decision
   ROLLBACK: availability 88.5% on the canary vs 100.0% on the control; latency 80.3% on the canary vs 100.0% on the control
5. From a failed request to its log line: trace b50a2e97...
```

The first lesson is already in this output: both versions pass their synthetic checks, yet the canary fails one search in eight. A single probe finds outages; only the metrics from all traffic reveal the error rate.

## Read the signals

### Logs

Every request produces exactly one event with the same fields, as described in [Logs that answer questions](/learn/observability?topic=structured-logs):

```json
{"ts": "2026-11-22T09:46:28.614Z", "level": "info", "service": "search", "version": "1.5.0", "event": "http_request", "method": "GET", "route": "/api/search", "status": 200, "duration_ms": 0.11, "trace_id": "fe815c9d9e8298ac421f5ae4678510b0", "span_id": "383580d0c71e879e", "parent_span_id": "09d7f256ac362362"}
```

Three details matter. The `version` field lets you split every query by release, which is what a canary needs. The event records the route, never the full URL, because query strings carry search terms, emails and tokens; one of the tests sends an email address and a token and checks that neither reaches the log. And `trace_id` with `parent_span_id` connects the event to the caller that started the trace.

### Metrics

The `/metrics` endpoint serves the Prometheus text format. An excerpt from the canary after the lab's traffic:

```text
# HELP http_requests_total HTTP requests handled, by route and status code.
# TYPE http_requests_total counter
http_requests_total{route="/api/search",status="200"} 54
http_requests_total{route="/api/search",status="500"} 7
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/api/search",le="0.1"} 49
http_request_duration_seconds_bucket{route="/api/search",le="0.25"} 61
http_request_duration_seconds_bucket{route="/api/search",le="+Inf"} 61
http_request_duration_seconds_sum{route="/api/search"} 1.81
http_request_duration_seconds_count{route="/api/search"} 61
```

The format has rules the tests check: one `HELP` and one `TYPE` line per metric, before its first sample; histogram buckets in increasing order of `le`, each counting every observation up to its bound, so the counts never decrease; a mandatory `+Inf` bucket equal to `_count`; and `_sum` for computing averages. The route label is bounded: every unknown path is counted as `route="unmatched"`, so a scanner requesting a hundred random URLs adds one series, not a hundred.

### Traces

A `traceparent` header has four fields: version, trace id, parent span id and flags, for example `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. The service keeps the trace id, creates a new span id for its own work and logs the caller's span id as `parent_span_id`. A header that cannot be used, such as one with an all-zero id, the forbidden version `ff` or upper-case hex, is ignored and a new trace starts; the request itself never fails because of it.

The service also returns the trace id in an `x-trace-id` response header. That is a convention of this lab rather than a standard, and a useful one for testers: put the id in the bug report, and whoever investigates goes straight to the right log line, as step 5 of the lab does.

## Compute the SLOs yourself

The arithmetic a monitoring system runs on these metrics is short. The example below parses the excerpt above, computes both SLIs and their burn rates, and shows why the latency threshold of an SLO must be one of the histogram's bucket bounds:

```python
import re

METRICS = """
# TYPE http_requests_total counter
http_requests_total{route="/api/search",status="200"} 54
http_requests_total{route="/api/search",status="500"} 7
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{route="/api/search",le="0.05"} 49
http_request_duration_seconds_bucket{route="/api/search",le="0.1"} 49
http_request_duration_seconds_bucket{route="/api/search",le="0.25"} 61
http_request_duration_seconds_bucket{route="/api/search",le="+Inf"} 61
http_request_duration_seconds_sum{route="/api/search"} 1.81
http_request_duration_seconds_count{route="/api/search"} 61
"""
SAMPLE = r"(\w+)\{(.*)\} (\S+)"
LABEL = r'(\w+)="([^"]*)"'
TARGETS = {"availability": 0.99, "latency": 0.95}
THRESHOLD = "0.1"

def parse(text):
    samples = []
    for line in text.strip().splitlines():
        match = re.fullmatch(SAMPLE, line)
        if match:
            labels = dict(re.findall(LABEL, match.group(2)))
            samples.append({"name": match.group(1), "labels": labels, "value": float(match.group(3))})
    return samples

def value(samples, name, **labels):
    return sum(s["value"] for s in samples
               if s["name"] == name and all(s["labels"].get(key) == labels[key] for key in labels))

samples = parse(METRICS)
total = value(samples, "http_requests_total", route="/api/search")
failed = value(samples, "http_requests_total", route="/api/search", status="500")
fast = value(samples, "http_request_duration_seconds_bucket", route="/api/search", le=THRESHOLD)
count = value(samples, "http_request_duration_seconds_count", route="/api/search")

slis = {"availability": (total - failed) / total, "latency": fast / count}
for name in slis:
    burn = (1 - slis[name]) / (1 - TARGETS[name])
    print(f"{name:<12} {slis[name]:.2%}  target {TARGETS[name]:.0%}  burn rate {burn:.1f}")

bounds = {s["labels"]["le"] for s in samples if s["name"].endswith("_bucket")}
for threshold in ["0.1", "0.3"]:
    verdict = "is a bucket bound" if threshold in bounds else "has no bucket, so this SLI cannot be computed exactly"
    print(f"latency threshold {threshold}s {verdict}")
```

A classic histogram only knows how many requests fell into each bucket, not where inside it, so the share of requests faster than 0.3 seconds cannot be computed from buckets at 0.25 and 0.5. Prometheus's own guidance is to choose bucket bounds at your SLO thresholds in advance, because changing them later is disruptive; newer native histograms interpolate instead. The lab's `slo.latency` refuses a threshold that is not a bucket bound rather than returning a wrong number.

The burn rates connect to [burn-rate alerting](/learn/observability?topic=slo-error-budgets&section=burn-rate-and-alerting): a version that fails 11.5% of searches against a 99% target spends its error budget 11.5 times faster than allowed. Serving all traffic, it would stay below the fast-burn threshold of 14.4 but fire the second page, a burn rate of 6 over six hours and thirty minutes. That is one more reason to catch it as a small canary.

## Exercises

Predict the result before you run each one, then check:

1. **A healthy canary.** In `lab.py`, give the canary `Faults()` with no faults. The decision becomes `PROMOTE`.
2. **Too little traffic.** Run `run(traffic=20)` from a Python shell in the lab folder. The canary has served too few requests, and the decision is `WAIT`, never `PROMOTE`.
3. **A threshold without a bucket.** Add an objective with `threshold_seconds=0.3` to `DEFAULT_OBJECTIVES` in `slo.py`. The lab stops with a clear error; insert 0.3 into `LATENCY_BUCKETS` in `service.py`, keeping the bounds in increasing order, and it works.
4. **Cardinality.** Change `service.py` to use the raw path as the route label, send requests to a thousand random paths and count the series in `/metrics`. Then restore the bounded label.
5. **A log that leaks.** Log the full request target instead of the route and run the tests: the redaction test fails and names the leaked value.
6. **Synthetic traffic.** Add a `synthetic` field to the log event, true when the user agent is the probe's, so business reports can exclude probe traffic.
7. **An alert.** Using the burn-rate table from the SLO chapter, write the three alert conditions for the search availability SLO, and work out which of them a burn rate of 11.5 fires and which it does not.

## From the lab to real tools

Each part of the lab has a counterpart that does the same job at scale:

| In the lab | At work |
|---|---|
| Counters and histograms in `telemetry.py` | A Prometheus client library or the OpenTelemetry metrics SDK |
| The JSON logger | A structured logging library and a log pipeline, for example Workers Logs on this site |
| `traceparent` parsing and child spans | OpenTelemetry context propagation, which also passes the context to downstream calls |
| `slo.py` | Recording rules, SLO dashboards and burn-rate alerts in the monitoring system |
| `canary.py` | Automated canary analysis in the deployment system |
| `synthetic.py` | A synthetic monitoring service running checks continuously from several locations |

What does not change is the reasoning: agree on the fields and labels first, measure what users experience, compare a change with its control, decide only with enough data, and keep a trace id on every failure.

## Common mistakes

- **Adding telemetry after the incident.** The lab's signals exist before the first request; production services need the same.
- **Logging the full URL.** Query strings carry personal data and secrets; log the route.
- **Unbounded label values.** Raw paths, user ids or query strings as labels create a series per value.
- **An SLO threshold between buckets.** With a classic histogram the SLI cannot be computed exactly; plan the buckets with the SLO.
- **Trusting a passing synthetic check.** It finds outages, not error rates.
- **Judging a canary against the past or on too little traffic.** Compare with the control over the same period, and wait for enough requests.
- **Failing requests because of a bad trace header.** Ignore it and start a new trace.

## Summary

The lab puts the whole path into one runnable system: a service that writes one structured event per request, exposes counters and histograms in the Prometheus text format and continues W3C trace context; SLIs and burn rates computed from scraped metrics; a synthetic check that runs from outside; and a canary decision that compares with the control and waits for enough traffic. Its outputs show the main lessons in practice: a passing probe does not prove health, latency SLOs need matching bucket bounds, labels must be bounded, logs must not leak query strings, and a trace id turns a failed request into one log line. The same reasoning carries over unchanged to Prometheus, OpenTelemetry and the deployment and monitoring tools you use at work.
