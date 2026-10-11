# LLM-as-a-judge

A **judge** is a language model that evaluates the output of another model against a criterion. Judges make it possible to evaluate what code cannot check, such as faithfulness to a source, tone, relevance or instruction following, on thousands of cases at the cost of an API call each.

A judge is also an LLM application, with everything that implies: it is non-deterministic, biased, sensitive to its prompt, and confidently wrong at times. A judge that has never been compared with human labels produces numbers of unknown meaning. This chapter treats the judge as a measuring instrument that has to be designed, calibrated and monitored: when to use one, how to write it, how to validate it, how to correct for its errors, how to detect its biases, and how to keep it reliable.

**Prerequisites:** [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals), [Code-based scorers and metrics](/learn/llm?topic=code-based-scorers), [Structured output and validation](/learn/llm?topic=structured-output-validation).

## When to use a judge

Use code when you can, a judge when the criterion requires reading, and people to define the criteria and validate the judge:

| Criterion | Instrument |
|---|---|
| The output is valid JSON, contains a link, stays under 80 words | Code |
| The answer states the 30-day return window | Code-based fact scorer, while the accepted wordings can be listed |
| Every statement in the answer is supported by the retrieved policy | Judge, claim by claim |
| The tone stays calm and polite with an angry customer | Judge |
| The assistant asks one clarifying question when the request is ambiguous | Judge |
| Which of two answers would help the customer more | Pairwise judge, validated against people |

A judge is the right tool when correct outputs vary too much to enumerate and the criterion can still be stated precisely enough that two experts would agree.

## Judge designs

| Design | Question to the judge | Good for |
|---|---|---|
| Pointwise, binary | "Does this answer meet criterion X? PASS or FAIL, with a critique." | Regression suites and release gates |
| Reference-guided | "Is this answer consistent with the reference answer?" | Questions with known answers in varied wording |
| Pairwise | "Which of answers A and B better meets criterion X?" | Comparing two prompts or models |
| Claim decomposition | "List the claims in the answer and mark each as supported or not by the context." | Faithfulness and hallucination checks |
| Scored rubric | "Rate the answer from 1 to 5 on criterion X" (G-Eval uses token probabilities for the score) | Research comparisons; hard to act on in regression suites |
| Fine-tuned judge | A smaller model trained to evaluate (for example Prometheus) | High volume, once validated on your criteria |

For regression testing, prefer one **binary pointwise judge per criterion**. Binary verdicts are easier to label, to validate and to act on than a scale, and a separate judge per criterion shows which property failed.

## Writing a judge prompt

A judge prompt is a specification of the criterion plus the evidence the judge needs. The template below checks one criterion of the support assistant, "does not invent policy":

```text
You evaluate one property of answers written by the support assistant of an online shoe store.

Criterion: the answer must not state any rule, number, deadline, fee or promise that the policy
text does not contain.
PASS: every policy statement in the answer is supported by the policy text. Paraphrases are fine.
FAIL: at least one statement adds to or changes the policy.

Examples:
{examples}        (two passing and two failing answers from the development labels, with critiques)

Policy text: {policy}
Customer question: {question}
Answer to evaluate: {answer}

First write a short critique that quotes each policy statement you checked, then give the verdict.
Respond with JSON: {"critique": "...", "verdict": "PASS" or "FAIL"}
```

What makes it work:

- **One criterion, defined by its failures.** "Helpful and accurate" is two criteria with no definition; "adds to or changes the policy" is one, and it says what to look for.
- **Examples from your own labelled data,** taken from the development labels only, so that the test labels still measure the judge honestly.
- **Only the evidence the criterion needs.** For faithfulness that is the source text; a judge without the source can only check plausibility.
- **Critique before verdict.** Writing the evidence first tends to produce better-founded verdicts, and the critique tells a reviewer why the judge decided as it did.
- **Structured output** validated like any other model output ([Structured output and validation](/learn/llm?topic=structured-output-validation)), a pinned model version, temperature 0 and a versioned prompt.

A judge call with the Anthropic SDK and a Pydantic contract:

```python
# Run on your own machine: pip install anthropic pydantic
from typing import Literal

import anthropic
from pydantic import BaseModel


class Verdict(BaseModel):
    critique: str
    verdict: Literal["PASS", "FAIL"]


client = anthropic.Anthropic()
JUDGE_MODEL = "claude-sonnet-5-5"  # pin the exact version that was validated


def judge(prompt: str) -> Verdict:
    response = client.messages.parse(
        model=JUDGE_MODEL,
        max_tokens=800,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
        output_format=Verdict,
    )
    return response.parsed_output
```

