# Production quality

An LLM feature that passed its evaluations can still fail in production. Users ask questions the dataset never contained, a provider updates a model, a new document confuses retrieval, latency grows with traffic, and costs drift. Production quality is the discipline of catching these changes early: release gates that block regressions before users see them, and monitoring that detects what the gates could not foresee.

This chapter covers both loops: evaluation in CI/CD and release gates, tracing and observability, online evaluation and drift detection, user feedback, performance and cost testing, model migrations, experiments with real users, and incident handling.

**Prerequisites:** [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals), [Statistics for evaluation](/learn/llm?topic=eval-statistics), [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation).

## Two loops

```diagram
Offline loop (before release)                 Online loop (after release)
dataset + scorers + judges                     traces of real traffic
        ↓                                              ↓
release gates in CI/CD           ──ship──▶     code checks on every request, judges on a sample
        ↑                                              ↓
new cases from production        ◀──learn──    drift alerts, feedback, incidents, error analysis
```

The offline loop protects users from known failures; the online loop discovers unknown ones and feeds them back as new cases. Neither works alone: a team without the online loop tests yesterday's product, and a team without the offline loop learns about regressions from its customers.

## Evaluation in CI/CD

Run suites of different cost at different moments:

| Stage | Trigger | Scope | Typical gate |
|---|---|---|---|
| Unit tests with fake models | Every push | All deterministic code | All tests pass |
| Smoke evaluation | Every pull request that touches prompts, models, retrieval or LLM code | 20 to 50 critical cases, code checks and a few validated judges | No critical case fails |
| Full evaluation | Nightly and before every release | The whole dataset with repeated runs, all slices | Non-inferiority per metric and slice against the baseline |
| Red-team suite | Weekly and before releases | The attack corpus and automated scanners | No new finding of high severity |

A release gate checks several kinds of requirements at once, and one failing check blocks the release even when the headline metric improves:

```python
# Results of the release suite for the current prompt and model and for the candidate (a cheaper model)
checks = [
    ("hard: zero-tolerance safety cases failed", 0, 0, "must be 0"),
    ("quality: lower bound of paired difference", None, -0.012, "at least -0.02"),
    ("latency: p95 end-to-end seconds", 6.8, 5.1, "at most 8.0"),
    ("cost: EUR per resolved conversation", 0.041, 0.019, "at most 0.05"),
    ("language: Ukrainian slice pass rate", 0.91, 0.84, "at least 0.88"),
]


def passes(value: float, limit: str) -> bool:
    kind, number = limit.rsplit(" ", 1)
    bound = float(number)
    return {"must be": value == bound, "at least": value >= bound, "at most": value <= bound}[kind]


blocking = []
for name, before, after, limit in checks:
    ok = passes(after, limit)
    shown_before = "-" if before is None else before
    print(f"{'PASS' if ok else 'FAIL'}  {name:<44} baseline {shown_before!s:>6}  candidate {after!s:>6}  ({limit})")
    if not ok:
        blocking.append(name)
print("decision:", "ship" if not blocking else f"block, {len(blocking)} check(s) failed")
```

Output:

```text
PASS  hard: zero-tolerance safety cases failed     baseline      0  candidate      0  (must be 0)
PASS  quality: lower bound of paired difference    baseline      -  candidate -0.012  (at least -0.02)
PASS  latency: p95 end-to-end seconds              baseline    6.8  candidate    5.1  (at most 8.0)
PASS  cost: EUR per resolved conversation          baseline  0.041  candidate  0.019  (at most 0.05)
FAIL  language: Ukrainian slice pass rate          baseline   0.91  candidate   0.84  (at least 0.88)
decision: block, 1 check(s) failed
```

The cheaper model is as good on average, faster and half the price, and it still does not ship, because its Ukrainian answers fall below the agreed floor. Practical rules for gates:

- **Decide limits before the run,** including the non-inferiority margin for quality ([Statistics for evaluation](/learn/llm?topic=eval-statistics)).
- **Gate slices that matter,** not only the average: languages, critical intents, customer segments.
- **Keep hard gates out of statistics:** one leaked secret or one broken contract blocks the release.
- **Make gates cheap enough to run on every relevant change:** cache model outputs by model, prompt and input, and run the expensive suites on a schedule.
- **Never retry a failing evaluation until it passes.** A gate that sometimes fails is reporting real variance; measure it instead ([Evaluating agents and tool use](/learn/llm?topic=agent-testing) shows pass^k).

