# SLIs, SLOs and error budgets

"Is the system reliable enough?" has no answer until someone says what "enough" means. Service level objectives turn that question into numbers: which user-visible behaviour is measured, what share of it must be good, over which period, and what happens when the target is missed. For QA engineers, SLOs are acceptance criteria for production, and error budgets are a shared rule for when to ship and when to stop.

This chapter covers SLIs, SLOs and SLAs, how to choose indicators, how to set targets, error budgets and the policies around them, burn-rate alerts, and how QA uses all of this. The measurement side is covered in [Metrics, golden signals and percentiles](/learn/observability?topic=metrics).

**Prerequisites:** [Metrics, golden signals and percentiles](/learn/observability?topic=metrics).

## SLI, SLO and SLA

| Term | What it is | Example |
|---|---|---|
| Service level indicator (SLI) | A carefully defined measure of one aspect of service quality | The share of search requests that return a correct result within 300 ms |
| Service level objective (SLO) | A target for an SLI over a period | 99% of search requests within 300 ms, over a rolling 28 days |
| Service level agreement (SLA) | A contract with consequences if objectives are missed | Service credits if monthly availability falls below 99.5% |

Google's SRE book offers a simple test: if missing the target has no explicit consequence, it is an SLO, not an SLA. Most teams need SLOs long before they need SLAs, and an SLA should always be looser than the internal SLO behind it.

## Choosing SLIs

Good SLIs describe what users experience, not what is easy to measure. Start from user journeys and express each indicator as a ratio of good events to valid events:

| User journey | SLI | Good event | Valid event |
|---|---|---|---|
| Search vacancies | Availability | Response without a server error | Every well-formed search request |
| Search vacancies | Latency | Response within 300 ms | Every successful search request |
| Open a learning chapter | Availability | Page rendered with its chapter | Every request for a published chapter |
| Nightly vacancy import | Freshness | Data updated within the last 24 hours | Every hour of the period |
| Learning Path Advisor | Correctness | Every cited link points to retrieved material | Every answer with citations |

A few rules keep SLIs useful: measure as close to the user as practical; use the share of requests under a threshold rather than averages; exclude invalid events explicitly, such as malformed requests and test traffic; and keep the set small enough that everyone knows it.

## Setting targets

The SRE book's advice is blunt: do not pick a target from current performance, because that turns accidents of today's system into promises. Choose the level users need, then check whether the system can meet it.

- **100% is the wrong target.** Users cannot tell 99.999% from 100%, and chasing it stops every change.
- **Fewer, simpler SLOs.** A handful per service that you would actually act on.
- **Start loose, tighten later.** A target you can defend is better than an ambitious one you ignore.
- **Fix the window.** Rolling 28 or 30 days is common; it should match how you plan work.
- **Use several thresholds for latency when needed.** For example, 90% under 100 ms and 99% under 1 s.

## Error budgets

An error budget is the amount of unreliability the SLO allows: one minus the target. At 99.9% over four weeks, a service that handles one million requests may fail a thousand of them. The budget changes the conversation between people who ship features and people who keep the service running, because both can see the same number.

| Situation | What the budget says |
|---|---|
| Budget left, reliability above target | Ship, experiment, take reasonable risks |
| Budget nearly spent | Slow down, prefer reliability work, review risky changes |
| Budget exhausted | Stop feature releases until the service is back within its SLO |

Google's example error budget policy makes the last row concrete: when a service has exceeded its budget over the preceding four weeks, all changes and releases stop except urgent fixes and security fixes, until it is back within the SLO. A single incident that consumes more than 20% of the four-week budget requires a postmortem with at least one high-priority action. The policy also lists exceptions: an outage caused by another team that has frozen its own releases, or budget consumed by out-of-scope traffic such as load tests, does not have to stop feature work.

## Burn rate and alerting

Alerting on every error is noisy; alerting only when the monthly budget is gone is too late. The SRE workbook recommends alerting on the **burn rate**: how fast the budget is being spent relative to the SLO. A burn rate of 1 uses exactly the whole budget by the end of the period; a burn rate of 10 uses it in a tenth of the time.

For a 99.9% SLO over 30 days, the workbook's recommended multiwindow, multi-burn-rate alerts are:

| Severity | Long window | Short window | Burn rate | Budget used when it fires |
|---|---|---|---|---|
| Page | 1 hour | 5 minutes | 14.4 | 2% |
| Page | 6 hours | 30 minutes | 6 | 5% |
| Ticket | 3 days | 6 hours | 1 | 10% |

