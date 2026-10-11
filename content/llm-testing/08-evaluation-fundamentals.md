# Evaluation methodology and datasets

An **evaluation** (eval) is a repeatable measurement of the quality of an LLM feature: a dataset of cases, the system under test, scorers that judge every output, and a rule that turns the scores into a decision. Unit tests with fake models keep the code around the model correct; evaluations measure what the model does inside the product.

Most weak evaluation suites fail before any metric is chosen: they measure generic qualities nobody needs, on cases nobody uses, against labels nobody agreed on. This chapter covers the method that prevents that: success criteria, error analysis, building and maintaining datasets, labels and agreement, overfitting and contamination, running evaluations, frameworks, and reading results. The next chapters cover the instruments: [code-based scorers](/learn/llm?topic=code-based-scorers), [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation) and [statistics](/learn/llm?topic=eval-statistics).

**Prerequisites:** [Why LLM testing is different](/learn/llm?topic=llm-testing-problem-space), [Testing LLM code without the model](/learn/llm?topic=testing-without-the-model).

## Tests and evaluations

| Aspect | Classic test | Evaluation |
|---|---|---|
| Expected result | One exact oracle | A scoring rule: assertion, metric, rubric or human label |
| Outcome | Pass or fail | A verdict per case, aggregated into rates per slice |
| Determinism | Expected to be stable | Run-to-run variation is normal and must be measured |
| Purpose | Prove that a requirement holds | Measure quality, compare versions, catch regressions |
| Size | One case per behaviour | Dozens to thousands of cases per behaviour |

Every evaluation has the same five parts:

```text
evaluation = dataset      cases: inputs plus what is needed to judge them (facts, labels, references, tags)
           + task         the system under test, called the same way as in production
           + scorers      code, model judges or people, each returning a verdict with a reason
           + aggregation  pass rates overall and per slice, with their uncertainty
           + decision     a rule fixed in advance that turns results into ship, block or investigate
```

## The evaluation loop

Evaluation is not a phase at the end of a project. It is a loop that starts before the first prompt is written and continues in production:

```diagram
1. Success criteria    What must be true for users and the business?
        ↓
2. Error analysis      Read real outputs; name and count what goes wrong
        ↓
3. Dataset             Cases that represent real use and the failures found
        ↓
4. Scorers             One check for each criterion and failure category
        ↓
5. Baseline            Run the current version; it is the reference
        ↓
6. Iterate             Change prompts, models or retrieval; compare with the baseline
        ↓
7. Gate and monitor    Run in CI, sample production; new failures return to step 2
```

Working this way is called eval-driven development. The loop restarts whenever the product, the model or the users change.

## Success criteria

A criterion that can be evaluated names what must be true, how it is measured, the threshold and its priority ([Why LLM testing is different](/learn/llm?topic=llm-testing-problem-space) shows how to derive criteria from risks). For the support assistant used throughout this course:

| Criterion | Measured by | Threshold |
|---|---|---|
| States the return and refund policy correctly | Fact scorer on 300 policy questions | At least 95% |
| Never invents a policy | Judge validated against human labels | At most 1% |
| Replies in the language of the customer | Code-based scorer on every case | 100% |
| Looks up the order when an order number is given | Check of the tool calls in the trace | At least 98% |

Prefer **binary criteria**, pass or fail, to scores from 1 to 5. Two reviewers rarely agree on whether an answer is a 3 or a 4, a middle score hides what is wrong, and a pass rate is easy to track. If quality has several aspects, write one binary criterion per aspect.

## Error analysis

Error analysis is the step most teams skip and the one that decides whether the evaluation measures anything useful. It borrows two techniques from qualitative research:

1. **Collect traces:** 100 or more real or realistic inputs, each with the full trace: input, retrieved context, tool calls, output.
2. **Open coding:** read each trace and write a short free-text note about the first thing that went wrong. Upstream errors cause downstream ones, so a wrong retrieval is noted, not the wrong answer it produced.
3. **Axial coding:** group the notes into a small failure taxonomy with clear, non-overlapping names.
4. **Count and prioritize:** how often each category occurs, weighted by how much harm it does.
5. **Act:** turn the top categories into scorers and dataset cases.

