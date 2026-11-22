# Logs that answer questions

A log is the system's own account of what happened. Good logs let you answer a question about a single request or a single failure in minutes; bad logs force you to read thousands of lines of prose and still guess. The difference is mostly design: what an event contains, how it is structured, what it must never contain, and how long it lives.

This chapter covers logs as event streams, structured events, the fields every event needs, log levels, what must never be logged, querying, sampling and retention, logs in tests, and how this site splits its logging into two layers. The bigger picture is in [Observability for QA engineers](/learn/observability?topic=observability-for-qa).

**Prerequisites:** [Observability for QA engineers](/learn/observability?topic=observability-for-qa).

## Logs are event streams

The Twelve-Factor App describes logs as a time-ordered stream of events with no beginning or end. An application should not manage log files; it writes events to standard output, and the environment routes them to storage, search and alerting. This matters for testing too: in a container, a serverless function or a CI job, stdout is usually the only log you will ever see.

## Structured, not formatted

A line written for a human to read is hard for a machine to search:

```text
2026-11-21 13:05:12 ERROR Sync of dou-qa failed after 2 retries (HTTP 403) in 812ms
```

The same event as structured data can be filtered by any field:

```json
{"ts": "2026-11-21T13:05:12.481Z", "level": "error", "event": "job_source_sync", "outcome": "failure", "source": "rss:dou-qa", "reasonCode": "upstream_http_error", "httpStatus": 403, "retries": 2, "durationMs": 812, "operationId": "sync_7c41"}
```

OpenTelemetry makes a useful distinction here: a log is structured when it follows a stable schema, not merely when it is valid JSON. If every developer invents field names, you get "semistructured" logs that are machine-readable but still hard to query. Agree on event names and field names once, and keep them stable.

## Fields every event needs

| Field | Why |
|---|---|
| Timestamp in UTC, with milliseconds | Ordering events across services |
| Level | Separating actionable errors from routine information |
| Event name | A stable identifier to count and filter by (`job_source_sync`, not a sentence) |
| Outcome | `success`, `failure`, `degraded`: one field to filter on instead of parsing messages |
| Correlation ids | Request id, operation id or trace and span ids, to join events of one request |
| Service and version | Which deployment produced the event |
| Duration | How long the operation took, in a fixed unit |
| Safe reason code | A classified cause such as `upstream_http_error`, not a raw exception text |

With these fields most questions become a filter: all failures of one source this week, every event of one operation, the slowest syncs after a deploy.

## Levels and noise

Levels are only useful if they mean something:

| Level | Use for | Not for |
|---|---|---|
| error | Something failed and someone may need to act | Expected outcomes such as a user typing a wrong password |
| warn | Something unusual that the system handled: a retry, a fallback | Every slow request |
| info | Business-relevant events: started, completed, outcome | Per-item details of a loop |
| debug | Details for development, usually off in production | Anything you need to investigate production incidents |

A common anti-pattern in test environments is logging every expected failure as an error. When everything is red, nothing is; a real error drowns in noise.

## What never to log

Logs are copied, shipped to third-party tools, kept for days and read by many people. The OWASP Logging Cheat Sheet lists data that must never be logged, or must be masked, hashed or removed first:

- passwords, access tokens, API keys, secrets and connection strings;
- session identifiers (log a hash if you need to correlate);
- payment card data and bank account details;
- sensitive personal data, and anything your privacy policy says you do not store.

Two more rules from the same cheat sheet matter in practice. **Log injection:** user input that contains line breaks can forge log entries, so structured formats such as JSON, which escape them, are safer than plain text. **Logging must not break the application:** if the logging backend fails, the request should still succeed.

## Querying, sampling and retention

Structured logs are queried by fields. On Cloudflare, which runs this site's Worker, queries look like this:

```text
event = "job_source_sync" AND outcome = "failure"
reasonCode = "upstream_http_error" AND httpStatus = 403
operationId = "sync_7c41"
```

