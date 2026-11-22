# Observability lab: SLOs, a canary and a synthetic check

Chapter: [Observability lab](https://gimme-job.com/learn/observability?topic=observability-lab)

A small job-search service that emits the three signals of this learning path, and the tools a QA engineer uses to judge a release with them. Python standard library only: no Prometheus, no collector, no API key. The service writes the same formats real systems use, so everything you learn here transfers.

| File | Content |
|---|---|
| `telemetry.py` | W3C `traceparent` parsing and propagation, counters and histograms in the Prometheus text format, a JSON-lines logger |
| `service.py` | The service: `/api/search`, `/healthz` and `/metrics`, one JSON log event per request with trace and span ids, bounded route labels, and deterministic fault injection (every Nth search fails or is slow) |
| `slo.py` | Parses the text format and computes availability and latency SLIs, error-budget burn rate and SLO verdicts |
| `canary.py` | Compares a canary with the control group on the same objectives and decides promote, roll back or wait |
| `synthetic.py` | A black-box check that calls the service from outside, with its own `traceparent` on every step |
| `lab.py` | Runs everything: a control and a faulty canary side by side, synthetic checks, traffic, SLOs, a canary decision, and the path from a failed request to its log line |
| `test_observability_lab.py` | 24 checks: format rules, propagation, log fields and redaction, label cardinality, SLO arithmetic, canary decisions, synthetic checks over real HTTP |

## Run it

From the repository root (Python 3.12 or newer):

```bash
python examples/observability-lab/lab.py
python -m unittest discover -s examples/observability-lab -v
```

The lab prints five steps (timings and ids differ on every run):

```text
1. Synthetic checks: one request per step, from outside
   control 1.4.0 health  200    3.1 ms trace 35fc39a5... ok
   control 1.4.0 search  200    2.5 ms trace bf3e05c1... ok
   canary 1.5.0  health  200    2.3 ms trace 41be33c2... ok
   canary 1.5.0  search  200    2.9 ms trace 5ca4b647... ok

2. Traffic: 60 searches to each version

3. SLOs computed from each version's /metrics
   control 1.4.0 availability 100.00% of  61 (target 99%, burn rate   0.0) met
   control 1.4.0 latency      100.00% of  61 (target 95%, burn rate   0.0) met
   canary 1.5.0  availability  88.52% of  61 (target 99%, burn rate  11.5) MISSED
   canary 1.5.0  latency       80.33% of  61 (target 95%, burn rate   3.9) MISSED

4. Canary decision
   ROLLBACK: availability 88.5% on the canary vs 100.0% on the control; latency 80.3% on the canary vs 100.0% on the control

5. From a failed request to its log line: trace b50a2e97...
   1 log line(s) with this trace id:
   {"ts": "...", "level": "error", "service": "search", "version": "1.5.0", "event": "http_request", "method": "GET", "route": "/api/search", "status": 500, ...}
```

To poke at the service by hand, run it on its own and use any HTTP client:

```bash
python examples/observability-lab/service.py --port 8080 --error-every 10
curl "http://127.0.0.1:8080/api/search?q=qa"
curl http://127.0.0.1:8080/metrics
python examples/observability-lab/synthetic.py http://127.0.0.1:8080
```

## What it demonstrates

- **A synthetic check can pass while users suffer.** Both versions pass their synthetic checks in step 1, yet the canary fails one search in eight. One request every few minutes finds outages, not intermittent errors; the SLIs computed from all traffic do.
- **Compare the canary with the control, not with the past.** Both groups run at the same time and see the same traffic, so a difference between them is the change, not the time of day.
- **Enough traffic before a verdict.** With too few requests the canary decision is `wait`, never `promote`.
- **A latency SLO needs a bucket at its threshold.** `slo.latency` refuses a threshold that is not a bucket bound, because a histogram cannot say how many requests inside a bucket were faster than an arbitrary value.
- **Bounded labels.** Every unknown path is counted under `route="unmatched"`; 100 scanner requests make one series, not 100.
- **Logs that help and do not leak.** Every event has the same fields, including `trace_id`, `span_id` and `parent_span_id`, and the service logs the route, never the query string with its emails and tokens.
- **Trace ids connect the signals.** The synthetic check and the traffic generator send `traceparent`; the service continues the trace, returns the id in `x-trace-id` (a convention of this lab, so a tester can put it in a bug report), and the id finds the one log line for that request.

## Ways to extend it

- Scrape the service with a real Prometheus and write the burn-rate alerts from [SLIs, SLOs and error budgets](https://gimme-job.com/learn/observability?topic=slo-error-budgets) as alerting rules.
- Replace `telemetry.py` with the OpenTelemetry SDK and export traces to a local collector; the log fields and the `traceparent` format stay the same.
- Add a downstream service and propagate the context to it, then find the slow span from [Distributed tracing](https://gimme-job.com/learn/observability?topic=distributed-tracing).
- Put the canary decision behind a feature flag with a kill switch, as described in [Testing in production](https://gimme-job.com/learn/observability?topic=testing-in-production).
