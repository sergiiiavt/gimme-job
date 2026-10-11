# Why LLM testing is different

Testing software that uses a large language model (LLM) breaks several assumptions that classic test design relies on. The same input can produce different outputs. A wrong answer looks as fluent and confident as a right one. The expected result is often not a single value but a space of acceptable answers. And the behaviour can change without any change to your code, because the model, the prompt, the retrieved data or the provider's infrastructure changed.

This chapter defines the problem precisely. It introduces the vocabulary, the kinds of test oracles that work for generative output, the quality characteristics you will measure, and the lifecycle in which LLM testing happens. Every later chapter builds on these definitions.

**Prerequisites:** basic software-testing concepts (test basis, test oracle, test levels) from [QA fundamentals](/reference/qa-fundamentals), and enough Python to read short scripts.

## What we mean by an LLM system

A **large language model** is a neural network trained to predict the next token of text. In this course "the model" always means that component: a set of weights served behind an API, either by a provider or by your own infrastructure.

An **LLM system** (or LLM application) is the software built around one or more model calls. It includes prompts, context assembly, retrieval, tools, output parsing, guardrails, user interface, logging and the data the system reads. An **LLM feature** is one user-facing capability of that system, for example "answer questions about the return policy".

```diagram
User and business outcome        (did the customer get a correct, safe answer?)
          ▲
Product feature                  (support assistant answers refund questions)
          ▲
LLM application                  (prompt templates, retrieval, tools, parsing, guardrails, UI)
          ▲
Model                            (weights, decoding, provider-side system behaviour)
          ▲
Training data and training process
```

Each layer has its own testers and its own questions:

| Layer | Typical question | Who usually answers it | Typical evidence |
|---|---|---|---|
| Model | How capable is this model at reasoning, coding or a language? | Model provider, research teams | Public benchmarks, model cards, red-team reports |
| Application | Does our prompt, retrieval and parsing produce correct output for our inputs? | Product engineering and QA | Evaluation datasets, scorers, unit and integration tests |
| Feature | Does the feature meet its acceptance criteria and risk limits? | QA, product owner | Acceptance criteria with thresholds, regression results |
| Outcome | Are users actually helped, and is anyone harmed? | Product, analytics, QA | Production monitoring, feedback, incident data |

Most testers work on the application and feature layers. You rarely control model weights, but you control almost everything else: which model and version you call, the prompts, the data you retrieve, the tools you expose, how you validate output and how you monitor production. That is where most defects live and where this course focuses.

## How LLM features differ from conventional features

The table compares a conventional feature, such as a price calculator, with an LLM feature, such as an assistant that answers price questions in natural language.

| Dimension | Conventional feature | LLM feature |
|---|---|---|
| Specification | Precise rules: "discount is 10% above 100 EUR" | Open-ended intent: "answer helpfully and correctly" |
| Output space | Small and structured: a number | Practically infinite: any text |
| Determinism | Same input, same output | Same input can give different outputs |
| Typical failure | Exception, wrong number, crash | Plausible, fluent, wrong or unsafe answer |
| What can change behaviour | Code and configuration | Code, prompt, model version, retrieved data, tools, provider infrastructure |
| Input coverage | Equivalence partitions of a small input space | Semantic space of all ways users phrase things |
| Cost of a test run | Usually negligible | Real money and seconds per call |

Three consequences follow, and they shape the rest of the course:

- **Exact expected values rarely work.** You need other kinds of oracles (next section).
- **One run is a sample, not a verdict.** You must run cases repeatedly and reason about rates (see [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)).
- **Behaviour can drift with no code change.** You must pin and record versions and keep testing in production (see [Production quality](/learn/llm?topic=production-quality)).

## The test oracle problem

A **test oracle** is the source you use to decide whether an observed result is correct. In a classic test the oracle is usually an expected value written in the test: `assert total == 90.0`.

For generative output this breaks down. Ask a model to summarize a two-page support ticket and there are thousands of correct summaries. There is no single string to compare against, and a summary can be partly right: four correct facts and one invented one. This is the *oracle problem*, long known in software testing research for programs whose correct output is hard to compute, and it is the central problem of LLM testing.

LLM testing replaces the single expected value with a combination of weaker oracles. Each one checks part of the correctness, and together they give useful confidence.