## Validating a judge against human labels

A binary judge is a classifier, so it is validated like one, against labels from the domain expert:

1. **Label answers by hand:** 100 or more, with enough failures (aim for at least 30 to 50), each with the reason for the verdict.
2. **Split the labels:** a development set to improve the judge prompt and choose its examples, and a test set that is used once, for the final measurement.
3. **Measure agreement** on the test set with three numbers:

```text
TPR (true positive rate)  share of answers that people pass and the judge passes too
TNR (true negative rate)  share of answers that people fail and the judge fails too
kappa                     agreement corrected for chance (see Evaluation methodology and datasets)
```

Raw accuracy hides the important error: when 85% of answers pass, a judge that passes everything is 85% accurate and catches nothing. TNR is the share of real failures the judge catches, which is what a regression suite needs.

```python
from collections import Counter

# Human labels and judge verdicts (P = pass, F = fail) on labelled answers.
# The dev set is used to improve the judge prompt; the test set is used once, for the final report.
human_dev = "PPPPFPPFPPPPFPPPPFPPPPPFPPPPFPPPPPFPPPPP"
judge_v1_dev = "PPPPPPPFPPPPPPPPPPPPPPPFPPPPPPPPPPFPPPPP"
judge_v2_dev = "PPPPFPPFPPPPFPPPPFPPPFPFPPPPFPPPPPFPPPPP"
human_test = "PPPFPPPPPPFPPPPPPFPPPPPPFPPPPPFPPPFPPPPP"
judge_v2_test = "PPPFPPPPPPFPPPPPPPPPPPPPFPPPPPFPPFFPPPPP"


def agreement(human: str, judge: str) -> dict[str, float]:
    pairs = Counter(zip(human, judge))
    tpr = pairs[("P", "P")] / (pairs[("P", "P")] + pairs[("P", "F")])  # human passes, judge agrees
    tnr = pairs[("F", "F")] / (pairs[("F", "F")] + pairs[("F", "P")])  # human fails, judge agrees
    n = len(human)
    observed = (pairs[("P", "P")] + pairs[("F", "F")]) / n
    expected = (human.count("P") * judge.count("P") + human.count("F") * judge.count("F")) / n**2
    return {"TPR": tpr, "TNR": tnr, "kappa": (observed - expected) / (1 - expected), "missed failures": pairs[("F", "P")]}


for name, human, judge in [("judge v1, dev", human_dev, judge_v1_dev), ("judge v2, dev", human_dev, judge_v2_dev),
                           ("judge v2, test", human_test, judge_v2_test)]:
    metrics = agreement(human, judge)
    print(f"{name:<15} TPR {metrics['TPR']:.2f}  TNR {metrics['TNR']:.2f}  kappa {metrics['kappa']:.2f}  "
          f"missed failures {metrics['missed failures']} of {human.count('F')}")
```

Output:

```text
judge v1, dev   TPR 1.00  TNR 0.43  kappa 0.55  missed failures 4 of 7
judge v2, dev   TPR 0.97  TNR 1.00  kappa 0.92  missed failures 0 of 7
judge v2, test  TPR 0.97  TNR 0.83  kappa 0.80  missed failures 1 of 6
```

The first judge prompt is lenient: it passes almost everything and misses four of seven failures. After the development disagreements were turned into a sharper definition and examples, version 2 looks perfect on the development set, but that set was used to tune it. The untouched test set gives the honest numbers: one of six failures is missed. With only six failures in the test set, the TNR is itself uncertain, so collecting more failing examples is the best next step ([Statistics for evaluation](/learn/llm?topic=eval-statistics)).

Decide the minimum TPR and TNR before validating, and read every disagreement. When two experts disagree with each other as often as with the judge, the criterion is not defined well enough to automate.

## Correcting a measured pass rate

When a validated judge scores unlabelled production answers, its errors still bias the result. A lenient judge reports a pass rate that is too high. If TPR and TNR are known, the observed rate can be corrected:

```text
observed pass rate   p_obs = θ · TPR + (1 − θ) · (1 − TNR)          θ = true pass rate
corrected estimate   θ̂ = (p_obs + TNR − 1) / (TPR + TNR − 1)          (Rogan and Gladen, 1978)
                     valid only when TPR + TNR > 1, a judge better than chance; clip to [0, 1]
```

