# Testing in production

Tests before a release cannot reproduce everything production has: real traffic, real data, real dependencies and the passage of time. Testing in production does not mean skipping those tests. It is a set of controlled techniques that check a change where it actually runs, limit how many users a problem can reach, and detect and undo problems quickly. Every one of them depends on the signals from the earlier chapters of this path.

This chapter covers why production needs its own checks, synthetic monitoring, canary releases, feature flags and kill switches, dark launches, chaos engineering, the safety rules that apply to all of them, and how this site tests in production. A runnable version of the canary and the synthetic check is in the [Observability lab](/learn/observability?topic=observability-lab).

**Prerequisites:** [Metrics, golden signals and percentiles](/learn/observability?topic=metrics), [SLIs, SLOs and error budgets](/learn/observability?topic=slo-error-budgets), [Alerting and incident response](/learn/observability?topic=alerting-incidents).

## Why production needs its own checks

A test environment is a model of production, and every model leaves something out:

| Difference | What only production has | Typical problem found late |
|---|---|---|
| Traffic | Real volume, mix and peaks | A query that is fast for ten users and slow for ten thousand |
| Data | Real shapes, old records, unusual characters | A migration that fails on rows created years ago |
| Dependencies | Real third-party APIs, quotas, rate limits | A provider that throttles you only at real volume |
| Configuration | Real secrets, flags, DNS, CDN and cache rules | A cache rule that serves a stale page after a release |
| Time | Long-running state, growing logs and disks | A disk that fills up over months |

The useful question is therefore not "test before release or in production" but which risk each technique reduces, how it limits the damage and which signal it relies on:

| Technique | Question it answers | How it limits the damage | Signal it needs |
|---|---|---|---|
| Synthetic monitoring | Does the main journey work right now, from outside? | Probe traffic only, no real users | Check results and latency |
| Canary release | Is the new version worse than the old one under real traffic? | A small share of traffic for a limited time | Errors and latency per version |
| Feature flag | Can we turn this behaviour on for some users and off at once? | Per user, per percentage, kill switch | Metrics split by flag state |
| Dark launch | Can the back end handle the new work before users see it? | Users see nothing | Load, latency and errors of the hidden path |
| Chaos experiment | Does the system keep its steady state when something fails? | Smallest possible scope, abort conditions | Steady-state metrics |

## Synthetic monitoring

Synthetic monitoring is black-box testing of the externally visible behaviour of a system, the way a user reaches it, instead of relying on instrumentation inside the code. Checks run continuously from probe locations and assess availability, performance and correctness. It is the automated form of the black-box monitoring that the SRE book recommends for symptoms that are happening now.

A good synthetic check is a small end-to-end test with production manners:

- **It checks content, not only the status code.** A 200 with an empty result list or an error page is a failure.
- **It has a latency budget.** A journey that works in 20 seconds is broken for users.
- **It runs from outside** your network and infrastructure, so it fails when users fail.
- **It uses dedicated test accounts and data**, never a real customer's.
- **It marks its traffic**, for example with its own user agent, so it can be excluded from business metrics, analytics and billing.
- **It has no lasting side effects**: it reads, or writes only clearly marked test data that is cleaned up.
- **It reports a trace id** with every failure, so the investigation starts from the right log line.

A synthetic check has one big limitation: a probe every few minutes detects outages, not a small error rate. If one request in a hundred fails, a probe will pass almost every time while thousands of users see errors. Synthetic checks complement SLIs computed from real traffic; they do not replace them. The lab shows exactly this: both versions pass their synthetic checks, and only the metrics reveal that the canary fails one search in eight.

## Canary releases

A canary release is a partial, time-limited deployment of a change, evaluated to decide whether to proceed. The part of production that receives the change is the canary; the rest is the control. In effect it is an A/B test of the new version against the old one. Other names for the same idea are phased or incremental rollout.

```diagram
deploy the new version to a small share of traffic (the canary)
   ↓
compare canary and control over the same period: error rate, latency
   ↓
enough traffic? ── no ──▶ wait
   ↓ yes
worse than control? ── yes ──▶ roll back: route all traffic to the old version
   ↓ no
widen step by step: 5% → 25% → 50% → 100%
```

The SRE workbook's guidance on running a canary:

- **Population.** A small subset of production; its example uses 5%.
- **Duration.** Matched to the release cadence: a team that releases daily cannot wait a week for a canary.
- **Metrics.** A few, perhaps no more than a dozen, that reflect user-visible problems, such as HTTP status codes and latency. CPU usage is a weak signal.
- **Canary versus control.** Every metric is split by population and compared over the same period. A before-and-after comparison mixes the change with everything else that changed in the meantime.
- **One canary at a time**, so a bad result points at one change.

The judgement itself is simple code, and the most important line is the one that refuses to decide too early:

