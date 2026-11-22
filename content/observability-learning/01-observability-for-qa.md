# Observability for QA engineers

Tests tell you whether the behaviour you thought of works before release. Observability tells you what the system actually does: in staging, in production, under real load and in failures nobody predicted. For a QA engineer it is the difference between "the end-to-end test is red" and "the payment service timed out on the third retry because its database pool was exhausted".

This chapter covers monitoring versus observability, the signals a system emits, symptoms versus causes, how QA uses telemetry day to day, how to make tests themselves observable, and a real incident on this site that monitoring missed. Later chapters go deeper into [logs](/learn/observability?topic=structured-logs) and [metrics](/learn/observability?topic=metrics).

**Prerequisites:** [QA and testing fundamentals](/learn/qa-fundamentals?topic=qa-testing-fundamentals).

## Monitoring and observability

The two words are often used interchangeably, but they answer different questions:

| | Monitoring | Observability |
|---|---|---|
| Question | Is a known thing broken? | Why is this behaving the way it is? |
| Built from | Predefined checks, dashboards and thresholds | Rich telemetry you can slice in ways you did not plan |
| Good at | Known failure modes: the site is down, errors above 1% | New failure modes: only requests from one client version, with one feature flag, are slow |
| Typical output | An alert | An explanation |

Monitoring is a subset of what you do with observability. You still need alerts on the things you know can go wrong; observability is what lets you investigate the things you did not know about without shipping new code first. A system is observable when the telemetry it already emits is enough to answer a new question.

## The signals

Most telemetry falls into three signals, which OpenTelemetry, the open standard for collecting telemetry, supports as stable or widely used:

| Signal | What it is | Answers | Cost |
|---|---|---|---|
| Logs | Timestamped records of events, ideally structured | What exactly happened in this request? | Grows with traffic and verbosity |
| Metrics | Numeric measurements aggregated over time | How much, how often, how fast, across everything? | Cheap per data point; grows with label combinations |
| Traces | The path of one request through services, as a tree of timed spans | Where did the time go, and which service failed? | Grows with traffic; usually sampled |

OpenTelemetry also defines baggage for passing context, and is developing events and profiles. The signals are most useful together: a metric shows that errors rose, a trace shows which service failed, and the logs of that span show why.

```diagram
One checkout request, trace id 4bf92f…
   ├─ log:    {"event":"checkout_started","trace_id":"4bf92f…","cart_items":3}
   ├─ metric: http_requests_total{route="/checkout",status="500"} += 1
   ├─ trace:  checkout (2.4 s) → payment (2.1 s, error) → bank-api (timeout)
   └─ log:    {"event":"payment_failed","trace_id":"4bf92f…","reason":"upstream_timeout"}
```

The shared trace id is what turns three separate data sources into one story. OpenTelemetry log records carry TraceId and SpanId fields for exactly this reason.

## Symptoms and causes

Google's SRE book draws a line that is useful for testers too: a **symptom** is what is broken from the user's point of view; a **cause** is why.

| Symptom (what users see) | Possible causes |
|---|---|
| Checkout returns HTTP 500 | Database refuses connections; a new release has a bug; a dependency changed its API |
| Search is slow | Missing index; cache cold after deploy; one noisy tenant |
| Login works but the dashboard is empty | A background job failed; permissions changed; a feature flag is off |

Two kinds of monitoring follow from this. **Black-box** monitoring checks behaviour from the outside, like a user or a test would: is the page up, does the API answer correctly. **White-box** monitoring uses internal data such as metrics, logs and traces, and can show problems before users feel them or problems hidden by retries. Alert on symptoms; investigate causes with white-box data.

## How QA uses observability

| Situation | What to look at | What you gain |
|---|---|---|
| A flaky end-to-end test fails | The server logs and trace for the failing request | The real failure behind "element not visible": a 500, a timeout, a race |
| Verifying a release | Error rate and latency before and after the deploy, per endpoint | Regressions that no test covered |
| Exploratory testing | Logs and errors while you explore | Silent failures: a swallowed exception, a retry storm, a warning nobody reads |
| Performance testing | Server-side latency percentiles, saturation of CPU, memory, connections | Where the bottleneck is, not only that there is one |
| Production incidents | The first symptom, the timeline, what changed | Missing tests and missing alerts to add afterwards |
| Prioritising tests | Errors and slow paths seen in production | Tests for what actually breaks, not only for what the specification lists |

