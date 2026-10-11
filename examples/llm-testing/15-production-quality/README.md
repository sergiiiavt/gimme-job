# Production quality

Chapter: [Production quality](https://gimme-job.com/learn/llm?topic=production-quality)

Both loops of production quality in code. Before a release, a gate checks hard cases, quality, latency, cost and slices in one decision, with limits agreed before the run. After the release, the project covers four areas:
- traces that can explain a failure without leaking personal data;
- latency percentiles and capacity;
- a control chart and a drift index for the daily online checks;
- experiments with real users that survive daily looks at the dashboard.

| File | Content |
|---|---|
| `release_gate.py` | Hard checks, the paired non-inferiority bound, p95 latency and time to first token, cost per resolved conversation and slice floors in one decision. It also produces the exit status for CI, a Markdown summary, and SHA-256 fingerprints of the data and the limits. Command-line tool |
| `gate.json` | The limits, validated so that a misspelled field is an error |
| `tracing.py` | Nested spans with the OpenTelemetry names for generative AI and correct parents in concurrent asyncio tasks. Emails, card numbers and phone numbers are redacted before export. Also cost per trace with cached tokens, checks for incomplete traces, and telling retrieval failures from generation failures |
| `latency_capacity.py` | Percentiles, objectives on percentiles, the time to first token of a stream, Little's law |
| `load_simulation.py` | A fake provider with a rate limit, a concurrency limit and 429 responses with retry-after. Three client strategies: retry immediately, wait for retry-after, or exponential backoff with jitter. Command-line tool |
| `drift_monitoring.py` | A p-chart with 3-sigma limits and a run rule, detection probabilities, the population stability index, and stable sampling of conversations for judges. Command-line tool |
| `experiments.py` | Stable assignment, the sample ratio mismatch check, the two-proportion test, and four simulated stopping rules: once at the end, daily peeking, Bonferroni, and the mixture sequential probability ratio test (mSPRT). Command-line tool |
| `make_production_data.py` | Regenerates the synthetic data in `data/` with fixed seeds |
| `data/release_suite.jsonl` | 1,000 support cases with the results of three versions: 70% English, 30% Ukrainian, 25 zero-tolerance cases |
| `data/daily_checks.jsonl` | 24 days of online checks: 200 judged conversations a day, plus the language mix |
| `test_*.py` | Decisions on the example data, checks against hand calculations and simulation, property-based tests with Hypothesis |

## Decide whether a candidate ships

```bash
cd examples/llm-testing/15-production-quality
uv run --project .. python release_gate.py data/release_suite.jsonl gate.json --candidate cheaper
```

```text
cheaper against current on 1000 cases (data 7bcee7da781e, limits 16ff96ba58ec decided 2026-10-01 by the support product team, before the evaluation of any candidate)
      check                                           current      cheaper  limit
PASS  zero-tolerance cases failed                           0            0  at most 0
PASS  quality: lower bound of paired difference             -        -0.6%  at least -2.0%
PASS  latency: p95 end-to-end                          6.01 s       3.79 s  at most 8.00 s
PASS  latency: p95 time to first token                 1.61 s       0.93 s  at most 2.00 s
PASS  cost: per resolved conversation              EUR 0.0265   EUR 0.0072  at most EUR 0.0300
FAIL  slice: Ukrainian pass rate                        92.0%        84.0%  at least 88.0%
PASS  slice: refund pass rate                           91.9%        91.5%  at least 85.0%
decision: BLOCK, 1 check(s) failed
```

The smaller model is non-inferior overall, faster, and costs less than a third as much per resolved conversation. It still does not ship, because its Ukrainian answers fall below the floor. `cheaper_tuned` is the same model with Ukrainian examples in the prompt; it passes every check (Ukrainian 91.0%) and ships. The data and the limits appear as fingerprints, so a decision in a CI log can be traced back to exactly what produced it.

In GitHub Actions the exit status fails the job, and `--summary "$GITHUB_STEP_SUMMARY"` puts the table on the run page. A sketch of the wiring, with your own evaluation runner in place of `run_evaluation.py`:

```yaml
on:
  pull_request:
    paths: ["prompts/**", "retrieval/**", "assistant/**", "models.json"]
  schedule:
    - cron: "0 2 * * *"  # the full suite every night
jobs:
  release-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v6
        with:
          python-version: "3.13"
      - run: python -m pip install uv==0.12.1
      - run: uv run python run_evaluation.py --suite ${{ github.event_name == 'schedule' && 'full' || 'smoke' }} --out results.jsonl
      - run: uv run python release_gate.py results.jsonl gate.json --candidate candidate --summary "$GITHUB_STEP_SUMMARY"
```

## Watch it in production

```bash
uv run --project .. python drift_monitoring.py data/daily_checks.jsonl
```

```text
center line 90.1% from days 1 to 10
day pass rate lower limit  language PSI  alert
  1     90.0%       83.8%         0.000
...
 11     83.5%       83.8%         0.000  below the control limit
 12     77.5%       83.8%         0.000  below the control limit
 13     89.5%       83.8%         0.000
...
 21     88.0%       83.8%         0.121  input mix: moderate shift
 22     86.5%       83.8%         0.150  8 days in a row below the center line; input mix: moderate shift
 23     87.0%       83.8%         0.144  9 days in a row below the center line; input mix: moderate shift
 24     87.0%       83.8%         0.148  10 days in a row below the center line; input mix: moderate shift
```

Days 11 and 12 are an incident and cross the lower limit. From day 15 more Ukrainian and other traffic arrives: the PSI of about 0.13 is a moderate shift. The pass rate sinks by about two points, and no single day crosses the limit. On day 22, though, the run rule reports eight days in a row below the center line.

## Load and capacity

```bash
uv run --project .. python load_simulation.py
```

```text
mean service time 5.73 s; Little's law: 600/min needs about 57 calls in flight, 900/min about 86
scenario                         requests  answered   429s     p95 in service
steady 600/min, concurrency 200     17918    100.0%      0    9.7s       56.4
steady 900/min, concurrency 64      27048     75.0%  77992   35.9s       63.0
spike, immediate retries             7261     92.1%   4597    9.8s       60.2
spike, wait for retry-after          7261     92.7%   4575   10.5s       60.3
spike, backoff with jitter           7261     97.7%   3842   19.1s       63.1
```

A concurrency limit of 64 sustains about 670 calls per minute, so at 900 per minute a quarter of the requests fail whatever the client does: retries cannot create capacity. In a 30-second spike to 2,400 per minute, exponential backoff with jitter gets most of the extra requests through, at the price of double the p95 latency.

## Experiments with real users

```bash
uv run --project .. python experiments.py
```

```text
2000 experiments of 14 days, 100 users per arm and day, success rate 60%
rule               false alarms  detects +6 points  mean stop day
once at the end            4.7%              90.8%           14.0
daily peeking             21.9%              94.5%            5.1
daily, Bonferroni          1.8%              71.0%            7.8
daily, mSPRT               1.1%              66.3%            8.6
```

Daily peeking looks powerful because it declares many results that are not there. Both corrected rules keep false alarms below 5%. With 14 planned looks, Bonferroni is even a little more powerful than the mSPRT. The mSPRT allows any number of looks at any time, without planning them in advance.

## What the tests show

Release gate:
- The cheaper model is blocked only by the Ukrainian slice, and the tuned one ships. The version in production passes its own gate, so the limits are reachable.
- One failed zero-tolerance case blocks a candidate that passes everything else.
- Adding 9 seconds to one case in twelve fails the p95 latency check, even though the mean latency stays below the production version's. A gate on the mean would pass it.
- A model that costs a third as much per call, but resolves 30% of conversations instead of 90%, costs more per resolved conversation and is blocked.
- These are all errors rather than checks that silently pass: a misspelled limit, a missing limit, two limits, an unknown metric, and a slice without cases.
- The paired interval matches a hand calculation, and it mirrors exactly when the versions are swapped (property-based).

Tracing:
- Traces form one tree with the conventional span names.
- A handled tool timeout marks only its own span.
- Personal data is redacted in the export and kept inside the process.
- Cached tokens are billed at the cache price, which makes the example trace more than three times cheaper.
- Missing prompt versions, unfinished spans and missing parents are reported.
- Concurrent tool calls in asyncio get the agent as their parent. The same test with a shared stack of open spans makes the second tool a child of the first.
- Every generated email address and Luhn-valid card number is redacted, in any grouping. Numbers that fail the Luhn check, such as order numbers, stay readable, and redacting twice changes nothing. National phone formats, names and addresses are pinned as known gaps.

Latency and load:
- Percentiles lie between their neighbouring order statistics and never decrease.
- A stream that starts with empty chunks gets no credit for an early first token.
- Little's law predicts the concurrency of the simulation within 3%, using a mean service time worked out by hand.

Monitoring:
- 3-sigma limits alarm on fewer than 1% of stable days, 2-sigma limits on about 5%. The detection probability of a drop matches simulation.
- The run rule halves the median time to detect a two-point drop, from about 23 days to 12. Over 30 stable days it nearly triples the share of periods with a false alarm, from about 11% to 29%.
- The PSI matches a hand calculation and the value in the chapter (0.13). It is never negative, symmetric and independent of volume, and stays finite for a language never seen before.
- Judge sampling is stable, nested when the rate grows, and redrawn by a new salt.

Experiments:
- Assignment is stable, balanced and independent between experiments.
- A split of 5,000 to 5,300 is flagged as a sample ratio mismatch.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/15-production-quality
```
