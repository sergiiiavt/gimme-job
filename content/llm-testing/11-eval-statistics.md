# Statistics for evaluation

An evaluation result is a measurement taken on a sample. "Version B passes 84% of the golden set, version A passed 81%" sounds like progress, but another 200 cases, another run of the same cases or another grader would give different numbers. Without an estimate of that variation, nobody can say whether B is better, equal or worse.

This chapter turns evaluation numbers into statements with known uncertainty: confidence intervals for pass rates, correct comparisons of two versions on the same cases, intervals for any metric with the bootstrap, repeated runs of non-deterministic systems, sample sizes and power, many comparisons at once, and release gates that do not fail at random.

**Prerequisites:** [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals), [Code-based scorers and metrics](/learn/llm?topic=code-based-scorers). The sources of randomness in generation are explained in [How LLMs generate text](/learn/llm?topic=llm-foundations).

## Where the uncertainty comes from

Four things make an evaluation score move. Statistics deals with the first three; the fourth is a question of validity that no formula repairs.

| Source | What varies | Reduced by | Not fixed by |
|---|---|---|---|
| Case sampling | Which inputs happen to be in the dataset | More cases, stratified sampling of important slices | More runs of the same cases |
| Generation randomness | The output for the same input | Several runs per case, lower temperature where the feature allows it | More cases with one run each |
| Grader noise | The verdict for the same output | Validated scorers, several judges or raters, averaging | More cases alone |
| Dataset validity | Whether the dataset represents real use | Sampling from production, refreshing the dataset | Any amount of statistics |

Even at temperature 0, outputs of hosted models can differ between runs because of batching and floating-point effects ([How LLMs generate text](/learn/llm?topic=llm-foundations)), so generation randomness is present in almost every LLM evaluation.

## A pass rate is an estimate

If a system passes `k` of `n` independent cases, the observed pass rate estimates the rate you would see on the whole population of inputs the cases were drawn from. The binomial model gives its uncertainty:

```text
observed pass rate        p = k / n
standard error            SE = sqrt(p · (1 − p) / n)
Wald 95% interval         p ± 1.96 · SE
Wilson 95% interval       (p + z²/2n ± z · sqrt(p · (1 − p)/n + z²/4n²)) / (1 + z²/n),   z = 1.96
zero failures in n cases  95% upper bound on the failure rate ≈ 3 / n   (the rule of three)
```

The Wald interval is the one most people remember. The script compares it with the Wilson score interval on typical evaluation results:

```python
import math
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)  # 1.96 for a two-sided 95% interval


def wald(k: int, n: int) -> tuple[float, float]:
    """The textbook normal approximation: p plus or minus z times sqrt(p(1 - p) / n)."""
    p = k / n
    half = Z * math.sqrt(p * (1 - p) / n)
    return p - half, p + half


def wilson(k: int, n: int) -> tuple[float, float]:
    """Wilson score interval: stays inside [0, 1] and keeps its coverage for small n and extreme rates."""
    p = k / n
    denominator = 1 + Z**2 / n
    center = (p + Z**2 / (2 * n)) / denominator
    half = Z / denominator * math.sqrt(p * (1 - p) / n + Z**2 / (4 * n**2))
    return center - half, center + half


print("passed/cases   rate    Wald 95% interval    Wilson 95% interval")
for k, n in [(42, 50), (9, 10), (50, 50), (1, 30), (980, 1000)]:
    wald_low, wald_high = wald(k, n)
    low, high = wilson(k, n)
    print(f"{k:>6}/{n:<6} {k / n:6.1%}   [{wald_low:6.1%}, {wald_high:6.1%}]    [{low:6.1%}, {high:6.1%}]")
```

Output:

```text
passed/cases   rate    Wald 95% interval    Wilson 95% interval
    42/50      84.0%   [ 73.8%,  94.2%]    [ 71.5%,  91.7%]
     9/10      90.0%   [ 71.4%, 108.6%]    [ 59.6%,  98.2%]
    50/50     100.0%   [100.0%, 100.0%]    [ 92.9%, 100.0%]
     1/30       3.3%   [ -3.1%,   9.8%]    [  0.6%,  16.7%]
   980/1000    98.0%   [ 97.1%,  98.9%]    [ 96.9%,  98.7%]
```