The uncertainty comes from two places: the sample of judged answers and the labelled set that measured TPR and TNR. A bootstrap over both captures it:

```python
import random

# Judge quality measured on 80 human-labelled test answers: (human verdict, judge verdict)
labelled = [("P", "P")] * 57 + [("P", "F")] * 3 + [("F", "F")] * 12 + [("F", "P")] * 8
# The judge then scores 1,000 unlabelled production answers and passes 812 of them
unlabelled = ["P"] * 812 + ["F"] * 188


def corrected_rate(labelled, unlabelled) -> float:
    """Rogan-Gladen: the true pass rate implied by the observed rate and the judge error rates."""
    human_pass = [judge for human, judge in labelled if human == "P"]
    human_fail = [judge for human, judge in labelled if human == "F"]
    tpr = human_pass.count("P") / len(human_pass)
    tnr = human_fail.count("F") / len(human_fail)
    observed = unlabelled.count("P") / len(unlabelled)
    return min(1.0, max(0.0, (observed + tnr - 1) / (tpr + tnr - 1)))


rng = random.Random(1)
estimates = sorted(
    corrected_rate([rng.choice(labelled) for _ in labelled], [rng.choice(unlabelled) for _ in unlabelled])
    for _ in range(2000)
)
print(f"judge says: {unlabelled.count('P') / len(unlabelled):.1%} of answers pass")
print(f"corrected for judge errors: {corrected_rate(labelled, unlabelled):.1%}")
print(f"95% bootstrap interval: {estimates[50]:.1%} to {estimates[1949]:.1%}")
```

Output:

```text
judge says: 81.2% of answers pass
corrected for judge errors: 74.9%
95% bootstrap interval: 55.3% to 86.4%
```

The judge misses 8 of 20 labelled failures (TNR 0.60), so it overstates the pass rate by about six points. The interval is wide because 20 labelled failures measure the TNR poorly: more labelled failures narrow it far more than more production answers do. The judgy library implements this correction with bootstrap intervals. At minimum, report a judged metric together with the judge's TPR and TNR.

## Known biases and how to measure them

| Bias | What happens | How to measure it | Mitigation |
|---|---|---|---|
| Position bias | In pairwise comparison, the answer shown first (or second) wins more often | Judge every pair in both orders; count inconsistent verdicts | Always use both orders; count inconsistent pairs as ties |
| Verbosity bias | Longer answers win or pass more often | Pad correct answers with irrelevant text; the verdict must not improve | State that length is not quality; analyse results by length |
| Self-preference | A judge favours answers from its own model family | Compare its verdicts with human labels separately for each model | A judge from another family, validated on all compared models |
| Leniency | The judge passes almost everything | TNR on labelled failures | Precise failure definitions and failing examples |
| Prompt sensitivity | Small edits to the judge prompt move verdicts | Re-run the validation after every change | Version the judge prompt and model; re-validate on change |
| Persuasion by the answer | Confident claims of correctness sway the judge | Labelled answers that claim to follow the policy but do not | Give the source; require quoted evidence in the critique |

Position bias in a pairwise comparison of two prompt versions:

```python
from collections import Counter

# Each pair of answers (A from the current prompt, B from the candidate) was judged twice:
# once with A shown first and once with B shown first. Each entry is the winner in (first run, second run).
verdicts = ([("B", "B")] * 18 + [("A", "A")] * 12 + [("A", "B")] * 14 + [("B", "A")] * 6)

consistent = [first for first, second in verdicts if first == second]
shown_first_won = sum(first == "A" for first, _ in verdicts) + sum(second == "B" for _, second in verdicts)
print(f"{len(verdicts)} pairs, consistent in both orders: {len(consistent)} ({len(consistent) / len(verdicts):.0%})")
print(f"the answer shown first won {shown_first_won} of {2 * len(verdicts)} judgements ({shown_first_won / (2 * len(verdicts)):.0%})")

naive = Counter(first for first, _ in verdicts)
wins = Counter(consistent)
ties = len(verdicts) - len(consistent)
print(f"one order only:  B wins {naive['B'] / len(verdicts):.0%}")
print(f"both orders:     B wins {wins['B']}, A wins {wins['A']}, inconsistent (tie) {ties}; "
      f"B win rate counting ties as half {(wins['B'] + ties / 2) / len(verdicts):.0%}")
```