Two platform settings decide what you can find later. **Sampling** keeps only a share of requests; Workers Logs has a head-sampling rate between 0 and 1, and a sampled-out warning simply does not exist. **Retention** limits how far back you can look; Workers Logs keeps logs for 3 days on the free plan and 7 days on the paid plan. Know both numbers for your system before an incident, not during one.

## Logs in tests

Treat logs as part of the system's behaviour, and test them like any other output:

- **Assert on events, not on text.** Check that a failed login produces an `auth_failed` event with a reason code, not that a message contains a word.
- **Assert on what is missing.** A test can check that no event contains a token, a password or a full card number.
- **Collect logs on failure.** Attach the events of the failing test's requests to the test report, using a correlation id.

The checker below validates a batch of events against the rules of this chapter: required fields, no secrets and no line breaks inside values.

```python
import json
import re

REQUIRED = ["ts", "level", "event", "outcome", "operationId"]
SECRET_PATTERNS = [r"(?i)bearer\s+[a-z0-9._-]{10,}", r"(?i)password", r"\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b"]

def check_event(raw):
    problems = []
    event = json.loads(raw)
    missing = [field for field in REQUIRED if field not in event]
    if missing:
        problems.append("missing " + ", ".join(missing))
    for key, value in event.items():
        text = str(value)
        if "\n" in text or "\r" in text:
            problems.append(f"line break in {key}")
        if any(re.search(pattern, f"{key}={text}") for pattern in SECRET_PATTERNS):
            problems.append(f"possible secret in {key}")
    return problems

batch = [
    '{"ts": "2026-11-21T13:05:12Z", "level": "error", "event": "job_source_sync", "outcome": "failure", "operationId": "sync_7c41"}',
    '{"ts": "2026-11-21T13:05:13Z", "level": "info", "event": "login", "outcome": "success", "operationId": "auth_19", "authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.x.y"}',
    '{"ts": "2026-11-21T13:05:14Z", "level": "warn", "event": "comment_saved", "outcome": "success", "operationId": "cmt_3", "comment": "ok\\nERROR admin deleted"}',
    '{"level": "info", "event": "checkout", "card": "4111 1111 1111 1111"}',
]
for raw in batch:
    print(check_event(raw) or "OK")
```

## Case study: two logging layers in GimmeJob

This site separates long-term trends from short-term diagnostics:

| Layer | Stores | Kept | Used for |
|---|---|---|---|
| Aggregated operation data in the database | Event, status, source, mode, duration, item counts, error count, a safe reason code and HTTP status, daily snapshots | Until deleted | Source reliability, error reasons over 30 days, fallback counts, dashboards |
| Structured runtime logs on Cloudflare | Operation id, stage-level failures, source and fallback details, safe error classification, bounded stacks for unexpected failures | Days, by plan | Investigating a specific failure |

The long-term layer never stores raw exception messages, stack traces, request or response payloads, secrets or personal content. That rule is what makes it safe to keep indefinitely and to show in dashboards. When something fails, the operation id from the long-term data leads straight to the detailed runtime events, as long as you look within the retention window.

## Common mistakes

- **Prose instead of events.** Sentences cannot be counted, filtered or joined.
- **Unstable field names.** `userId`, `user_id` and `uid` in three services make every query a guess.
- **No correlation id.** Events of one request cannot be found together.
- **Everything at error level.** Real errors disappear in noise.
- **Secrets and personal data in logs.** Logs travel further and live longer than you expect.
- **Unknown sampling and retention.** The event you need may never have been kept, or may already be gone.
- **Testing log text.** Assert on structured fields, or harmless wording changes will break tests.

## Summary

Write logs as a stream of structured events with a stable schema: timestamp, level, event name, outcome, correlation ids, service and version, duration and a safe reason code. Use levels to separate what needs action from routine information. Never log secrets, session ids, payment data or sensitive personal data, and prefer formats that escape line breaks. Know your sampling and retention before you need them. In tests, assert on events and their fields, check that nothing sensitive leaks, and attach the events of a failing test's requests to its report.