```python
MIN_SERVED = 500
TOLERANCE = 0.005

control = {"served": 19000, "errors": 38, "slow": 410}
canaries = {
    "too early": {"served": 120, "errors": 0, "slow": 2},
    "healthy": {"served": 1000, "errors": 2, "slow": 23},
    "regression": {"served": 1000, "errors": 9, "slow": 61},
}

def rates(group):
    return {"errors": group["errors"] / group["served"], "slow": group["slow"] / group["served"]}

def judge(control, canary):
    if canary["served"] < MIN_SERVED:
        return "wait", [f"only {canary['served']} served, too few to judge"]
    baseline = rates(control)
    observed = rates(canary)
    worse = []
    for signal in observed:
        if observed[signal] > baseline[signal] + TOLERANCE:
            worse.append(f"{signal} {observed[signal]:.1%} vs control {baseline[signal]:.1%}")
    if worse:
        return "rollback", worse
    return "promote", ["every signal within tolerance of the control"]

for label in canaries:
    decision, reasons = judge(control, canaries[label])
    print(f"{label:<10} -> {decision}: {'; '.join(reasons)}")
```

Canaries have limits. A canary that shares a database or a queue with the control can harm both. Routing traffic back to the old version does not undo data the new version wrote, so schema and data changes need steps that both versions can live with. And the canary spends error budget in proportion to the traffic it receives, which is one more reason to keep it small.

## Feature flags and kill switches

A feature flag decides at runtime which code path runs, so deploying code and releasing behaviour become two separate steps. Pete Hodgson's article on feature toggles distinguishes four categories, and they differ most in how long they live and how often they change:

| Category | Purpose | Lifetime | How dynamic |
|---|---|---|---|
| Release toggle | Ship unfinished or untested code switched off | Transitional; generally no more than a week or two | Static per release |
| Experiment toggle | A/B or multivariate tests over groups of users | Hours to weeks | Per request |
| Ops toggle | Control operational behaviour, for example a kill switch for an expensive feature | Mostly short; kill switches can be long-lived | Must change quickly, without a deployment |
| Permissioning toggle | Which users get which features | Can last years | Per request |

A percentage rollout must be stable: the same user must get the same answer on every request, and widening the rollout must keep everyone who already has the feature. Hashing the flag name with the user id gives both properties. The example below also shows a kill switch, which wins over every other rule:

```python
import hashlib

FLAGS = {
    "new-search-ranking": {"enabled": True, "percent": 10},
    "email-automation": {"enabled": False, "percent": 100},
}

def bucket(flag, user_id):
    digest = hashlib.sha256(f"{flag}:{user_id}".encode()).hexdigest()
    return int(digest[:8], 16) % 100

def is_on(flag, user_id):
    config = FLAGS.get(flag)
    if config is None or not config["enabled"]:
        return False
    return bucket(flag, user_id) < config["percent"]

users = [f"user-{number}" for number in range(1000)]
ranking = [user for user in users if is_on("new-search-ranking", user)]
print(f"new-search-ranking: on for {len(ranking)} of {len(users)} users")
print("the same users on the next call:", all(is_on("new-search-ranking", user) for user in ranking))

FLAGS["new-search-ranking"]["percent"] = 25
widened = [user for user in users if is_on("new-search-ranking", user)]
print(f"widened to 25%: {len(widened)} users, all earlier users kept:", set(ranking) <= set(widened))

print("email-automation (kill switch off) for anyone:", any(is_on("email-automation", user) for user in users))
```

Flags change the work of QA:

- **Every active flag doubles the states.** Test the paths that will actually run in production: on, off, and the combinations that matter.
- **Test the switch itself.** Turn the flag on and off while traffic is flowing, and check what happens when the flag service cannot be reached: the default must be the safe state.
- **Record the flag state** in logs and traces, so an incident can be correlated with the flag that changed.
- **Remove release toggles** after the rollout. A flag nobody removes becomes a permanent, rarely tested branch.

Flag services and SDKs often follow OpenFeature, a CNCF incubating project: an open specification that provides a vendor-agnostic API for feature flagging, with providers that connect it to a particular flag tool or an in-house solution.

## Dark launches

A dark launch calls new or changed back-end behaviour from existing users' requests without the users being able to tell. Martin Fowler's example is computing recommendations during checkout without showing them: the goal is to measure load and performance on real traffic before the public launch, with a feature flag to switch the hidden work off quickly. A variant of the same idea copies real requests to a new version and discards its answers.

The term is also used loosely for canary releases, so agree on what your team means. Features where the user's own choice matters cannot be tested dark; they need a canary or an experiment with real users.

QA concerns for a dark launch:

- **No visible side effects.** The hidden path must not send emails, charge money, write data that users see or count as real activity.
- **No harm to the visible request.** The hidden work runs with a strict timeout or asynchronously, and the latency of the visible request is part of the check.
- **Compare results when you can.** If the new path computes something the old path also computes, a mismatch report is a free regression test on real data.