| Oracle type | What it checks | Example | Strength | Weakness |
|---|---|---|---|---|
| Property (specified constraint) | Rules every correct output must satisfy | Output is valid JSON; mentions the order ID; under 80 words | Cheap, deterministic, precise | Only partial: a valid output can still be wrong |
| Reference-based | Closeness to a known good answer or its facts | Answer contains the fact "30-day return window" | Works well for factual tasks | Needs labelled references; wording varies |
| Model-based (LLM-as-a-judge) | A second model grades against a rubric | "Is every claim supported by the policy text? PASS or FAIL" | Scales semantic judgement | The judge is itself a model and must be validated |
| Human judgement | Experts label outputs | Support lead marks answers acceptable or not | Ground truth for subjective criteria | Slow, expensive, can be inconsistent |
| Metamorphic relation | How outputs must relate across changed inputs | A paraphrased question must yield the same facts | No need to know the right answer | Detects inconsistency, not correctness |
| Differential (comparative) | Output compared with another version | New prompt vs current prompt, judged pairwise | Directly answers "is it better?" | Says nothing about absolute quality |

### Worked example: property oracles for one answer

Suppose the requirement is: *"Answers about returns must state the 30-day return window, must not promise more than the policy allows, must stay under 80 words and must link to the returns page."* Each clause becomes a property check. None of them proves that an answer is good, but each one catches a class of bad answers cheaply.

```python
import re

RETURN_WINDOW_DAYS = 30
MAX_WORDS = 80


def check_refund_answer(answer: str) -> list[str]:
    """Return the properties this answer violates. An empty list means every check passed."""
    violations = []
    text = answer.lower()
    if f"{RETURN_WINDOW_DAYS} days" not in text and f"{RETURN_WINDOW_DAYS}-day" not in text:
        violations.append("does not state the 30-day return window")
    if re.search(r"\b(guarantee[sd]?|always|no questions asked)\b", text):
        violations.append("promises more than the policy allows")
    if len(answer.split()) > MAX_WORDS:
        violations.append(f"longer than {MAX_WORDS} words")
    if "stride.example/returns" not in text:
        violations.append("does not link to the returns page")
    return violations


candidates = [
    "You can return unworn shoes within 30 days of delivery for a full refund. "
    "Start a return at https://stride.example/returns.",
    "Of course! Refunds are guaranteed for every purchase, no questions asked.",
    "Our return policy gives you a 30-day window. " + "We value every customer. " * 20
    + "Details: https://stride.example/returns",
]

for number, answer in enumerate(candidates, start=1):
    problems = check_refund_answer(answer)
    verdict = "PASS" if not problems else "FAIL: " + "; ".join(problems)
    print(f"answer {number}: {verdict}")
```

Output:

```text
answer 1: PASS
answer 2: FAIL: does not state the 30-day return window; promises more than the policy allows; does not link to the returns page
answer 3: FAIL: longer than 80 words
```

Notice what the checks cannot do. An answer that says "within 30 days of *purchase*" when the policy says "of *delivery*" passes all four checks and is still wrong. Catching that needs a reference-based or model-based oracle that compares the answer with the policy text. Real evaluation suites layer several oracle types for exactly this reason.

## Sources of variability

When an LLM feature gives a different result today than yesterday, one of these sources is responsible:

| Source | Mechanism | Test design consequence |
|---|---|---|
| Sampling | The model samples tokens from a probability distribution; with temperature above 0 different runs pick different tokens | Run each case several times and measure rates |
| Inference non-determinism | Even with temperature 0, GPU arithmetic, batching and hardware differences can change results | Never assume a fixed output, even for "deterministic" settings |
| Model version | The provider releases a new snapshot, or an alias such as "latest" moves | Pin exact model versions; re-run the suite before switching |
| Prompt and configuration | Someone edits a prompt, a parameter or a tool description | Version prompts like code and evaluate every change |
| Retrieved context | The document index changes, so retrieval returns different chunks | Record retrieved IDs in traces; freeze context for regression tests |
| Tools and external data | APIs return different data over time | Use fakes and recorded responses in tests |
| Conversation state | Earlier turns, memory or user profile change the context | Test multi-turn scenarios and state boundaries explicitly |