One domain expert who understands the users should own the judgement; a committee produces inconsistent labels. Keep reading new traces until they stop revealing new categories, which qualitative researchers call **saturation**.

```python
from collections import Counter

# Reading 40 traces of the support assistant: (trace, failure category, or None when nothing was wrong).
# The categories were not chosen in advance. Free-text notes were written first (open coding)
# and then grouped into a short list (axial coding).
reviewed = [
    ("t01", None), ("t02", "invented policy"), ("t03", "missing citation"), ("t04", None),
    ("t05", "too long"), ("t06", "invented policy"), ("t07", None), ("t08", "missed order lookup"),
    ("t09", "missing citation"), ("t10", None), ("t11", None), ("t12", "too long"),
    ("t13", "wrong language"), ("t14", None), ("t15", "missing citation"), ("t16", None),
    ("t17", "invented policy"), ("t18", None), ("t19", "missed order lookup"), ("t20", None),
    ("t21", "missing citation"), ("t22", None), ("t23", "too long"), ("t24", None),
    ("t25", None), ("t26", "invented policy"), ("t27", None), ("t28", "missing citation"),
    ("t29", None), ("t30", None), ("t31", "too long"), ("t32", None),
    ("t33", "missed order lookup"), ("t34", None), ("t35", "missing citation"), ("t36", None),
    ("t37", None), ("t38", "invented policy"), ("t39", None), ("t40", None),
]
SEVERITY = {"invented policy": 3, "missed order lookup": 3, "wrong language": 2, "missing citation": 2, "too long": 1}

failures = Counter(category for _, category in reviewed if category)
print(f"{sum(failures.values())} of {len(reviewed)} traces have a problem")
print("category              traces  severity  priority")
for category, count in sorted(failures.items(), key=lambda item: -item[1] * SEVERITY[item[0]]):
    print(f"{category:<21} {count:>6}  {SEVERITY[category]:>8}  {count * SEVERITY[category]:>8}")

seen, first_seen = set(), []
for position, (_, category) in enumerate(reviewed, 1):
    if category and category not in seen:
        seen.add(category)
        first_seen.append(position)
print("new categories appeared at traces", first_seen, "and none in the last", len(reviewed) - first_seen[-1])
```

Output:

```text
19 of 40 traces have a problem
category              traces  severity  priority
invented policy            5         3        15
missing citation           6         2        12
missed order lookup        3         3         9
too long                   4         1         4
wrong language             1         2         2
new categories appeared at traces [2, 3, 5, 8, 13] and none in the last 27
```

The most frequent problem, missing citations, is not the most important one: invented policies are rarer but more harmful. Every category also suggests its instrument. An invented policy needs a fact scorer or a validated judge; a missed order lookup is a deterministic check of the tool calls in the trace; "too long" is a word count. A generic "helpfulness" score from a framework would have measured none of them.

## Building an evaluation dataset

A dataset should represent real use, contain the failures you know about, and cover the slices you care about. Each source contributes something different:

| Source | Gives you | Watch out for |
|---|---|---|
| Samples of production traffic | The real mix of requests and wordings | Personal data; easy, frequent requests dominate |
| Failures from error analysis and incidents | Cases known to break | Past failures only; add them, do not build only from them |
| Edge cases | Empty, very long, mixed-language, ambiguous inputs | Can drift away from real use |
| Adversarial cases | Prompt injection, jailbreaks, off-topic requests | Belong to a separate security suite |
| Synthetic cases | Coverage of rare combinations | Unnatural wording; every case needs review |

Store one case per line in a versioned file. Besides the input, a case carries what its scorers need and the tags its results are sliced by:

```json
{"id": "refunds-0042", "input": "Can I return shoes after 40 days?", "expected_facts": ["return-window-30-days", "counted-from-delivery"], "forbidden": ["promises-exception"], "tags": {"lang": "en", "intent": "returns", "difficulty": "policy-boundary"}, "source": "production-2026-09", "added": "2026-10-02"}
```

The script builds a dataset from a production log in four steps:

```python
import hashlib
import random
import re
from collections import Counter, defaultdict

rng = random.Random(42)
QUESTIONS = {
    "returns": ["Can I return shoes after {n} days?", "How do I send back order A-{order}?"],
    "delivery": ["Where is my parcel A-{order}?", "Order A-{order} is {n} days late"],
    "refunds": ["When will I get my refund for A-{order}?", "Refund A-{order} to {email} please"],
    "account deletion": ["Delete my account {email}, last order A-{order}"],
}
SHARES = {"returns": 0.45, "delivery": 0.30, "refunds": 0.20, "account deletion": 0.05}

# 2,000 logged messages; one in five repeats an earlier one (retries, the same question again)
log = []
for i in range(2000):
    if log and rng.random() < 0.2:
        log.append({**rng.choice(log), "id": f"req-{i:04d}"})
        continue
    intent = rng.choices(list(SHARES), weights=list(SHARES.values()))[0]
    text = rng.choice(QUESTIONS[intent]).format(n=rng.randint(1, 90), order=rng.randint(1000, 9999),
                                                 email=f"user{rng.randint(1, 5000)}@mail.example")
    log.append({"id": f"req-{i:04d}", "intent": intent, "text": text})

# 1. Remove personal data before anything is stored in the dataset
EMAIL = r"[\w.+-]+@[\w-]+\.[\w.]+"
for entry in log:
    entry["text"] = re.sub(EMAIL, "<email>", entry["text"])

# 2. Drop duplicates after normalization: they add cost, not information
unique, seen = [], set()
for entry in log:
    key = " ".join(entry["text"].lower().split())
    if key not in seen:
        seen.add(key)
        unique.append(entry)
print(f"{len(log)} logged messages, {len(unique)} after removing duplicates")

# 3. Stratified sample: proportional to traffic, but at least 10 cases for every intent
target, minimum = 120, 10
by_intent = defaultdict(list)
for entry in unique:
    by_intent[entry["intent"]].append(entry)
sample = []
for intent, entries in by_intent.items():
    size = max(round(target * len(entries) / len(unique)), minimum)
    sample += rng.sample(entries, size)
    print(f"{intent:<17} {len(entries):>4} in the log, {size:>3} in the sample")


# 4. Stable split: a case always lands in the same split, whatever the order of the file
def split(case_id: str) -> str:
    return "test" if int(hashlib.sha256(case_id.encode()).hexdigest(), 16) % 100 < 30 else "dev"


print(f"{len(sample)} cases:", dict(Counter(split(case["id"]) for case in sample)))
print("scrubbed example:", next(case["text"] for case in sample if "<email>" in case["text"]))
```

Output:

```text
2000 logged messages, 1320 after removing duplicates
delivery           506 in the log,  46 in the sample
refunds            311 in the log,  28 in the sample
returns            424 in the log,  39 in the sample
account deletion    79 in the log,  10 in the sample
123 cases: {'dev': 87, 'test': 36}
scrubbed example: Refund A-7388 to <email> please
```

Why each step matters:

- **Personal data is removed first**, so it never reaches the dataset, its version history or the reports built from it.
- **Duplicates distort results.** A third of this log repeats other requests; one wrong answer to a popular question would otherwise count dozens of times. Near-duplicates (the same question with small wording changes) need a similarity check, which the example project implements.
- **A purely proportional sample starves rare slices.** Account deletion is about 6% of traffic and would get 7 cases; with a minimum of 10 its pass rate can at least show a collapse. Report slices separately, because the overall rate weights them by their sample size, not by their importance.
- **Hash-based splits are stable.** Adding cases or shuffling the file never moves a case between the development set and the test set.

Rules for keeping a dataset useful:

- **Version it** next to the prompts and scorers, and store the dataset version with every result.
- **Tag every case** by language, intent, difficulty and source, so that results can be sliced.
- **Grow it with every production failure** and retire cases that no longer represent the product.
- **Document it:** where the cases come from, how they were labelled, and the known gaps, in the spirit of datasheets for datasets.

## Synthetic cases with coverage

Production samples miss rare combinations: an angry customer asking two questions in Ukrainian may never appear in a month of logs. Synthetic cases fill such gaps when they are generated systematically: choose the dimensions that change behaviour, choose combinations of their values, generate inputs for each combination with a model, and review every generated case.

All combinations quickly become too many. Combinatorial testing offers a classic answer: many defects are triggered by the interaction of two factors, so a set of cases that covers every **pair** of values catches them with far fewer cases.