## Chaos engineering

Chaos engineering is experimenting on a system to build confidence that it can withstand turbulent conditions in production. It is a test with a hypothesis, which makes it natural territory for QA. The Principles of Chaos Engineering describe four steps:

1. Define the **steady state** as a measurable output of normal behaviour, such as throughput, error rate or latency percentiles.
2. **Hypothesise** that the steady state will continue in both a control group and an experimental group.
3. **Introduce variables** that reflect real-world events: servers that crash, disks that fail, network connections that are severed.
4. Try to **disprove the hypothesis** by looking for a difference in steady state between the two groups.

The advanced principles add: vary events by their likely impact or frequency, run experiments in production, automate them to run continuously, and minimise the blast radius. In practice teams start in a test environment and with planned exercises, often called game days, and move to production only when the abort conditions and the rollback are proven.

| Part of the experiment | Example |
|---|---|
| Hypothesis | If the recommendation service times out, search still answers within 300 ms, without recommendations |
| Steady state | Search success rate and 95th-percentile latency |
| Fault | Add a 5-second delay to the recommendation service |
| Scope | 1% of search traffic in one region, for 15 minutes |
| Abort condition | Search error-budget burn rate above 6, or any increase in 5xx responses |
| Result | Hypothesis held, or a bug: for example, search waited for the full timeout |

## Safety rules

The same rules apply to every technique in this chapter:

- **Never use real users' data or accounts** for checks. Use dedicated, clearly marked test accounts.
- **Tag test and synthetic traffic** so it can be excluded from business metrics, analytics and billing.
- **No irreversible side effects.** Use the sandbox modes of payment and messaging providers; never send real emails or messages.
- **Limit the blast radius**: a small percentage, one region, one canary or experiment at a time.
- **Define abort conditions before you start**, tied to SLOs. If the error budget is exhausted, the error budget policy stops releases, and it should stop experiments too.
- **Make rollback fast and tested**: a flag change or a routing change, not a new build.
- **Remember that data does not roll back.** Plan schema and data changes so the old version still works with them.
- **Tell people.** On-call engineers and support should know what is running and how to stop it.

## Case study: how this site tests in production

Every deployment of this site ends with a verification step that runs against the live site. It retries each check for up to half a minute while the new version rolls out, and the deployment is recorded as verified only if all of them pass:

| Check | What it proves |
|---|---|
| Home page and logo | The site serves, and the logo's pixels match an expected hash |
| Health endpoint | The application answers with a healthy status |
| WebSocket playground | A real WebSocket connection echoes a message |
| Logout | The session cookie is cleared |
| Anonymous vacancy dashboard | Jobs are returned, the payload stays small and no private fields leak |
| Public AI interview and learning advisor | Anonymous sessions are not stored, and the advisor answers |
| Old reference link | A moved page still redirects to its new address |

This is a synthetic check suite, but it runs once per deployment, not continuously. That gap is exactly how the [disk-full incident](/learn/observability?topic=observability-for-qa&section=case-study-the-disk-that-filled-up) went unnoticed: the database playground's MongoDB was down for about eight days, between deployments and outside every check. The open action items from that postmortem are a scheduled external check of the playgrounds and a disk-usage alert.

The site also has a kill switch. Email automation was paused with one setting: its routes answer 503 with a clear error code, the interface shows a pause note, and stored data is kept. The setting is a constant in the code, so turning it back on needs a deployment. That is acceptable for a pause planned for weeks, but too slow for an incident; a kill switch meant for emergencies must change without a deployment.

## Common mistakes

- **Calling it testing in production when it is skipping tests.** These techniques add checks where production differs; they do not replace tests before release.
- **Synthetic checks that only check the status code.** An error page with status 200 passes.
- **Treating a passing probe as proof of health.** Probes find outages; SLIs from real traffic find error rates.
- **Comparing the canary with yesterday instead of the control.** Traffic, time of day and dependencies change.
- **Judging a canary on too little traffic.** Wait until the numbers can tell the difference.
- **Flags that never go away.** Each one is a branch that someone has to test.
- **A kill switch that needs a deployment.** In an incident it is too slow.
- **Experiments without abort conditions or with real customer data.** The experiment becomes the incident.

## Summary

Production differs from every test environment in traffic, data, dependencies, configuration and time, so some problems can only be found there. Synthetic monitoring checks the main journeys from outside, continuously and with test accounts, but finds outages rather than error rates. Canary releases compare a new version with the control on the same user-visible signals and wait for enough traffic before deciding. Feature flags separate deployment from release; test both states and the switch itself, record flag states and remove release toggles. Dark launches measure hidden work on real traffic without visible side effects, and chaos experiments test hypotheses about failure with a minimal blast radius and abort conditions. Tag test traffic, avoid irreversible side effects, tie every experiment to SLOs and make rollback fast.