The Wald interval claims that 50 passes out of 50 prove a pass rate of exactly 100%, allows 108.6% for 9 of 10 and a negative rate for 1 of 30. The Wilson interval stays between 0 and 1 and says what the data supports: 50 of 50 passes are consistent with a true pass rate as low as 92.9%. Report a pass rate with its interval and sample size, for example "84% (95% CI 72–92%, n = 50)".

The rule of three answers a common question about safety tests: if 300 adversarial cases produce no failure, the failure rate is below about 1% (3/300) with 95% confidence, not zero.

### Checking an interval method by simulation

A 95% interval method is correct when it contains the true rate in 95% of repeated experiments. This property, coverage, can be checked directly by simulating evaluations of a system whose true pass rate is known:

```python
import math
import random
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)


def wald(k, n):
    p = k / n
    half = Z * math.sqrt(p * (1 - p) / n)
    return p - half, p + half


def wilson(k, n):
    p = k / n
    denominator = 1 + Z**2 / n
    center = (p + Z**2 / (2 * n)) / denominator
    half = Z / denominator * math.sqrt(p * (1 - p) / n + Z**2 / (4 * n**2))
    return center - half, center + half


rng = random.Random(7)
experiments = 2000
print("true rate  cases  Wald covers  Wilson covers")
for true_rate, n in [(0.95, 30), (0.80, 30), (0.95, 300)]:
    wald_hits = wilson_hits = 0
    for _ in range(experiments):
        k = sum(rng.random() < true_rate for _ in range(n))
        low, high = wald(k, n)
        wald_hits += low <= true_rate <= high
        low, high = wilson(k, n)
        wilson_hits += low <= true_rate <= high
    print(f"{true_rate:9.0%}  {n:5}  {wald_hits / experiments:11.1%}  {wilson_hits / experiments:13.1%}")
```

Output:

```text
true rate  cases  Wald covers  Wilson covers
      95%     30        78.0%          94.7%
      80%     30        95.2%          96.5%
      95%    300        92.2%          94.8%
```

For a feature that really passes 95% of cases, a "95%" Wald interval from 30 cases misses the truth more than one time in five. Brown, Cai and DasGupta showed that this erratic coverage is not limited to small samples. Good LLM features have pass rates close to 100%, which is exactly where the Wald interval fails, so use the Wilson interval, or the exact Clopper–Pearson interval when an interval must never cover less than promised. Libraries such as statsmodels implement all of them.

## Comparing two versions on the same cases

Most comparisons in LLM work are **paired**: the current version A and the candidate B answer the same cases. Every case then falls into one of four cells, and only two of them carry information about the difference:

| Outcome | B passes | B fails |
|---|---|---|
| A passes | both pass: no information about the difference | only A passes: evidence for A |
| A fails | only B passes: evidence for B | both fail: no information about the difference |

If A and B were equally good, a case that only one of them passes would be equally likely to favour either, like a fair coin. McNemar's test asks whether the split of these discordant cases is too uneven for a fair coin:

```text
discordant cases     b = cases only A passes,  c = cases only B passes,  n = all cases
difference           d = (c − b) / n
paired standard error sqrt(b + c − (c − b)² / n) / n
exact McNemar test   two-sided p = 2 · P(X ≤ min(b, c)),   X ~ Binomial(b + c, 1/2)
```

The script compares the same three-point improvement on 200 and on 1,000 cases, analysed correctly as paired and incorrectly as two unrelated samples:

```python
import math
from statistics import NormalDist

Z = NormalDist().inv_cdf(0.975)


def mcnemar_exact(only_a: int, only_b: int) -> float:
    """Two-sided exact McNemar test: if A and B are equally good, each discordant case is a fair coin flip."""
    n = only_a + only_b
    tail = sum(math.comb(n, i) for i in range(min(only_a, only_b) + 1)) / 2**n
    return min(1.0, 2 * tail)


def paired_interval(both: int, only_a: int, only_b: int, neither: int) -> tuple[float, float]:
    """95% interval for the difference in pass rate (B minus A) when both ran on the same cases."""
    n = both + only_a + only_b + neither
    diff = (only_b - only_a) / n
    se = math.sqrt(only_a + only_b - (only_b - only_a) ** 2 / n) / n
    return diff - Z * se, diff + Z * se


def unpaired_interval(passed_a: int, passed_b: int, n: int) -> tuple[float, float]:
    """The same comparison analysed as if A and B had run on two unrelated samples of cases."""
    p_a, p_b = passed_a / n, passed_b / n
    se = math.sqrt(p_a * (1 - p_a) / n + p_b * (1 - p_b) / n)
    return p_b - p_a - Z * se, p_b - p_a + Z * se


# both pass, only A passes, only B passes, both fail
for both, only_a, only_b, neither in [(150, 12, 18, 20), (760, 30, 60, 150)]:
    n = both + only_a + only_b + neither
    low, high = paired_interval(both, only_a, only_b, neither)
    u_low, u_high = unpaired_interval(both + only_a, both + only_b, n)
    print(f"{n} cases: A {(both + only_a) / n:.1%}, B {(both + only_b) / n:.1%}, only A passes {only_a}, only B passes {only_b}")
    print(f"  paired:   B - A in [{low:+.1%}, {high:+.1%}], McNemar p = {mcnemar_exact(only_a, only_b):.3f}")
    print(f"  unpaired: B - A in [{u_low:+.1%}, {u_high:+.1%}]")
```