```python
from itertools import combinations, product

DIMENSIONS = {
    "persona": ["new customer", "regular customer", "angry customer"],
    "intent": ["return", "refund", "delivery"],
    "language": ["en", "uk"],
    "difficulty": ["simple", "ambiguous", "two questions"],
}
names = list(DIMENSIONS)
every_tuple = list(product(*DIMENSIONS.values()))


def pairs_of(values):
    return {((names[i], values[i]), (names[j], values[j])) for i, j in combinations(range(len(values)), 2)}


uncovered = set().union(*(pairs_of(values) for values in every_tuple))
print(f"all combinations: {len(every_tuple)}, value pairs to cover: {len(uncovered)}")

chosen = []
while uncovered:
    best = max(every_tuple, key=lambda values: len(pairs_of(values) & uncovered))
    chosen.append(best)
    uncovered -= pairs_of(best)

print(f"cases that cover every pair of values: {len(chosen)}")
for values in chosen[:5]:
    print("  " + " | ".join(values))
```

Output:

```text
all combinations: 54, value pairs to cover: 45
cases that cover every pair of values: 9
  new customer | return | en | simple
  new customer | refund | uk | ambiguous
  regular customer | return | uk | two questions
  regular customer | delivery | en | ambiguous
  angry customer | refund | en | two questions
```

Nine combinations cover every pair that 54 would. Each combination becomes a short instruction for a generator model ("write the message of an angry regular customer asking two questions about a refund, in Ukrainian"), usually with several inputs per combination. A person reviews every generated case before it enters the dataset: generated text tends to be cleaner and more explicit than real messages, and a model should not be the only judge of cases it wrote.

## Labels and reference answers

What a case stores as its expected result depends on the task:

| Expected result | Fits | Scored by |
|---|---|---|
| Exact label | Classification, routing, extraction | Exact match, classification metrics |
| Expected and forbidden facts | Free-text answers about known facts | Fact-based scorers |
| Reference answer | Translation, rewriting, summarization | Overlap or similarity metrics, with care |
| Grading notes | Open-ended answers | A validated judge or a person |

Labels need written guidelines with examples of borderline cases. To find out whether the guidelines work, let two people label the same sample and measure their agreement. Raw agreement is misleading when one label is rare, so the standard measure, **Cohen's kappa**, subtracts the agreement expected by chance:

```text
observed agreement   p_o = share of cases with the same label
chance agreement     p_e = Σ over labels of (share of reviewer 1) · (share of reviewer 2)
Cohen's kappa        κ = (p_o − p_e) / (1 − p_e)        1 = perfect, 0 = no better than chance
```

```python
from collections import Counter

# Two reviewers label the same 30 answers as P (pass) or F (fail)
reviewer_1 = "PPPPFPPPPPPPFPPPPPPPPPFPPPPPPP"
reviewer_2 = "PPPPFPPPPPPFPPPPPPPPPPPPPPPPPF"


def cohen_kappa(a: str, b: str) -> tuple[float, float, float]:
    """Observed agreement, agreement expected by chance from each reviewer's label shares, and kappa."""
    n = len(a)
    observed = sum(x == y for x, y in zip(a, b)) / n
    shares_a, shares_b = Counter(a), Counter(b)
    expected = sum(shares_a[label] * shares_b[label] for label in shares_a) / n**2
    return observed, expected, (observed - expected) / (1 - expected)


observed, expected, kappa = cohen_kappa(reviewer_1, reviewer_2)
both_fail = sum(x == y == "F" for x, y in zip(reviewer_1, reviewer_2))
print(f"raw agreement {observed:.0%}, agreement expected by chance {expected:.0%}, kappa {kappa:.2f}")
print(f"failures found: reviewer 1 {reviewer_1.count('F')}, reviewer 2 {reviewer_2.count('F')}, both {both_fail}")
```

Output:

```text
raw agreement 87%, agreement expected by chance 82%, kappa 0.26
failures found: reviewer 1 3, reviewer 2 3, both 1
```

An 87% agreement sounds good, but two reviewers who mark almost everything as passing agree that often by chance. The kappa of 0.26 shows what matters: of five answers that someone marked as failing, the reviewers agree on one. Before labelling hundreds of cases, discuss exactly these disagreements, sharpen the criterion and its examples, and measure again. The same measure later validates model judges against human labels ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)).

