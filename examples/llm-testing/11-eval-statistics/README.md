# Statistics for evaluation

Chapter: [Statistics for evaluation](https://gimme-job.com/learn/llm?topic=eval-statistics)

An evaluation score is an estimate. This project implements the statistics that turn evaluation numbers into decisions, and it tests each method against an independent check: complete enumeration, exact probabilities or simulation.

| File | Content |
|---|---|
| `intervals.py` | Wald, Wilson and Clopper-Pearson intervals, the rule of three, and exact coverage computed over every possible count. Command-line tool |
| `paired_tests.py` | Paired counts, the exact McNemar test, the paired interval for a difference in pass rate, the unpaired interval for comparison, and the paired bootstrap for any metric |
| `repeated_runs.py` | pass@k and pass^k, naive and clustered standard errors. Command-line tool |
| `sample_size.py` | Cases for a given precision, cases to detect a difference (unpaired and paired), the smallest detectable difference. Command-line tool |
| `multiple_testing.py` | Bonferroni and Holm corrections |
| `compare_versions.py` | The release gate: hard gates, a paired comparison with a non-inferiority margin, slices with the Holm correction, and the decision ship, block or inconclusive as the exit status. Command-line tool |
| `make_example_runs.py` | Regenerates the synthetic results in `data/` with fixed seeds |
| `data/results.jsonl` | 600 cases (English and Ukrainian, four features, 20 zero-tolerance cases) with the results of versions A, B, C and D |
| `data/repeated_runs.jsonl` | 30 agent tasks run 8 times each |
| `test_*.py` | Values from the chapter, exact and simulated checks of every method, property-based tests with Hypothesis |

The results are synthetic: every case has a difficulty that all versions share, and each run adds its own randomness, as in real evaluations. Version B is genuinely better than A, C is of the same quality, and D is B with one broken zero-tolerance case.

## Decide whether a candidate ships

```bash
cd examples/llm-testing/11-eval-statistics
uv run --project .. python compare_versions.py data/results.jsonl --candidate B
```

```text
A: 509/600 passed, 84.8% (95% CI 81.7% to 87.5%)
B: 533/600 passed, 88.8% (95% CI 86.1% to 91.1%)
cases only A passes: 13, only B passes: 37
B - A: +4.0%, paired 95% CI +1.7% to +6.3%, McNemar p = 0.001
slice              cases   change       p  after Holm
feature=account      150    +4.7%   0.118  -
feature=delivery     150    +5.3%   0.057  -
feature=refunds      150    +5.3%   0.021  -
feature=returns      150    +0.7%   1.000  -
lang=en              400    +4.2%   0.008  significant
lang=uk              200    +3.5%   0.092  -
decision: SHIP, not worse than the baseline by more than 2%: lower bound +1.7%
```

The intervals of A and B overlap, yet the paired comparison shows that B is better: the 50 cases on which the versions disagree split 37 to 13. The refunds slice has p = 0.021, but it is one of six comparisons and does not survive the Holm correction.

The other candidates end differently:

```text
--candidate C   C - A: -1.2%, paired 95% CI -3.5% to +1.1%
                decision: INCONCLUSIVE, the interval [-3.5%, +1.1%] still allows a loss of more than 2%; add cases or keep the baseline
--candidate D   D - A: +3.8%, paired 95% CI +1.5% to +6.1%
                decision: BLOCK, zero-tolerance cases failed: case-0451
```

The exit status is 0 for ship, 1 for block and 2 for inconclusive, so the command can gate a CI pipeline. The margin (`--margin`, 2 points by default) is a product decision taken before the run.

## Intervals, repeated runs and planning

```bash
uv run --project .. python intervals.py 42 50
uv run --project .. python repeated_runs.py data/repeated_runs.jsonl
uv run --project .. python sample_size.py 50 200 1000 5000
```

```text
cases   margin at 50%   margin at 90%   smallest detectable paired difference (10% discordant)
   50          13.9%           8.3%         none
  200           6.9%           4.2%         6.2%
 1000           3.1%           1.9%         2.8%
 5000           1.4%           0.8%         1.3%
```

A 50-case golden set cannot detect any difference at all when the versions disagree on 10% of cases; 1,000 paired cases detect about three points.

## What the tests show

- The exact McNemar test equals complete enumeration of all coin-flip assignments, and its false-alarm rate never exceeds 5% for any number of discordant cases.
- pass@k and pass^k equal the share of all k-run subsets with at least one pass, or with only passes.
- Exact coverage, summed over every possible count: the worst-case coverage of the "95%" Wald interval is 18% with 10 cases and 45% with 30, Wilson stays above 92%, and Clopper-Pearson never drops below 95%.
- The paired bootstrap of pass/fail results agrees with the paired formula to within half a point.
- Clustered standard errors of the agent runs are more than 1.3 times the naive ones; when all cases are equally hard, both agree.
- A simulated experiment of the size `cases_to_detect` plans really detects the difference about 80% of the time.
- Under no change, Holm keeps the chance of any false alarm across 20 slices near 5%, against more than 60% without a correction.
- Property-based tests found two things worth knowing. Floating-point rounding gave 0 passes a Wilson lower bound of 1.7e-18 instead of 0, so the edges are now exact. And the exact interval is conservative in coverage but not always wider than Wilson: with 0 of 46 cases it is slightly narrower.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/11-eval-statistics
```