Output:

```text
200 cases: A 81.0%, B 84.0%, only A passes 12, only B passes 18
  paired:   B - A in [-2.4%, +8.4%], McNemar p = 0.362
  unpaired: B - A in [-4.4%, +10.4%]
1000 cases: A 79.0%, B 82.0%, only A passes 30, only B passes 60
  paired:   B - A in [+1.1%, +4.9%], McNemar p = 0.002
  unpaired: B - A in [-0.5%, +6.5%]
```

How to read it:

- **On 200 cases, three points are noise.** Eighteen against twelve discordant cases is an ordinary coin-flip result (p = 0.36), and the interval runs from B being 2.4 points worse to 8.4 points better.
- **On 1,000 cases, the paired analysis finds real evidence**: B is better by 1.1 to 4.9 points.
- **The unpaired analysis of the same data finds nothing**, because it treats the difficulty of each case as noise. Both versions share that difficulty, and pairing cancels it. Running both versions on the same cases and analysing them as pairs is the single cheapest way to make comparisons more sensitive.

Dietterich recommended McNemar's test for comparing two classifiers on one test set for the same reason. For comparisons of more than two systems, or for metrics that are not pass rates, use the bootstrap.

## Bootstrap intervals for any metric

Many metrics have no simple formula for their uncertainty: a mean judge score from 1 to 5, an F1 computed over the whole dataset, cost per resolved task. The **bootstrap** estimates the uncertainty by simulation: it draws new datasets of the same size from the cases you have, with replacement, and recomputes the metric on each. The spread of the recomputed values approximates the spread you would see across real samples of cases.

For comparisons, the **paired bootstrap** resamples cases and keeps the A and B results of each case together, which preserves the benefit of pairing. Koehn introduced it for comparing machine-translation systems.

```python
import random
from statistics import fmean

# Judge scores from 1 to 5 for the same 40 cases, answered by version A and by version B
a = [4, 5, 3, 4, 4, 2, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 2, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 2, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4]
b = [4, 5, 4, 4, 5, 2, 5, 4, 4, 4, 5, 4, 3, 4, 5, 5, 3, 4, 4, 5, 4, 4, 4, 5, 4, 3, 5, 4, 5, 3, 4, 4, 4, 5, 4, 5, 4, 3, 5, 4]

rng = random.Random(11)
differences = []
for _ in range(5000):
    picked = [rng.randrange(len(a)) for _ in range(len(a))]  # resample cases; each pair stays together
    differences.append(fmean(b[i] for i in picked) - fmean(a[i] for i in picked))
differences.sort()
low, high = differences[int(0.025 * len(differences))], differences[int(0.975 * len(differences)) - 1]

print(f"mean score A {fmean(a):.2f}, B {fmean(b):.2f}, difference {fmean(b) - fmean(a):+.3f}")
print(f"95% paired bootstrap interval for B - A: [{low:+.3f}, {high:+.3f}]")
print(f"share of resamples where B is not better: {sum(d <= 0 for d in differences) / len(differences):.2%}")
```

Output:

```text
mean score A 3.90, B 4.15, difference +0.250
95% paired bootstrap interval for B - A: [+0.100, +0.400]
share of resamples where B is not better: 0.04%
```

Practical rules for the bootstrap:

- **Resample the unit that was sampled.** If the dataset holds 50 conversations with 10 turns each, resample conversations, not turns; turns of one conversation are not independent.
- **Use enough resamples and a fixed seed:** a few thousand for an interval, and record the seed so that the report can be reproduced.
- **It cannot rescue a small or unrepresentative dataset.** With very few cases the bootstrap interval is too narrow, and no resampling adds cases that the dataset does not contain.

## Repeated runs: pass@k, pass^k and clustered errors

When the same case can pass on one run and fail on the next, a single run per case mixes two questions: how often is the system right, and how consistently. Running every case several times separates them. With `c` passes in `n` runs of a case, two different summaries answer two different product questions:

```text
pass@k   chance that at least one of k attempts passes   = 1 − C(n − c, k) / C(n, k)
pass^k   chance that all k attempts pass                   = C(c, k) / C(n, k)
         C(n, k) is the number of ways to choose k runs out of n; both are averaged over cases
```

The pass@k estimator is the unbiased form introduced with the HumanEval benchmark; pass^k was introduced by τ-bench to measure the reliability of agents.

```python
from math import comb


def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased estimate of the chance that at least one of k attempts passes, from c passes in n runs."""
    if n - c < k:
        return 1.0
    return 1 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    """Estimate of the chance that all k attempts pass: the reliability a returning user experiences."""
    return comb(c, k) / comb(n, k)


runs = 10
passes = [10, 10, 9, 9, 8, 7, 7, 5, 3, 2]  # passes out of 10 runs, for 10 cases
for k in [1, 3, 5]:
    at_k = sum(pass_at_k(runs, c, k) for c in passes) / len(passes)
    hat_k = sum(pass_hat_k(runs, c, k) for c in passes) / len(passes)
    print(f"k={k}: pass@k = {at_k:.2f}   pass^k = {hat_k:.2f}")
```

Output:

```text
k=1: pass@k = 0.70   pass^k = 0.70
k=3: pass@k = 0.91   pass^k = 0.45
k=5: pass@k = 0.97   pass^k = 0.34
```

From the same runs, the system "solves 97% of tasks within five attempts" and "handles a task correctly five times in a row only 34% of the time". Choose the summary that matches how the output is used:

- **pass@k** fits when a verifier or a person picks among several attempts, as with generated code checked by tests.
- **pass^k** fits when every interaction must succeed: an agent that a customer uses every day, a support answer that each customer sees once.

### Clustered standard errors

Five runs of 100 cases are not 500 independent observations. Runs of the same case share its difficulty, so they agree with each other more than runs of different cases do. A standard error computed as if the 500 runs were independent is too small; the correct one treats the case as the sampled unit:

```python
import math
import random
from statistics import fmean, stdev

rng = random.Random(3)
# 100 cases of different difficulty: the chance that one run of each case passes
difficulty = [0.98] * 50 + [0.85] * 30 + [0.40] * 15 + [0.05] * 5
runs = 5
results = [[rng.random() < p for _ in range(runs)] for p in difficulty]

every_run = [passed for case in results for passed in case]
rate = fmean(every_run)
naive_se = math.sqrt(rate * (1 - rate) / len(every_run))  # pretends the 500 runs are independent
case_rates = [fmean(case) for case in results]
clustered_se = stdev(case_rates) / math.sqrt(len(case_rates))  # the case is the unit that was sampled

print(f"pass rate {rate:.1%} from {len(results)} cases with {runs} runs each")
print(f"naive standard error     {naive_se:.2%}, 95% interval about {rate:.1%} plus or minus {1.96 * naive_se:.1%}")
print(f"clustered standard error {clustered_se:.2%}, 95% interval about {rate:.1%} plus or minus {1.96 * clustered_se:.1%}")
```

Output:

```text
pass rate 82.2% from 100 cases with 5 runs each
naive standard error     1.71%, 95% interval about 82.2% plus or minus 3.4%
clustered standard error 2.87%, 95% interval about 82.2% plus or minus 5.6%
```

The naive interval is almost 40% too narrow. More runs per case reduce the generation noise within cases, but only more cases reduce the uncertainty about which cases the system can handle. Miller's paper on error bars for language-model evaluations describes clustered standard errors, paired differences and other variance-reduction methods in detail.

## Sample size and power

Two planning questions decide how big an evaluation dataset must be: how precisely it measures one version, and how small a difference between two versions it can detect.