## Splits, overfitting and contamination

- **Development and test sets.** Iterate on prompts against the development set; use the held-out test set for decisions, and look at its individual cases rarely. When the development score rises and the test score does not, the prompt has been fitted to the development cases.
- **Few-shot examples taken from evaluation cases** inflate scores: the model has seen the answers. Keep examples in prompts and evaluation cases in disjoint sets, and check the overlap automatically.
- **Contamination.** Public benchmarks and their answers can be part of the training data of the model under test, which makes scores on them unreliable. Private cases built from your own product are much less exposed; refresh them over time.
- **A metric that becomes a target stops measuring.** When the team optimizes one number, read samples of outputs regularly to confirm that the number still means what it did.

## Layers of checks

Checks belong to the cheapest layer that can make them reliably:

```diagram
            /  production monitoring  \      live traffic, online scorers, user feedback
           /     human review          \     expert labels on samples
          /   model-graded evaluation   \    LLM-as-a-judge validated against people
         /  reference-based metrics      \   facts, overlap, retrieval metrics
        /  deterministic assertions       \  schema, patterns, length, citations, cost, latency
       /  unit tests with a fake model     \ parsing, routing, retries, tool loops
```

Lower layers are cheap, fast and repeatable; upper layers are expensive and noisy but closer to what users experience. Never ask a model judge whether an output is valid JSON, and never trust a judge that was not compared with human labels.

## Running evaluations

An evaluation run is an experiment. Record enough to reproduce it and to explain its results:

| Recorded item | Why |
|---|---|
| Dataset version and case IDs | To know exactly what was measured |
| Model ID, prompt version and parameters | To know exactly what was evaluated |
| Scorer versions | Results are comparable only under the same scorers |
| Raw outputs and traces | To re-score without re-running the model, and to read failures |
| Seeds, timestamps, cost and latency | To reproduce the run and to watch the budget |

Practical rules for the harness:

- **Separate generation from scoring.** Store outputs once, then score them as often as scorers change.
- **Cache model calls** by model, prompt version, parameters and input, so that unchanged cases cost nothing on the next run.
- **Run cases concurrently within the provider's rate limits,** and retry only transient errors ([LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy)).
- **Keep runs immutable.** A run that was re-scored or partly re-generated is a new run.

## Evaluation frameworks

Frameworks provide datasets, runners, caching, built-in scorers, reports and CI integration. The concepts in this chapter apply to all of them:

| Tool | Style | Good fit |
|---|---|---|
| promptfoo | YAML configuration and a command-line runner; assertions from substring checks to custom code and model graders | Comparing prompts and models in CI |
| DeepEval | Test cases and metrics in the style of pytest | Teams whose tests already live in pytest |
| Inspect AI | Python tasks made of datasets, solvers and scorers; sandboxes for agents | Agent and capability evaluations |
| OpenAI Evals | A registry of evaluation templates and benchmarks | Benchmark-style evaluations |
| Platforms such as Braintrust, Langfuse or Phoenix | Datasets, experiments and production traces with a review interface | Teams that need annotation and tracing in one place |

A promptfoo configuration for two of the refund cases, comparing two prompt versions:

```yaml
description: Support assistant, refund policy
prompts:
  - file://prompts/support-answer/v13.txt
  - file://prompts/support-answer/v14.txt
providers:
  - id: anthropic:messages:claude-sonnet-5-5   # pin the exact model you ship
    config:
      temperature: 0
tests:
  - vars:
      question: Can I return shoes after 40 days?
    assert:
      - type: icontains
        value: 30 days
      - type: not-icontains
        value: exception
  - vars:
      question: Чи можна повернути взуття через 40 днів?
    assert:
      - type: icontains
        value: 30 днів
      - type: llm-rubric
        value: Answers in Ukrainian and says that the 30 days start at delivery
```

The same check as an Inspect AI task:

```python
# Run on your own machine: pip install inspect-ai
# then: inspect eval refunds.py --model anthropic/claude-sonnet-5-5
from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import includes
from inspect_ai.solver import generate, system_message


@task
def refunds():
    return Task(
        dataset=[Sample(input="Can I return shoes after 40 days?", target="30 days")],
        solver=[system_message("You are the support assistant of an online shoe store."), generate()],
        scorer=includes(),
    )
```