The common thread: telemetry turns a test result into evidence about the system, and production into a source of test ideas.

## Make tests observable

Tests are clients of the system, so they can make their own requests easy to find. The simplest technique is a correlation id: the test generates an id, sends it with every request (for example in an `X-Request-Id` header or in a W3C `traceparent` header if the system uses tracing), and the services log it. When the test fails, it can collect exactly the log lines of its own requests.

The code below shows the idea with a list of log events: it finds the events of one test's request and prints the chain that explains the failure.

```python
import json

LOG_LINES = [
    '{"ts": "12:00:01.100", "level": "info", "event": "checkout_started", "request_id": "test-7f3a", "service": "web"}',
    '{"ts": "12:00:01.105", "level": "info", "event": "checkout_started", "request_id": "user-91c2", "service": "web"}',
    '{"ts": "12:00:01.300", "level": "warn", "event": "payment_retry", "request_id": "test-7f3a", "service": "payments", "attempt": 2}',
    '{"ts": "12:00:03.410", "level": "error", "event": "payment_failed", "request_id": "test-7f3a", "service": "payments", "reason": "upstream_timeout"}',
    '{"ts": "12:00:03.420", "level": "info", "event": "checkout_completed", "request_id": "user-91c2", "service": "web"}',
    '{"ts": "12:00:03.450", "level": "error", "event": "checkout_failed", "request_id": "test-7f3a", "service": "web", "status": 500}',
]

def events_for(request_id, lines):
    events = [json.loads(line) for line in lines]
    return [event for event in events if event.get("request_id") == request_id]

def explain(request_id, lines):
    chain = events_for(request_id, lines)
    for event in chain:
        details = {key: value for key, value in event.items() if key not in ["ts", "level", "event", "request_id", "service"]}
        print(event["ts"], event["level"].upper(), event["service"], event["event"], details or "")
    first_error = next((event for event in chain if event["level"] == "error"), None)
    if first_error:
        print("first error:", first_error["service"], first_error["event"], first_error.get("reason", ""))

explain("test-7f3a", LOG_LINES)
```

The test only saw a 500 from checkout. The logs of its own request show that the first error was a payment timeout after a retry, which points the investigation at the payment service, not at the web page.

## Case study: the disk that filled up

In November 2026 a deployment of this site's AI service failed with a single unhelpful line: `scp: write remote ".../gimmejob-ai.env": Failure`. The cause was a server disk that was 100% full. Every deployment pulled a new container image and left the previous one behind, and more than a hundred old images had accumulated over five months.

The interesting part for observability is what had already gone wrong unnoticed. A database container used by the site's database playground had crashed eight days earlier, and several other containers were reporting themselves unhealthy. Nothing alerted, because nothing measured disk saturation and nothing checked the playground from the outside. The first visible symptom was a deployment failure in an unrelated pipeline.

The fixes map directly onto this chapter:

- **A saturation signal.** The deployment now checks free disk space first and fails with a clear message when less than 2 GB is free, instead of failing on a file upload.
- **Removing the cause.** Each deployment deletes the image it replaced.
- **A lesson about black-box checks.** A simple external check of the database playground would have shown the broken service on the first day.

## Common mistakes

- **Treating dashboards as observability.** Dashboards answer questions you already had; you also need data to answer new ones.
- **Signals that cannot be joined.** Logs, metrics and traces without a shared request or trace id are three separate puzzles.
- **Alerting on causes.** High CPU is not an incident; slow or failing requests are.
- **Only white-box data.** Without an external check you learn about outages from users.
- **Tests that leave no trace.** A failing test without a correlation id makes server-side investigation guesswork.
- **Ignoring saturation.** Disks, connection pools and queues fill slowly and fail suddenly.

## Summary

Monitoring checks for known failures; observability lets you ask new questions of the telemetry a system already emits. Logs, metrics and traces each answer different questions, and a shared trace or request id turns them into one story. Alert on symptoms users feel and use white-box data to find causes. As a QA engineer, use telemetry to explain test failures, verify releases, guide exploratory and performance testing and learn from production, and make your own tests easy to find with correlation ids.