## Tracing and observability

Every request to an LLM feature should leave a **trace**: a tree of spans for retrieval, each model call, each tool call and post-processing, with the data needed to explain the result.

| Recorded per span | Why |
|---|---|
| Inputs and outputs, with personal data redacted | To reproduce and read failures |
| Model ID, prompt version, parameters | To know exactly what produced the output |
| Tokens in and out, cost | To find expensive requests and features |
| Latency, time to first token, retries, errors | To find slow and failing dependencies |
| Retrieved document IDs and scores | To tell retrieval failures from generation failures |
| Scores from code checks and judges, user feedback | To connect quality to the trace that produced it |

The OpenTelemetry semantic conventions for generative AI standardize the names of such attributes, and tools such as Langfuse and Phoenix store, search and score traces. Treat traces as sensitive data: redact before export, restrict access, and limit retention.

## Performance testing

Users experience latency as two numbers: how long until the first token appears, and how long until the answer is complete. Both have long tails, because a slow tool, a retry or a long answer can multiply the time of an otherwise normal request:

```python
import math
import random
from statistics import fmean, quantiles

rng = random.Random(8)
# 2,000 calls: time to first token plus generation, and one call in twenty waits for a slow tool
ttft, total = [], []
for _ in range(2000):
    first = rng.lognormvariate(math.log(0.6), 0.35)
    generation = rng.uniform(150, 400) / rng.uniform(40, 80)  # tokens / tokens per second
    tool = rng.uniform(4, 9) if rng.random() < 0.05 else 0.0
    ttft.append(first + tool)
    total.append(first + tool + generation)


def percentiles(values: list[float]) -> dict[str, float]:
    cuts = quantiles(values, n=100, method="inclusive")
    return {"mean": fmean(values), "p50": cuts[49], "p95": cuts[94], "p99": cuts[98]}


for name, values in [("time to first token", ttft), ("end-to-end latency", total)]:
    print(f"{name:<20} " + "  ".join(f"{key} {value:5.2f}s" for key, value in percentiles(values).items()))

# Little's law: calls in flight = arrival rate x time in the system
peak_per_minute = 900
in_flight = peak_per_minute / 60 * fmean(total)
print(f"at {peak_per_minute} calls per minute about {in_flight:.0f} calls are in flight on average")
```

Output:

```text
time to first token  mean  0.99s  p50  0.61s  p95  4.94s  p99  8.87s
end-to-end latency   mean  5.67s  p50  5.25s  p95  9.77s  p99 13.42s
at 900 calls per minute about 85 calls are in flight on average
```

The average time to first token is under a second, but one user in twenty waits about five seconds, all because of the slow tool. Report percentiles, not averages, and set requirements on them (for example "p95 time to first token under 2 seconds"). Little's law (requests in flight = arrival rate × time in the system) turns latency into capacity: at 900 requests per minute and about 5.7 seconds per request, the system holds about 85 requests at once, and provider rate limits and connection pools must allow that much concurrency.

Load tests for LLM features add provider-specific behaviour to classic load testing: rate limits (HTTP 429) with retry-after headers, time-outs on long generations, streaming connections that stay open, and the cost of the test itself. Run them against a fake model server for the application's own behaviour, and against the real provider only at the scale you need to confirm limits. Check that clients wait at least as long as retry-after says and back off exponentially with random jitter: that turns most errors of a short spike into waiting. No retry policy creates capacity, though: when demand stays above what the limits sustain, the same share of requests fails whatever the client does.

## Cost testing

Cost is a quality attribute with its own regressions: a prompt that grows by a paragraph, a model change, a retrieval change that adds context, an agent that takes more steps.

- **Measure cost per resolved task,** not per call: a cheap model that needs three attempts can cost more than an expensive one that succeeds once ([LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy)).
- **Put cost into the release gate,** with a limit per resolved conversation.
- **Use prompt caching** for long, stable prompt prefixes, and test that the cache is actually hit: a single variable value early in the prompt silently disables it.
- **Budget per user and per task** to bound the damage of loops and abuse ([Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming)).

## Online evaluation and drift

In production there are no labels, but there are three kinds of signals:

- **Code checks on every request:** schema validity, citations, links, language, length, refusals, tool errors.
- **Validated judges on a random sample:** a few hundred conversations a day are usually enough to track a pass rate.
- **Distribution monitoring:** the mix of languages, intents, input lengths and retrieved documents.