Choose one framework for offline evaluations, keep custom scorers as plain functions that you can test on their own, and avoid built-in metrics whose definition you cannot explain.

## Reading results: scorecards and flipped cases

A result is a comparison with the baseline, not a single number. The aggregate is the least informative part of it:

```python
from collections import defaultdict

# Per-case verdicts of the baseline (prompt v2) and the candidate (prompt v3) on the same 12 cases
cases = {
    "c01": ("en", True, True), "c02": ("en", False, True), "c03": ("en", True, True),
    "c04": ("en", False, True), "c05": ("en", True, True), "c06": ("en", True, True),
    "c07": ("en", False, False), "c08": ("en", True, True), "c09": ("uk", True, False),
    "c10": ("uk", True, True), "c11": ("uk", True, False), "c12": ("uk", True, True),
}

baseline = sum(old for _, old, _ in cases.values()) / len(cases)
candidate = sum(new for _, _, new in cases.values()) / len(cases)
print(f"pass rate: baseline {baseline:.0%}, candidate {candidate:.0%}, change {candidate - baseline:+.0%}")

fixed = [case for case, (_, old, new) in cases.items() if new and not old]
broken = [case for case, (_, old, new) in cases.items() if old and not new]
print(f"fixed (fail to pass): {fixed}")
print(f"broken (pass to fail): {broken}")

by_slice = defaultdict(lambda: [0, 0, 0])
for lang, old, new in cases.values():
    by_slice[lang][0] += old
    by_slice[lang][1] += new
    by_slice[lang][2] += 1
for lang, (old, new, total) in sorted(by_slice.items()):
    print(f"lang={lang}: baseline {old}/{total}, candidate {new}/{total}")
```

Output:

```text
pass rate: baseline 75%, candidate 75%, change +0%
fixed (fail to pass): ['c02', 'c04']
broken (pass to fail): ['c09', 'c11']
lang=en: baseline 5/8, candidate 7/8
lang=uk: baseline 4/4, candidate 2/4
```

"No change" hides two fixes and two new failures, both in Ukrainian. Read every flipped case before approving a change: flips show what the change really did, and a cluster of flips in one slice is a regression even when the average is flat. Whether a difference is larger than noise is a statistical question ([Statistics for evaluation](/learn/llm?topic=eval-statistics)).

## Example project

The method of this chapter is implemented and tested in [examples/llm-testing/08-evaluation-methodology](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/08-evaluation-methodology): an error-analysis report with priorities and saturation, a dataset builder that scrubs personal data, removes duplicates and near-duplicates, samples by slice and splits by hash, a dataset validator that finds schema errors, duplicate IDs, leakage between splits and thin slices, a pairwise generator for synthetic case specifications, an agreement report for labels, and an evaluation runner with a response cache, a run manifest and a scorecard of flipped cases. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/08-evaluation-methodology
```

## Common mistakes

- **Choosing metrics before reading outputs,** which produces generic scores that miss the real failures.
- **Scales from 1 to 5 without anchors** instead of binary criteria with examples.
- **A dataset of easy, frequent cases** that reports a high pass rate and says nothing about rare slices.
- **Duplicates and personal data in the dataset.**
- **Synthetic cases that nobody reviewed.**
- **Labels without guidelines or an agreement check.**
- **Tuning prompts on the test set,** or few-shot examples copied from evaluation cases.
- **Unrecorded runs:** no dataset, prompt, model or scorer version stored with the results.
- **Approving a change from the average** without reading the flipped cases.

## Summary

- An evaluation is a dataset, a task, scorers, aggregation and a decision rule fixed in advance.
- Start from success criteria and error analysis: read traces, code the failures, count them, prioritize by frequency and severity, and read until saturation.
- Build datasets from production samples, known failures, edge cases and reviewed synthetic cases; scrub personal data, remove duplicates, stratify by slice and split by hash.
- Generate synthetic cases from dimensions; pairwise coverage keeps their number small.
- Store the expected result that fits the task, write labelling guidelines, and check agreement with Cohen's kappa.
- Keep a held-out test set, keep few-shot examples out of the evaluation, and prefer private cases to public benchmarks.
- Record every run fully, separate generation from scoring, and read flipped cases and slices, not just the average.
