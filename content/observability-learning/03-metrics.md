# Metrics, golden signals and percentiles

Logs describe individual events; metrics describe the system as a whole. A metric is a number measured repeatedly over time: requests per second, errors per minute, the distribution of response times, the free space on a disk. Metrics are cheap to keep for a long time and fast to query, which makes them the basis of dashboards, alerts and service level objectives.

This chapter covers metric types, what to measure with the golden signals, RED and USE, why averages hide the slow requests users notice, which percentiles can and cannot be combined, cardinality and naming, and how QA engineers use metrics. Logs are covered in [Logs that answer questions](/learn/observability?topic=structured-logs).

**Prerequisites:** [Observability for QA engineers](/learn/observability?topic=observability-for-qa).

## Metric types

Prometheus and OpenTelemetry use slightly different names for the same few instrument types:

| Type | What it records | Example | Typical query |
|---|---|---|---|
| Counter | A value that only goes up, reset on restart | `http_requests_total` | Rate per second over a window |
| Gauge | A value that goes up and down | Free disk bytes, queue length, active connections | Current value, minimum, maximum |
| Histogram | Observations counted into buckets, plus sum and count | `http_request_duration_seconds` | Percentiles, average, share under a threshold |
| Summary (Prometheus) | Quantiles computed inside the application | Request latency p95 per instance | Read directly; cannot be combined across instances |

OpenTelemetry calls a counter that can decrease an UpDownCounter and treats the gauge as a value read at a point in time. The practical rule is the same in both: use counters for things that happen, gauges for things that are, and histograms for durations and sizes.

## What to measure

Three short lists cover most services and resources:

| Method | Applies to | Measures |
|---|---|---|
| Four golden signals (Google SRE) | Any user-facing system | Latency, traffic, errors, saturation |
| RED (Tom Wilkie) | Each service or endpoint | Rate of requests, errors, duration |
| USE (Brendan Gregg) | Each resource: CPU, memory, disk, network, connection pools | Utilization, saturation, errors |

RED is the golden signals without saturation, applied per service. USE looks one level lower, at the resources a service depends on. Together they answer the two questions an investigation starts with: are users affected, and which resource is running out?

Two details from the SRE book are easy to miss. Measure the latency of successful and failed requests separately, because a fast error can make average latency look better while users suffer. And watch saturation before it hits 100%: disks, pools and queues degrade gradually and fail suddenly.

## Averages hide the tail

The SRE book gives the classic example: an average latency of 100 ms can hide requests that take five seconds. Users notice the slow ones. Percentiles show them: p50 is the median, p95 is the time 95% of requests stay under, p99 the time 99% stay under.

Percentiles have one trap: you cannot average them. If each of three servers reports its own p95, the average of those numbers is not the p95 of all requests, and the Prometheus documentation calls averaging such quantiles statistically meaningless. Keep the raw distribution, as a histogram, and compute the percentile over all of it.

```python
import statistics

def percentile(values, p):
    ordered = sorted(values)
    index = max(0, round(p / 100 * len(ordered)) - 1)
    return ordered[index]

server_a = [80] * 95 + [120] * 5
server_b = [90] * 90 + [400] * 10
server_c = [85] * 70 + [2500] * 30
everything = server_a + server_b + server_c

print("average:", round(statistics.mean(everything)), "ms")
print("p50:", percentile(everything, 50), "ms   p95:", percentile(everything, 95), "ms   p99:", percentile(everything, 99), "ms")
per_server_p95 = [percentile(server, 95) for server in [server_a, server_b, server_c]]
print("per-server p95:", per_server_p95, "-> wrong 'average p95':", round(statistics.mean(per_server_p95)), "ms")
print("share of calls over 1 s:", round(sum(1 for value in everything if value > 1000) / len(everything), 2))
```

The average looks acceptable, the median looks great, and a tenth of all requests take two and a half seconds. The averaged p95 is a number that describes no real request.

A histogram also answers the question that matters most for objectives: what share of requests finished under a threshold. "99% of checkouts under 1 second" is easier to test, alert on and explain than any average.

## Cardinality

Every unique combination of a metric's labels creates a separate time series. A label with a few values, such as `status="500"` or `route="/checkout"`, is fine. A label with unbounded values, such as a user id, an e-mail address or a full URL with query parameters, creates one series per value and can overload the metrics system or the bill.

Prometheus warns against unbounded label values for this reason, and the OpenTelemetry SDK limits the number of attribute combinations per metric by default and folds the rest into an overflow series, so filters on an overflowed metric undercount. Put high-cardinality details in logs and traces, and keep metrics to labels you could list on one screen.

## Naming

Consistent names save hours during an incident. Prometheus recommends:

- a prefix for the application or domain;
- base units, such as seconds and bytes, with the unit as a suffix: `http_request_duration_seconds`;
- `_total` at the end of counters: `jobs_synced_total`;
- ratios between 0 and 1, not percentages;
- labels for dimensions instead of encoding them into the name: `http_requests_total{status="500"}`, not `http_requests_500_total`.

## Metrics in QA work

| Task | Metrics to use |
|---|---|
| Verifying a deploy | Error rate and latency percentiles per endpoint, before and after |
| Load and performance testing | Server-side p95 and p99, throughput, and USE metrics of the resources under test |
| Checking a fix for an intermittent failure | The error counter for that failure over days, not one green run |
| Testing alerts | Push the metric over the threshold in a test environment and confirm the alert fires and recovers |
| Setting acceptance criteria | Thresholds as shares under a limit ("95% of searches under 300 ms"), measured from a histogram |

Load-test tools report client-side latency; compare it with server-side metrics to see whether the time is spent in the service or in the network and the test tool. The [performance testing track](/learn/performance) covers workload design and analysis in depth.

## Case study: the saturation nobody measured

The disk-full incident described in [Observability for QA engineers](/learn/observability?topic=observability-for-qa&section=case-study-the-disk-that-filled-up) is a textbook gap in the USE method. The disk's utilization grew a little with every deployment for five months, and nobody measured it. A gauge of free disk bytes with an alert at, say, 80% usage would have raised the problem weeks earlier, long before a database container crashed.

The site's long-term operation data shows the other side: counters per source and outcome, durations, and error reasons by code and HTTP status over 30 days. Those are RED-style metrics derived from structured events, which is often the cheapest way to start: count the events you already log.

## Common mistakes

- **Averages on dashboards.** They hide the tail users feel; show percentiles or shares under a threshold.
- **Averaging percentiles.** Combine histograms, then compute the percentile.
- **Only success latency, or only total latency.** Measure successes and failures separately.
- **No saturation metrics.** Disks, memory, pools and queues fill quietly until they fail.
- **Unbounded labels.** User ids and raw URLs in labels explode the number of series.
- **Units in names but not in values.** Pick base units and stick to them.
- **One green load test as proof.** Compare distributions over time, not single runs.

## Summary

Use counters for things that happen, gauges for current values and histograms for durations and sizes. Measure the golden signals for user-facing systems, RED for each service and USE for each resource, and never forget saturation. Report percentiles or the share of requests under a threshold instead of averages, and compute percentiles from combined histograms rather than averaging per-instance values. Keep labels bounded, names consistent and units basic. In QA work, compare metrics before and after changes, read server-side metrics during load tests, and express acceptance criteria as thresholds you can measure.