The question is when a change is a real problem rather than noise. Control charts from statistical process control answer it: a daily pass rate outside three standard errors of its normal level is unlikely to be chance:

```python
import math

# Daily online evaluation: a validated judge scores a random sample of 200 conversations per day
judged = 200
passed = [176, 181, 178, 174, 180, 177, 179, 175, 182, 178, 164, 161, 176, 179]
baseline = sum(passed[:10]) / (10 * judged)  # the first ten days define normal behaviour
sigma = math.sqrt(baseline * (1 - baseline) / judged)
low = baseline - 3 * sigma
print(f"baseline pass rate {baseline:.1%}, lower control limit {low:.1%}")
for day, count in enumerate(passed, 1):
    rate = count / judged
    print(f"day {day:>2}: {rate:6.1%}{'   ALERT' if rate < low else ''}")


def psi(expected: dict[str, float], actual: dict[str, float]) -> float:
    """Population stability index between two distributions over the same categories."""
    return sum((actual[k] - expected[k]) * math.log(actual[k] / expected[k]) for k in expected)


languages_before = {"en": 0.72, "uk": 0.25, "other": 0.03}
languages_now = {"en": 0.55, "uk": 0.38, "other": 0.07}
print(f"population stability index of the language mix: {psi(languages_before, languages_now):.2f}")
```

Output:

```text
baseline pass rate 89.0%, lower control limit 82.4%
day  1:  88.0%
day  2:  90.5%
day  3:  89.0%
day  4:  87.0%
day  5:  90.0%
day  6:  88.5%
day  7:  89.5%
day  8:  87.5%
day  9:  91.0%
day 10:  89.0%
day 11:  82.0%   ALERT
day 12:  80.5%   ALERT
day 13:  88.0%
day 14:  89.5%
population stability index of the language mix: 0.13
```

Days 11 and 12 fall below the control limit and deserve an investigation; days 13 and 14 suggest that the cause, for example a misbehaving retrieval index, was fixed. A small, lasting shift rarely crosses a three-sigma limit on any single day; a run rule catches it instead, for example eight days in a row on the same side of the center line (one of the Western Electric rules). Run rules raise more false alarms, so apply them to a few main metrics rather than to every slice.

The population stability index compares the mix of inputs with an earlier period; a common rule of thumb treats values below 0.1 as stable and above 0.25 as a major shift, so 0.13 is a moderate change: more Ukrainian traffic, which makes the Ukrainian slice of the evaluation dataset more important than before.

## User feedback

- **Explicit feedback** (thumbs up or down, ratings) is rare and biased toward strong reactions; use it to find cases, not to measure rates.
- **Implicit signals** are more frequent: the user rephrases the question, asks for a human, abandons the conversation, or copies the answer.
- **Every piece of negative feedback is a trace to read.** Feed the failures into error analysis and the dataset, so that the offline loop learns what production taught ([Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)).

## Model migrations

Providers deprecate models on published schedules, and newer models change behaviour even when they score better on benchmarks. Treat a migration like any other release:

1. **Run the full evaluation** with the new model on the same cases and compare as pairs; read the flipped cases.
2. **Re-tune prompts if needed,** and re-validate judges if the judge model changes too.
3. **Shadow traffic:** run the new model on copies of real requests without showing its answers, and compare.
4. **Canary release:** route a small share of users to the new model behind a flag, watch the online signals, and widen gradually.
5. **Keep the old path available** until the new one has proven itself, and plan migrations before the deprecation date, not on it.

## Experiments with real users

When offline evaluation cannot answer the question (does the new answer style resolve more conversations?), run a controlled experiment: randomize users between the current and the new version, and compare outcome metrics such as resolution rate, together with guardrail metrics such as escalations and complaints. Before reading any result, check that the split matches the design: a sample ratio mismatch, such as 5,000 users in one arm and 5,300 in the other, means that the assignment or the logging is broken and the results cannot be trusted.

The most common mistake is to watch the results every day and stop as soon as the difference looks significant. Each look is another chance for noise to cross the threshold:

```python
import math
import random
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)
rng = random.Random(21)


def z_statistic(success_a: int, n_a: int, success_b: int, n_b: int) -> float:
    pooled = (success_a + success_b) / (n_a + n_b)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    difference = success_b / n_b - success_a / n_a
    return difference / se if se else 0.0


# A/A test: both arms are the same system with a 30% task success rate, so every "win" is a false alarm.
experiments, days, users_per_day = 500, 14, 100
stopped_early = fixed_horizon = 0
for _ in range(experiments):
    a = b = n = 0
    declared = False
    for _ in range(days):
        a += sum(rng.random() < 0.30 for _ in range(users_per_day))
        b += sum(rng.random() < 0.30 for _ in range(users_per_day))
        n += users_per_day
        if not declared and abs(z_statistic(a, n, b, n)) > Z:
            declared = True  # someone looked at the dashboard today and stopped the test
    stopped_early += declared
    fixed_horizon += abs(z_statistic(a, n, b, n)) > Z

print(f"false alarms when checking every day and stopping at the first significant result: {stopped_early / experiments:.1%}")
print(f"false alarms when analysing once, at the planned end: {fixed_horizon / experiments:.1%}")
```

Output:

```text
false alarms when checking every day and stopping at the first significant result: 21.0%
false alarms when analysing once, at the planned end: 3.8%
```

Both arms are identical, so every declared winner is wrong. Analysed once at the planned end, about 4% of these experiments produce a false alarm, close to the designed 5%; with daily peeking, about one in five does. Decide the sample size in advance ([Statistics for evaluation](/learn/llm?topic=eval-statistics)) and analyse once, or use methods made for continuous monitoring, such as always-valid sequential tests.

## Incidents and rollback

- **Feature flags** for prompts, models and retrieval settings, so that a bad change can be reverted in minutes without a deployment.
- **Fallbacks:** a simpler model, a static answer or a hand-over to a person when the model, the provider or a guardrail fails.
- **Runbooks** for the predictable incidents: provider outage, rate limiting, cost spike, injection attack, harmful output.
- **Blameless postmortems** that end with new regression cases, so that the same failure is caught by the offline loop next time.

## Case study: the Learning Path Advisor of this site

The Learning Path Advisor of GimmeJob applies several practices of this chapter:

- **Traces with quality scores.** Every request is traced in Langfuse with scores such as the top retrieval score, the share of grounded items, the validity of cited sources and whether the produced learning map is connected.
- **Deterministic checks before display.** Cited links are validated by shape against canonical learning routes, so a model cannot send a user to an invented page.
- **Graceful degradation.** When vector search is unavailable, a lexical ranker in the same pipeline keeps retrieval working ([Evaluating RAG systems](/learn/llm?topic=rag-testing)).
- **Tested without a model.** The application code around the model has unit tests with fakes, and the AI service has its own test suite in CI ([Testing LLM code without the model](/learn/llm?topic=testing-without-the-model)).

## Example project

The methods of this chapter are implemented and tested in [examples/llm-testing/15-production-quality](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/15-production-quality): a release gate with hard, quality, latency, cost and slice checks; a tracer with nested spans, redaction and cost per trace; latency percentiles, Little's law and a load simulation against a fake provider with rate limits; a control chart, a run rule and a drift index for online monitoring; and experiment simulations that show the cost of peeking and two ways to look safely. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/15-production-quality
```

## Common mistakes

- **Evaluation only before the first release,** with no online loop.
- **Gates on the average only,** without slices, latency and cost.
- **Retrying failing evaluations until they pass.**
- **Averages instead of percentiles** for latency.
- **Retries without backoff,** or retries expected to make up for missing capacity.
- **Traces without model and prompt versions,** or traces with personal data in plain text.
- **Explicit feedback used as a quality metric.**
- **Model migrations done on the deprecation date,** without paired evaluation or a canary.
- **Stopping experiments at the first significant result.**
- **Incidents fixed without new regression cases.**

## Summary

- Production quality is two loops: offline evaluation with release gates, and online monitoring that feeds new cases back.
- Run suites of different cost at different moments, and gate on hard checks, quality with a margin, slices, latency and cost together.
- Trace every request with versions, tokens, cost, latency, retrieval and scores, and redact personal data.
- Measure latency in percentiles, plan capacity with Little's law, and test cost per resolved task and cache hits.
- Monitor online with code checks on all traffic, validated judges on a sample, control charts and drift indices.
- Treat model migrations as releases with paired evaluation, shadow traffic and canaries.
- Plan experiments in advance and do not stop at the first significant look; keep fallbacks, flags and runbooks for incidents.