```text
precision   n = z² · p(1 − p) / E²                                   cases for a 95% interval of about ±E
unpaired    n = (z_α + z_β)² · (p_A(1 − p_A) + p_B(1 − p_B)) / δ²    cases per version
paired      n = (z_α · sqrt(π_d) + z_β · sqrt(π_d − δ²))² / δ²        cases run by both versions (Connor, 1987)
            δ = p_B − p_A,  π_d = share of discordant cases,  z_α = 1.96 (5% level),  z_β = 0.84 (80% power)
```

**Power** is the chance that a comparison detects a difference that really exists; 80% is a common target.

```python
import math
from statistics import NormalDist

z = NormalDist().inv_cdf


def cases_for_margin(margin: float, expected_rate: float = 0.5) -> int:
    """Cases needed for a 95% interval of about plus or minus margin around a pass rate."""
    return math.ceil(z(0.975) ** 2 * expected_rate * (1 - expected_rate) / margin**2)


def cases_to_detect(p_a: float, p_b: float, discordant: float, power: float = 0.8) -> tuple[int, int]:
    """Cases needed to detect p_b - p_a at the 5% level: unpaired per version, and paired (Connor, 1987)."""
    delta = p_b - p_a
    z_alpha, z_beta = z(0.975), z(power)
    unpaired = (z_alpha + z_beta) ** 2 * (p_a * (1 - p_a) + p_b * (1 - p_b)) / delta**2
    paired = (z_alpha * math.sqrt(discordant) + z_beta * math.sqrt(discordant - delta**2)) ** 2 / delta**2
    return math.ceil(unpaired), math.ceil(paired)


for margin in [0.10, 0.05, 0.03, 0.02]:
    print(f"margin {margin:4.0%}: {cases_for_margin(margin):>5} cases at a 50% pass rate, {cases_for_margin(margin, 0.9):>5} at 90%")
for p_a, p_b in [(0.80, 0.85), (0.80, 0.83), (0.90, 0.91)]:
    unpaired, paired = cases_to_detect(p_a, p_b, discordant=0.10)
    print(f"{p_a:.0%} to {p_b:.0%}: {unpaired:>6} cases per version unpaired, {paired:>6} cases paired")
```

Output:

```text
margin  10%:    97 cases at a 50% pass rate,    35 at 90%
margin   5%:   385 cases at a 50% pass rate,   139 at 90%
margin   3%:  1068 cases at a 50% pass rate,   385 at 90%
margin   2%:  2401 cases at a 50% pass rate,   865 at 90%
80% to 85%:    903 cases per version unpaired,    312 cases paired
80% to 83%:   2626 cases per version unpaired,    870 cases paired
90% to 91%:  13493 cases per version unpaired,   7847 cases paired
```

What this means for real evaluation suites:

- **A golden set of 50 cases** measures a pass rate to within about ±10 points. It catches a collapse, not a three-point regression.
- **Pairing cuts the required cases by a factor of two to three** here; the gain depends on how often the versions disagree, which you can measure from a previous comparison.
- **One-point improvements of a good system need thousands of cases.** If the suite cannot be that large, state the smallest difference it can detect and treat smaller changes as unknown, not as "no change". Card and colleagues found that many published NLP comparisons were underpowered in exactly this way.

## Many slices and metrics: multiple comparisons

Each test at the 5% level has a 5% chance of a false alarm when nothing changed. Twenty slices, metrics or judges compared at once almost guarantee one:

```python
import random

rng = random.Random(5)
slices, alpha, evaluations = 20, 0.05, 10000
# When nothing changed, every p-value is uniformly distributed between 0 and 1.
false_alarms = sum(any(rng.random() < alpha for _ in range(slices)) for _ in range(evaluations))
print(f"{slices} slices and no real change: a significant slice in {false_alarms / evaluations:.0%} of evaluations")
print(f"expected 1 - (1 - alpha) ** slices = {1 - (1 - alpha) ** slices:.0%}")


def holm(p_values: dict[str, float], alpha: float = 0.05) -> dict[str, bool]:
    """Holm-Bonferroni: the i-th smallest p-value must be at most alpha / (m - i); stop at the first that is not."""
    ordered = sorted(p_values.items(), key=lambda item: item[1])
    significant, still_rejecting = {}, True
    for i, (name, p) in enumerate(ordered):
        still_rejecting = still_rejecting and p <= alpha / (len(ordered) - i)
        significant[name] = still_rejecting
    return significant


p_values = {"lang=uk": 0.004, "feature=refunds": 0.03, "feature=delivery": 0.20, "lang=en": 0.45}
for name, significant in holm(p_values).items():
    verdict = "significant" if significant else "not significant after correction"
    print(f"{name:<17} p = {p_values[name]:.3f}  {verdict}")
```