Both windows must exceed the threshold. The long window shows that the problem is significant; the short window, one twelfth of the long one, shows that it is still happening, so the alert stops soon after recovery. The code below evaluates these rules for a set of observed error counts:

```python
SLO = 0.999
PERIOD_HOURS = 30 * 24
WINDOW_HOURS = {"5m": 5 / 60, "30m": 0.5, "1h": 1, "6h": 6, "3d": 72}
RULES = [("page", "1h", "5m", 14.4), ("page", "6h", "30m", 6), ("ticket", "3d", "6h", 1)]

observed = {  # (failed, total) per window, ending now
    "5m": (52, 3000),
    "30m": (310, 18000),
    "1h": (560, 36000),
    "6h": (1000, 216000),
    "3d": (2000, 2592000),
}

def burn_rate(failed, total):
    if total == 0:
        return 0.0
    return failed / total / (1 - SLO)

for severity, long_window, short_window, threshold in RULES:
    long_rate = burn_rate(*observed[long_window])
    short_rate = burn_rate(*observed[short_window])
    budget_used = long_rate * WINDOW_HOURS[long_window] / PERIOD_HOURS
    fires = long_rate >= threshold and short_rate >= threshold
    print(f"{severity:6} {long_window:>3}/{short_window:<3} burn {long_rate:5.1f} / {short_rate:5.1f}  "
          f"budget used {budget_used:6.1%}  -> {'FIRES' if fires else 'quiet'}")

failed_total, total = observed["3d"]
print("allowed failures over 30 days at this traffic:", round((1 - SLO) * total * 10))
```

In this example the fast-burn page fires: errors over the last hour and the last five minutes are both far above 14.4 times the allowed rate. The slower rules stay quiet because the problem has not lasted long enough to matter at their scale.

## SLOs in QA work

| Task | How SLOs help |
|---|---|
| Acceptance criteria | Express performance and reliability requirements as SLO-style thresholds that can be measured in production too |
| Release decisions | Check the remaining error budget before a risky release; a spent budget is a reason to wait |
| Load and soak testing | Test against the SLO thresholds, not against arbitrary averages |
| Testing the SLI itself | Verify that the measurement counts what users see: errors hidden by retries, test traffic excluded, timeouts counted as failures |
| Incident follow-up | Use budget consumption to decide which incidents need a postmortem and which fixes come first |

Testing the SLI is the part most often forgotten. An availability SLI that counts only responses from the server misses requests that never arrived; a latency SLI measured inside the service misses time in queues and networks. A wrong SLI produces confident, wrong decisions.

## Worked example: SLOs for this site

GimmeJob has no formal SLOs today, but the data it already collects is enough to define a first set. As a proposal:

| Journey | SLI from existing data | Possible SLO |
|---|---|---|
| Learning and interview pages | Share of page requests answered without a server error, from runtime logs | 99.5% over 28 days |
| Vacancy import | Share of scheduled source syncs with outcome success, from the stored operation events | 95% over 28 days, per source |
| Production deploys | Share of deploys whose production verification passes on the first run | 90% over 28 days |
| Learning Path Advisor | Share of answers whose cited links all survive the grounding check | 99% over 28 days |

The vacancy import is a good first candidate: success and failure are already recorded per run with a reason code, so the SLI is a query, and a missed target points straight at the failing source.

## Common mistakes

- **SLIs that measure the system, not the user.** CPU and queue length are causes; users feel errors and latency.
- **Targets copied from current performance.** Today's numbers include luck; choose what users need.
- **100% targets.** They forbid change and cannot be met.
- **Averages in SLIs.** Use the share of requests under a threshold.
- **No error budget policy.** A budget nobody acts on is a dashboard, not a decision rule.
- **Alerting on raw error rates.** Short spikes page people at night; burn-rate alerts react to what threatens the objective.
- **Test traffic inside the SLI.** Load tests and synthetic checks should be excluded or measured separately.

## Summary

An SLI is a ratio of good events to valid events that users would recognise; an SLO is a target for it over a period; an SLA adds consequences. Choose a few SLIs from user journeys, set targets from user needs rather than current performance, and never aim for 100%. The error budget, one minus the target, tells teams when they can ship and when they must stop, and a written policy makes that decision automatic. Alert on burn rate with long and short windows so that pages mean real threats to the objective. In QA work, SLOs are measurable acceptance criteria, release gates and the scale against which load tests and incidents are judged.