Output:

```text
50 pairs, consistent in both orders: 30 (60%)
the answer shown first won 58 of 100 judgements (58%)
one order only:  B wins 48%
both orders:     B wins 18, A wins 12, inconsistent (tie) 20; B win rate counting ties as half 56%
```

With A always shown first, the candidate seems to lose; judged in both orders it wins. Forty percent of the verdicts depend only on the order, which also says that many pairs are too close for this judge to separate. Whether 18 wins against 12 is more than noise is a question for a sign test or a bootstrap interval ([Statistics for evaluation](/learn/llm?topic=eval-statistics)). Systems that rank many models from pairwise verdicts, such as Chatbot Arena, fit a Bradley–Terry model to them; for two versions, a win rate with an interval is enough.

## Keeping a judge reliable

- **A judge has a version:** its prompt, its examples and its model. Changing any of them requires a new validation on the test labels.
- **Re-label a fresh sample regularly,** for example every month, and recompute TPR and TNR. The system, the users and the model behind the judge all change.
- **Watch the share of failing verdicts in production.** A sudden change means a change in the system or in the judge, and both need attention.
- **Turn disagreements into examples,** but add them to the development labels, never to the test labels.
- **Expect criteria to drift.** Reading outputs while grading them sharpens what "good" means; when the criterion changes, update the labels with it.

## Cost and latency

- **Judge only what code cannot decide,** and skip the judge when a code check has already failed the answer.
- **Judge a sample** of production traffic large enough for the precision you need, not every answer.
- **Cache verdicts** by judge version, input and output.
- **Use a smaller judge model** if it passes the same validation as the larger one.
- **Track the cost of judging** per evaluation run next to the cost of generation.

## Without a reference: metamorphic relations

Sometimes neither a reference nor a reliable judge exists. Metamorphic testing checks how outputs for related inputs must relate to each other, which needs no correct answer at all:

| Relation | Transformation of the input | Expected relation of the outputs |
|---|---|---|
| Paraphrase invariance | Reword the question | The same facts in both answers |
| Irrelevant additions | Add an unrelated sentence | The same answer |
| Order of documents | Shuffle the retrieved documents | The same answer |
| Negation | Negate a key fact in the context | The answer changes accordingly |
| Language | Translate the question | An equivalent answer in the new language |
| Counterfactual fairness | Change a name, gender or region | Equivalent quality and tone |

The comparison of the two outputs is again done by code (the same facts, the same tool calls) or by a judge that sees both answers ([Why LLM testing is different](/learn/llm?topic=llm-testing-problem-space) introduced property oracles of this kind).

## Example project

The methods of this chapter are implemented and tested in [examples/llm-testing/10-llm-judge](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/10-llm-judge): a versioned judge prompt with validated structured verdicts, a fake judge with configurable leniency and position and verbosity bias, a validation report with TPR, TNR, kappa and their intervals on development and test labels, the corrected pass rate with a bootstrap interval checked by simulation, the position-bias and verbosity probes, and a pairwise win rate from both orders. An optional live check runs the same judge on a real model. All other tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/10-llm-judge
```

## Common mistakes

- **Trusting a judge that was never compared with human labels.**
- **Reporting accuracy instead of TPR and TNR,** which hides a judge that misses most failures.
- **Measuring the judge on the labels used to tune its prompt.**
- **One judge for several criteria** with a vague definition such as "helpful and correct".
- **A judge without the source** asked whether an answer is faithful to it.
- **Pairwise comparisons in one order only.**
- **Changing the judge prompt or model without re-validating,** and comparing results across judge versions.
- **Reporting a judged pass rate without correcting it,** or at least stating the judge's TPR and TNR.

## Summary

- A judge evaluates what code cannot check; use code first, a judge for criteria that need reading, and people to define criteria and validate judges.
- Prefer one binary pointwise judge per criterion, with failures defined precisely, examples from development labels, the evidence the criterion needs, critique before verdict, and structured output.
- Validate on held-out human labels with TPR, TNR and kappa; TNR shows how many real failures the judge catches.
- Correct judged pass rates for judge errors with the Rogan–Gladen estimator and a bootstrap interval; label more failures to narrow it.
- Measure position, verbosity and self-preference biases directly, and judge pairs in both orders.
- Version and re-validate judges, re-label fresh samples regularly, and judge only what code cannot decide.
- When there is neither a reference nor a judge, metamorphic relations still test how outputs must relate.