Output:

```text
20 slices and no real change: a significant slice in 64% of evaluations
expected 1 - (1 - alpha) ** slices = 64%
lang=uk           p = 0.004  significant
feature=refunds   p = 0.030  not significant after correction
feature=delivery  p = 0.200  not significant after correction
lang=en           p = 0.450  not significant after correction
```

Ways to keep false alarms under control:

- **Decide the primary metric and the decision rule before the run.** Everything else is exploratory.
- **Correct for the number of comparisons** when a decision is taken per slice. The Holm procedure controls the chance of any false alarm and is never less powerful than the simpler Bonferroni correction.
- **Treat surprising slice results as hypotheses.** Read the failing cases ([Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)) and confirm the effect on fresh cases before acting on it.

## Turning statistics into release gates

A gate such as "the candidate must not score lower than the current version" fails about half the time when the two versions are equally good, so teams learn to ignore it. A gate that accounts for noise compares the interval of the difference with a margin that the product team has agreed to accept:

```diagram
Run A (current) and B (candidate) on the same cases
        ↓
Any zero-tolerance case failed?      → yes: block
        ↓ no
Paired difference B − A, 95% interval
        ↓
Lower bound above −δ (the margin)?   → yes: ship
        ↓ no
Upper bound below 0?                 → yes: block, a regression
        ↓ no
Inconclusive: add cases or keep A
```

This is a **non-inferiority** decision: the candidate ships when the data shows that it is not worse than the current version by more than δ, for example two points. The margin is a product decision made before the run. Hard gates stay outside statistics: one leaked secret or one broken contract blocks the release regardless of averages ([Structured output and validation](/learn/llm?topic=structured-output-validation)).

A complete evaluation report states:

| Item | Example |
|---|---|
| Sample | 1,000 cases from production, stratified by language |
| Runs | 3 runs per case, temperature 0.2 |
| Estimate with interval | 82.0% (95% Wilson CI 79.5–84.3%) |
| Comparison | B − A = +3.0 points, paired 95% CI +1.1 to +4.9, McNemar p = 0.002 |
| Decision rule | Non-inferiority margin of 2 points, decided before the run |
| Reproducibility | Dataset version, scorer version, random seed |
| Slices | Holm-corrected; surprising slices sent to error analysis |

## Example project

The methods of this chapter are implemented and tested in [examples/llm-testing/11-eval-statistics](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/11-eval-statistics): Wald, Wilson and Clopper–Pearson intervals with simulated coverage, the exact McNemar test checked against complete enumeration, the paired bootstrap, pass@k and pass^k, clustered standard errors, sample-size and power calculations, the Holm correction, and a command-line comparison of two recorded runs that ends in a ship, block or inconclusive decision. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/11-eval-statistics
```

## Common mistakes

- **Reporting a pass rate without the number of cases or an interval.**
- **Using the Wald interval** for small samples or for pass rates near 0% or 100%.
- **Comparing two versions that ran on the same cases with an unpaired test,** or by looking at two averages.
- **Treating repeated runs of the same cases as independent cases,** which makes intervals too narrow.
- **Reporting pass@k when users experience pass^k.**
- **Testing many slices and acting on the one that came out significant** without a correction or a confirmation.
- **Release gates without a margin** that fail at random when nothing changed.
- **Keeping a golden set too small to detect the regressions that matter,** without stating the smallest difference it can detect.

## Summary

- An evaluation score is an estimate; case sampling, generation randomness and grader noise make it vary, and dataset validity is a separate question.
- Report every pass rate with its sample size and an interval; prefer the Wilson interval, and remember the rule of three for zero failures.
- Compare versions on the same cases and analyse them as pairs: McNemar's test and the paired interval use only the cases where the versions disagree.
- The paired bootstrap gives intervals for any metric; resample the unit that was sampled.
- With repeated runs, choose pass@k or pass^k by how the output is used, and compute standard errors per case.
- Plan sample sizes in advance: small improvements need hundreds to thousands of paired cases.
- Correct for multiple comparisons, and gate releases with a non-inferiority margin plus hard gates for zero-tolerance failures.