Model drift is not hypothetical. A widely cited 2023 study measured the same API model versions three months apart and found large changes in behaviour on several tasks ([Chen, Zaharia and Zou](https://arxiv.org/abs/2307.09009)). Providers now offer pinned snapshots precisely so that you can control when a change reaches you.

### Diagnosing a change with no deployment

When an answer changes although nobody deployed code, compare the traces of a good run and a bad run field by field:

| Evidence in the traces | What a difference means |
|---|---|
| Same input, answers alternate on re-runs | Sampling variability: measure the rate instead of judging one run |
| Different model version or serving fingerprint | Provider update or a moved model alias |
| Different retrieved chunk IDs | The document index changed |
| Different prompt version | A prompt was changed outside the code release, for example in a prompt-management tool |
| Different conversation history or user profile | State-dependent behaviour |
| Different tool results | An external system returned other data |

Every row needs traces that record versions and context, which is why [Production quality](/learn/llm?topic=production-quality) treats tracing as a testing prerequisite.

### Why one passing run is weak evidence

If a feature is correct with probability `p` on each independent run, the probability that `k` manual tries all look correct is `p` to the power `k`. The script below shows how easily a flawed feature survives a quick manual check, and how the observed pass rate only settles near the true rate after many runs.

```python
import random

# Probability that k independent manual tries all look correct
for p_correct in [0.95, 0.9, 0.7]:
    for tries in [3, 5]:
        print(f"feature correct {p_correct:.0%} of the time -> {tries} tries all pass with probability {p_correct ** tries:.2f}")

# Estimating the real rate from repeated runs of a feature that is correct 90% of the time
rng = random.Random(42)
true_rate = 0.9
for runs in [10, 100, 1000, 10000]:
    passed = sum(rng.random() < true_rate for _ in range(runs))
    print(f"{runs:>5} runs: observed pass rate {passed / runs:.3f}")
```

Output:

```text
feature correct 95% of the time -> 3 tries all pass with probability 0.86
feature correct 95% of the time -> 5 tries all pass with probability 0.77
feature correct 90% of the time -> 3 tries all pass with probability 0.73
feature correct 90% of the time -> 5 tries all pass with probability 0.59
feature correct 70% of the time -> 3 tries all pass with probability 0.34
feature correct 70% of the time -> 5 tries all pass with probability 0.17
   10 runs: observed pass rate 1.000
  100 runs: observed pass rate 0.900
 1000 runs: observed pass rate 0.894
10000 runs: observed pass rate 0.904
```

A feature that fails one time in ten passes five manual tries more often than not, and in this simulation even ten runs showed a perfect score. Quality claims about LLM features are statements about rates, and rates need samples. The next subsection shows how many runs such claims need.

### How many runs reveal a rare failure?

The same arithmetic answers a planning question: how many independent runs are needed to see a failure at least once? If a feature fails with probability `q` per run, the chance of seeing no failure in `n` runs is `(1 − q)^n`. Requiring at least a 95% chance of seeing a failure gives `n ≥ log(0.05) / log(1 − q)`.

```python
import math

# How many independent runs are needed to see at least one failure with 95% probability,
# if the feature fails with probability q on each run?  Solve 1 - (1 - q) ** n >= 0.95.
for q in [0.2, 0.05, 0.01]:
    n = math.ceil(math.log(0.05) / math.log(1 - q))
    print(f"failure rate {q:.0%}: need {n} runs")

p_correct = 0.8
print(f"80%-correct feature passes 4 manual checks with probability {p_correct ** 4:.2f}")
```

Output:

```text
failure rate 20%: need 14 runs
failure rate 5%: need 59 runs
failure rate 1%: need 299 runs
80%-correct feature passes 4 manual checks with probability 0.41
```

Rare failures need many runs to appear even once. This is why evaluation datasets have hundreds of cases and why production monitoring is necessary.

## Quality characteristics of LLM features

To test something you first have to say what "good" means. The characteristics below are the ones you will measure throughout this course. They extend the classic software quality model of ISO/IEC 25010; ISO/IEC 25059 adapts that model to AI systems.

| Characteristic | Question it answers | Example failure | Typical evidence |
|---|---|---|---|
| Task success (correctness) | Did the output accomplish the task correctly? | Wrong refund amount computed | Reference checks, judges, human labels |
| Faithfulness (groundedness) | Is every claim supported by the provided sources? | Answer cites a policy clause that does not exist | Claim-level judge against retrieved context |
| Relevance | Does the output address what was asked? | Correct facts about shipping when the user asked about returns | Relevance judge, human review |
| Completeness | Is everything required present? | Omits the exception for discounted items | Checklist of expected facts |
| Format compliance | Does output follow the required structure? | JSON with a missing field | Schema validation |
| Consistency and robustness | Is behaviour stable across paraphrases, typos and noise? | Different answers to two phrasings of one question | Metamorphic tests, repeated runs |
| Safety | Does the system avoid harmful content and actions? | Gives dangerous instructions | Safety classifiers, red-team datasets |
| Security | Does it resist manipulation and protect data? | Follows instructions hidden in a retrieved web page | Prompt-injection tests, leakage tests |
| Fairness | Is quality equal across user groups? | Lower-quality answers for non-English names | Counterfactual tests by group |
| Privacy | Is personal data handled correctly? | Reveals another customer's address | Leakage tests, PII scanners |
| Latency | Is it fast enough for the use case? | 12 seconds to first token in a chat | Time to first token, p95 latency |
| Cost | Is it affordable at expected volume? | Prompt grows to 9,000 tokens per request | Token accounting per request and per task |

Not every feature needs every characteristic. A code-review assistant used by engineers may tolerate 10 seconds of latency but not invented APIs. A public chat widget must be fast and safe first.

## From a vague requirement to testable criteria

Requirements for LLM features usually arrive vague: *"The assistant should give helpful answers about refunds."* This cannot be tested as written. The process below turns it into criteria that can.

```diagram
1. Users and tasks      Who asks what, in which language, with what goal?
        ↓
2. Risks                What happens if the answer is wrong, unsafe, slow or leaks data?
        ↓
3. Characteristics      Which quality characteristics matter for these risks?
        ↓
4. Criteria             Measurable statement + measurement method + threshold + priority
        ↓
5. Evidence plan        Which data, scorers and reviews will produce the measurements?
```

### Worked example: the refund assistant

*Step 1, users and tasks.* Customers of the fictional shoe store **Stride** ask about returns and refunds in English and Ukrainian. They want to know whether they can return an item, by when, and how.

*Step 2, risks.* A wrong "yes" creates a promise the company must honour or a customer conflict. A wrong "no" loses a sale. Answers that reveal another customer's order are a privacy incident. Slow answers make people abandon the chat.

*Step 3, characteristics.* Faithfulness to the policy, correct abstention when the policy does not cover a case, format, language, privacy and latency.

*Step 4, criteria.*

| ID | Criterion | Measurement | Threshold | Priority |
|---|---|---|---|---|
| R1 | Every policy statement is supported by the current policy document | Faithfulness judge validated against 100 human labels | At least 97% of evaluation cases pass | Critical |
| R2 | When the policy does not cover the question, the assistant says it cannot confirm and offers a human agent | Abstention check on 40 out-of-policy questions | At least 95% | High |
| R3 | Answer is at most 120 words and links to the returns page | Deterministic checks | 100% | Medium |
| R4 | Answer language matches the question language | Script-based language check | At least 99% | High |
| R5 | No answer contains another customer's personal data | Leakage test set with planted data | 0 failures | Critical |
| R6 | Time to first token | Load test at expected peak | p95 under 1.5 s | High |

*Step 5, evidence plan.* An evaluation dataset of real (anonymized) and synthetic questions, a validated judge for R1, deterministic scorers for R3 and R4, a leakage test set for R5, and a load test for R6. Later chapters show how to build each one.

Each criterion names *what* is measured, *how* it is measured, *what result is acceptable* and *how much it matters*. That is the minimum for a criterion to be testable.

## Where testing happens in the lifecycle

LLM testing is not one phase. It happens at every stage, and production feeds back into development.

```diagram
 design ──► build ──► offline evaluation ──► pre-release ──► release ──► production
   │          │              │                    │             │            │
 criteria   unit tests,   datasets, scorers,   red teaming,   canary,     tracing, online
 and risks  fake models,  judges, regression   performance,   shadow      evaluation,
            prompt review baselines            release gate   traffic     feedback, alerts
   ▲                                                                         │
   └────────────── new failure cases become evaluation dataset cases ◄───────┘
```

| Stage | Main activities | Chapter |
|---|---|---|
| Design | Quality criteria, risk analysis, evaluation plan | This chapter, [Benchmarks, human evaluation and governance](/learn/llm?topic=pro-practice) |
| Build | Unit tests with fake models, prompt and schema reviews | [Testing LLM code without the model](/learn/llm?topic=testing-without-the-model) |
| Offline evaluation | Datasets, scorers, judges, statistics | [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals) and the chapters after it |
| Pre-release | Security testing, performance tests, release gates | [Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming), [Production quality](/learn/llm?topic=production-quality) |
| Release | Canary and shadow deployments, model migrations | [Production quality](/learn/llm?topic=production-quality) |
| Production | Tracing, online evaluation, feedback loops | [Production quality](/learn/llm?topic=production-quality) |

## Core vocabulary

Terms are used inconsistently across tools and papers. This course uses them as defined here.

| Term | Meaning in this course |
|---|---|
| Evaluation (eval) | A repeatable measurement of quality: a dataset, a way to run the system on it, scorers and a decision rule |
| Case (sample) | One input to evaluate, with optional reference answer, metadata and tags |
| Dataset | A versioned collection of cases; a "golden dataset" is a curated, trusted one |
| Scorer (grader) | Code, a model or a person that assigns a score or verdict to one output |
| Metric | An aggregate of scores over a dataset, for example pass rate or mean faithfulness |
| Judge | A model used as a scorer (LLM-as-a-judge) |
| Rubric | Written criteria a judge or human applies |
| Reference answer | A known good answer, or the facts it must contain |
| Baseline | The results of the current production version, used for comparison |
| Regression | A statistically and practically meaningful drop compared with the baseline |
| Trace / span | A record of one request and of each step inside it (model call, retrieval, tool call) |
| Hallucination (confabulation) | Output that is fluent but not supported by facts or sources |
| Grounding | Basing output on provided sources, verifiable by citation |
| Guardrail | A control around the model that blocks or modifies inputs or outputs |
| Red teaming | Adversarial testing that tries to make the system fail in harmful ways |
| Prompt injection | Input that makes the model follow attacker instructions instead of the developer's |
| Benchmark | A public, standardized evaluation used to compare models |
| pass@k / pass^k | Probability that at least one of k attempts passes / that all k attempts pass |

## How this course is organized

The course follows the order in which you need the knowledge. One running example appears throughout: the support assistant of the fictional store **Stride**, which answers questions from a policy knowledge base and can look up orders. Several chapters also use the real GimmeJob Learning Path Advisor (in the `ai-service` directory of this repository) as a case study.

| Part | Chapters | Outcome |
|---|---|---|
| Foundations | Why LLM testing is different; How LLMs generate text; Embeddings and similarity | You understand how models produce text and how similarity is measured |
| Building LLM applications | LLM application anatomy and APIs; Prompts as testable artifacts; Structured output and validation; Testing LLM code without the model | You can build and unit-test the system you will evaluate |
| Evaluation | Evaluation methodology and datasets; LLM-as-a-judge | You can design datasets, scorers and judges and compare versions soundly |
| RAG and agents | Evaluating RAG systems; Evaluating agents and tool use | You can evaluate retrieval pipelines and multi-step agents |
| Security and production | Security, red teaming and guardrails; Production quality | You can attack and harden an LLM system and run evaluation in CI and production |
| Professional practice | Benchmarks, human evaluation and governance | You can select models, run human evaluation and produce governance evidence |

**Setup for the hands-on parts:** Python 3.11 or newer, a virtual environment, and access to at least one model. A paid API key from any major provider works. To practise without cost, run an open-weight model locally with [Ollama](https://ollama.com/), which exposes an OpenAI-compatible endpoint. Many code examples in this course are self-contained and run directly in the page with the **Run** button; examples that call real models or install packages are meant for your own machine. Many chapters also come with a complete example project with tests in [examples/llm-testing](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing).

## Example project

The method of this chapter is implemented and tested in [examples/llm-testing/01-property-oracles](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/01-property-oracles): property oracles for the refund assistant, a test that documents what they cannot detect, and the run-count arithmetic. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/01-property-oracles
```

## Common mistakes

- **Treating a demo as a test.** A few good-looking answers prove little; see the probabilities above.
- **Testing only the model.** Most failures come from prompts, retrieval, parsing and tools, which you control.
- **Using exact-match oracles for free text.** They fail on correct paraphrases and teach the team to ignore failures.
- **Choosing metrics before looking at outputs.** Generic metrics often measure nothing that matters for the product. Start with error analysis (see [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)).
- **Not recording versions.** A result without the model version, prompt version and parameters cannot be reproduced or compared.
- **Ignoring latency and cost.** A correct answer that arrives too late or costs too much is a failed requirement.

## Summary

- An LLM system is much more than the model. Testers mostly work on the application and feature layers, where prompts, retrieval, tools and validation create most defects.
- Generative output has no single expected value. LLM testing combines property, reference-based, model-based, human, metamorphic and differential oracles.
- Output varies because of sampling, inference non-determinism, model versions, prompts, retrieved context, tools and conversation state. Quality claims are claims about rates.
- Quality must be decomposed into characteristics such as faithfulness, relevance, safety, latency and cost, and then into criteria with a measurement method, threshold and priority.
- Testing happens across the whole lifecycle, and production failures must flow back into evaluation datasets.
