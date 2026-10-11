# Benchmarks, human evaluation and governance

At the professional level, the job changes from writing evaluations to owning how an organization decides whether an AI product is good enough. That decision draws on evidence from outside (public benchmarks and model documentation) and from inside: the organization's own benchmarks, human judgements and test results. It also has to satisfy people who are not engineers: managers who sign off a release, customers who ask how the system was tested, and regulators who require documented risk management.

This chapter covers that layer:
- reading public benchmarks and detecting contamination;
- choosing a model;
- building a custom benchmark and checking its items;
- running human evaluation with reliable agreement and preference rankings;
- testing beyond text;
- producing governance evidence;
- designing an evaluation platform;
- leading a quality strategy.

**Prerequisites:** [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals), [Statistics for evaluation](/learn/llm?topic=eval-statistics), [LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation), [Production quality](/learn/llm?topic=production-quality).

## From risks to decisions

```diagram
risks and requirements ──▶ evaluation plan ──▶ evidence ──▶ decision ──▶ record
(what can go wrong,        (benchmarks,        (results     (ship, block,  (for audits,
 for whom, how badly)       human evaluation,   with         conditions)    incidents and
                            tests, gates)       versions)                   the next release)
```

Every activity in this chapter feeds this chain. A public benchmark narrows the list of candidate models, but your own evaluation decides between them. Human judgement is the reference that judges and benchmarks are validated against. A governance framework does not replace any of this. It asks you to show that the chain exists, that it covers the important risks, and that the evidence is current.

## Reading public benchmarks

Public benchmarks measure what a model can do in general. They are useful for building a shortlist and dangerous as the only basis for a decision.

| Family | Examples | What to watch for |
|---|---|---|
| Knowledge and reasoning | MMLU, MMLU-Pro, GPQA | Multiple choice rewards elimination and guessing; known errors in the answer keys |
| Code | HumanEval, SWE-bench | Short functions versus real repositories; contamination of public code |
| Agents and tool use | SWE-bench, τ-bench, WebArena | The harness and tools matter as much as the model ([Evaluating agents and tool use](/learn/llm?topic=agent-testing)) |
| Holistic suites | HELM | Many scenarios and metrics, which shows trade-offs instead of one number |
| Human preference | Chatbot Arena | Votes of anonymous visitors on their own prompts; answer length and formatting move the ranking |
| Fresh questions | LiveBench | Questions from recent sources that limit contamination |

Before trusting a leaderboard difference, check five things:
- **Setup:** prompt format, number of examples in the prompt, reasoning settings, answer extraction and sampling. The same model can move several points when only the setup changes. Harnesses such as lm-evaluation-harness, HELM and Inspect make setups explicit and repeatable.
- **Size and noise:** a benchmark is a sample of questions, and the statistics of [Statistics for evaluation](/learn/llm?topic=eval-statistics) apply to it.
- **Who ran it:** numbers reported by the model's provider, with their own setup, often differ from independent runs.
- **Date:** questions that were public before the model's training cutoff may be in its training data.
- **Saturation:** when the best models all score near the top, the benchmark no longer separates them.

The noise is easy to estimate:

```text
half-width of a 95% interval ≈ 1.96 × sqrt(p × (1 − p) / n)

GPQA Diamond, 198 questions, p = 0.5      ≈ ±7.0 points
MMLU, about 14,000 test questions, p = 0.85 ≈ ±0.6 points
```

On a 198-question benchmark, a two-point lead is noise. Two models evaluated on the same questions can be compared more precisely with a paired analysis, but only if the per-question results are published.

## Contamination

A benchmark is **contaminated** for a model when its questions, or close copies of them, were in the model's training data. The model then partly recalls instead of solving, and its score overstates the skill. Nobody outside the provider can inspect the training data of a commercial model. Contamination is therefore measured indirectly:

| Method | Idea | Example |
|---|---|---|
| N-gram overlap | Look for long word sequences of the test items in a corpus that may have been used for training | The GPT-3 paper flagged items sharing a 13-word sequence with its training data |
| Fresh copies | Write new questions of the same style and difficulty; a contaminated model does worse on them | GSM1k found accuracy drops of up to 8% against GSM8k, with whole model families affected |
| Canary strings | Embed a unique marker in every benchmark file so that training pipelines can filter the files out; a model that reproduces the marker has seen them | Every BIG-bench task file contains a canary string |
| Time splits | Use only questions published after the training cutoff | LiveBench updates its questions regularly |
| Private hold-out | Never publish the test questions | Your own benchmark, kept out of public repositories |

The first two methods are easy to run on your own data:

```python
import math
import re


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def ngrams(tokens: list[str], n: int) -> set[tuple[str, ...]]:
    return {tuple(tokens[start:start + n]) for start in range(len(tokens) - n + 1)}


def contains(haystack: list[str], needle: list[str]) -> bool:
    return any(haystack[start:start + len(needle)] == needle for start in range(len(haystack) - len(needle) + 1))


# A forum page from a web crawl that may have ended up in a training set
crawl = words("""Homework help please! A train leaves the station at 9 am travelling at 60 km per hour and a second
train leaves the same station at 10 am travelling at 90 km per hour on the same track. At what time does the second
train catch up with the first one? I got 11 am but the key says noon. Also, what is the capital of Australia?""")

items = {
    "q1 copied": "A train leaves the station at 9 am travelling at 60 km per hour and a second train leaves the same "
                 "station at 10 am travelling at 90 km per hour on the same track. At what time does the second train "
                 "catch up with the first one?",
    "q2 reworded": "The first train leaves at 9 am. A second train leaves the same station at 10 am travelling at 90 km "
                   "per hour on the same track. When are the two trains level?",
    "q3 new": "A delivery van leaves the depot at 8 am at 50 km per hour, and a courier follows at 8:30 am at 75 km "
              "per hour. When does the courier reach the van?",
    "q4 short": "What is the capital of Australia?",
}
N = 13  # the GPT-3 paper flagged test items sharing a 13-gram with the training data
crawl_grams = ngrams(crawl, N)
for name, question in items.items():
    tokens = words(question)
    if len(tokens) < N:
        verdict = "found verbatim" if contains(crawl, tokens) else "not found"
        print(f"{name:<12} {len(tokens):>2} words, shorter than {N}: {verdict}")
        continue
    grams = ngrams(tokens, N)
    shared = len(grams & crawl_grams)
    verdict = "copied" if shared == len(grams) else "partly copied" if shared else "clean"
    print(f"{name:<12} {shared:>2} of {len(grams):>2} 13-grams in the crawl: {verdict}")

# The same 200 questions with new numbers and wording: a model that learned the skill should not care
only_original, only_reworded = 31, 7
discordant = only_original + only_reworded
tail = sum(math.comb(discordant, k) for k in range(min(only_original, only_reworded) + 1)) / 2 ** discordant
print(f"rewording: {only_original} items pass only in the original wording, {only_reworded} only reworded, "
      f"exact p = {min(1.0, 2 * tail):.4f}")
```

Output:

```text
q1 copied    36 of 36 13-grams in the crawl: copied
q2 reworded   8 of 21 13-grams in the crawl: partly copied
q3 new        0 of 22 13-grams in the crawl: clean
q4 short      6 words, shorter than 13: found verbatim
rewording: 31 items pass only in the original wording, 7 only reworded, exact p = 0.0001
```

The copied question shares every 13-gram with the forum page. The reworded one still shares eight, so it is not clean either. The short question is too short for 13-grams and is checked as a whole. The rewording test asks a different question: does the model's score depend on the exact wording? If the skill were real, items would pass or fail about equally often in both versions. Here 31 to 7 is very unlikely to be chance, which is the pattern that GSM1k measured at scale. The same checks protect your own benchmark: keep it private, and check that its items do not appear in public data.

## Choosing a model

A model choice is a release decision with more candidates. A practical process:

1. **Write the requirements first:** a quality floor, latency and cost limits, context length, languages, data handling (where data is processed, whether it is used for training) and the expected support period.
2. **Shortlist with public information:** benchmarks for the relevant skills, model documentation and prices. Drop candidates that fail a hard requirement.
3. **Decide with your own evaluation:** the same cases for every candidate, paired comparisons with intervals ([Statistics for evaluation](/learn/llm?topic=eval-statistics)), and the slices that matter.
4. **Look at the trade-offs together:** a candidate is dominated when another one is at least as good on quality, cost and latency and better on one of them. Only the non-dominated candidates (the Pareto front) are real options, and the choice between them is a product decision.
5. **Pilot before switching:** shadow traffic and a canary release, as in [Production quality](/learn/llm?topic=production-quality).
6. **Plan the next migration:** models are retired on published schedules, so the evaluation suite has to be ready to run again.

Agree a quality margin before the comparison, as for any release gate. A candidate whose paired difference to the best one stays above minus the margin is as good for the decision, even if its point estimate is lower. Among those candidates, cost and latency decide.

## Building a custom benchmark

When public benchmarks do not measure your domain, build a benchmark of your own, for example for the quality of generated test cases or for answers about your insurance products.

1. **Define the capability** and what is out of scope.
2. **Collect tasks from real work,** with reference answers or grading rubrics written by experts.
3. **Review the references:** two experts answer independently, and you measure their agreement. Items they disagree on get fixed or dropped.
4. **Cover difficulty levels,** so that the benchmark does not saturate with the next model generation.
5. **Analyse the items** after the first runs.
6. **Keep a private hold-out set** and a canary string, and document the benchmark (datasheet, known limitations).
7. **Version it** and plan refreshes.

Item analysis comes from educational testing. For each item it measures **difficulty**, the share of models (or runs) that solve it. It also measures **discrimination**: the correlation between solving the item and the score on all other items. A good item is solved by stronger systems more often than by weaker ones.

```python
from statistics import correlation, fmean

# One row per model, strongest first; one column per item of a custom benchmark (1 = correct)
results = {
    "model-a": "1 1 1 1 0 0 1 1 1 1 1 1",
    "model-b": "1 1 1 1 0 0 1 1 1 0 1 1",
    "model-c": "1 1 1 0 0 0 1 1 0 1 1 0",
    "model-d": "1 1 1 1 0 1 1 0 1 0 0 1",
    "model-e": "1 1 0 0 0 1 1 1 0 0 1 0",
    "model-f": "1 1 0 1 0 1 1 0 0 0 0 0",
    "model-g": "1 1 0 0 0 1 0 0 0 1 0 0",
    "model-h": "1 1 0 0 0 1 0 0 0 0 0 0",
}
rows = [[int(cell) for cell in row.split()] for row in results.values()]

print(f"{'item':<5} {'solved':>7} {'discrimination':>14}  verdict")
for item in range(len(rows[0])):
    scores = [row[item] for row in rows]
    rest = [sum(row) - row[item] for row in rows]  # each model's score on all the other items
    solved = fmean(scores)
    if solved in {0.0, 1.0}:
        discrimination, verdict = None, "nobody solves it: too hard or broken" if solved == 0 else "everyone solves it: no information"
    else:
        discrimination = correlation(scores, rest)
        if discrimination < -0.2:
            verdict = "stronger models fail more often: check the reference answer"
        elif discrimination < 0.2:
            verdict = "weak: hardly separates the models"
        else:
            verdict = "ok"
    shown = "-" if discrimination is None else f"{discrimination:+.2f}"
    print(f"{item + 1:<5} {solved:>7.0%} {shown:>14}  {verdict}")
```

Output:

```text
item   solved discrimination  verdict
1        100%              -  everyone solves it: no information
2        100%              -  everyone solves it: no information
3         50%          +0.80  ok
4         50%          +0.50  ok
5          0%              -  nobody solves it: too hard or broken
6         62%          -0.81  stronger models fail more often: check the reference answer
7         75%          +0.65  ok
8         50%          +0.50  ok
9         38%          +0.76  ok
10        38%          -0.04  weak: hardly separates the models
11        50%          +0.50  ok
12        38%          +0.76  ok
```

Items 1 and 2 cost money and tell nothing. Item 5 is either beyond every model or broken. Item 6 is the important finding: the stronger models fail it and the weaker ones pass. The usual reason is a wrong reference answer, so the strong models are "wrong" for giving the correct answer. Public benchmarks have the same problem: a re-annotation of MMLU estimated that about 6.5% of its questions contain errors, and in one subject more than half. Methods based on item response theory go further. They estimate item difficulty and discrimination together with model ability, find saturated datasets, and select small subsets that predict the full score.

## Human evaluation programs

People are the reference for criteria that code cannot check and judges cannot be trusted with: helpfulness, tone, safety in edge cases, and expert correctness. Human labels are also what an LLM judge is validated against ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)). Running human evaluation well is a process:

| Element | Practice |
|---|---|
| Question format | Pass or fail against a rubric for defects; pairwise preference for "which is better"; avoid 1–10 scales without anchors |
| Guidelines | Definitions, examples and borderline cases for every label, versioned like code |
| Calibration | Annotators label the same items, discuss the disagreements and update the guidelines |
| Quality control | Gold items with known answers mixed into the work; agreement tracked per annotator and over time |
| Bias control | Hide which system produced an answer, randomize the order of answers, show the full conversation |
| Sample size | Enough items for the intervals you need ([Statistics for evaluation](/learn/llm?topic=eval-statistics)) |
| Ethics | Fair pay, warnings and limits for harmful content, no personal data without a legal basis |

**Agreement with several annotators.** Cohen's kappa compares two annotators ([Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals)). Krippendorff's alpha generalizes it to any number of annotators and to missing labels, and it can also handle ordinal and interval scales. It compares the disagreement observed within each item with the disagreement expected by chance:

```python
from collections import Counter
from itertools import combinations, permutations

# Three annotators label the same 13 answers; None means the annotator skipped the answer
labels = {
    "ann": ["good", "good", "bad", "unsafe", "good", "bad", None, "good", "bad", "good", "unsafe", "good", "unsafe"],
    "ben": ["good", "bad", "bad", "unsafe", "good", "bad", "bad", "good", "bad", "good", "unsafe", None, "unsafe"],
    "cho": ["good", "good", "bad", "bad", "good", "bad", "bad", None, "bad", "good", "bad", "good", "bad"],
}


def alpha_nominal(columns: list[list[str | None]]) -> float:
    """Krippendorff's alpha for nominal labels: any number of annotators, missing labels allowed."""
    coincidences: Counter = Counter()
    for unit in zip(*columns):
        values = [value for value in unit if value is not None]
        if len(values) < 2:
            continue  # an answer labelled once tells nothing about agreement
        for pair in permutations(values, 2):
            coincidences[pair] += 1 / (len(values) - 1)
    totals: Counter = Counter()
    for pair, weight in coincidences.items():
        totals[pair[0]] += weight
    n = sum(totals.values())
    observed = sum(weight for pair, weight in coincidences.items() if pair[0] != pair[1]) / n
    expected = sum(totals[a] * totals[b] for a in totals for b in totals if a != b) / (n * (n - 1))
    return 1 - observed / expected


def reading(alpha: float) -> str:
    if alpha >= 0.8:
        return "reliable"
    return "tentative conclusions only" if alpha >= 0.667 else "do not use the labels yet"


groups = [tuple(labels)] + list(combinations(labels, 2))
for group in groups:
    alpha = alpha_nominal([labels[name] for name in group])
    print(f"{' + '.join(group):<16} alpha {alpha:5.2f}  {reading(alpha)}")

# Where the reliable pair agrees, what does the third annotator say instead?
confusions = Counter((a, c) for a, b, c in zip(*labels.values()) if a is not None and a == b and c is not None and c != a)
print("where ann and ben agree, cho says:", ", ".join(f"{pair[1]} for {pair[0]} ({count}x)" for pair, count in confusions.items()))
```

Output:

```text
ann + ben + cho  alpha  0.65  do not use the labels yet
ann + ben        alpha  0.87  reliable
ann + cho        alpha  0.57  do not use the labels yet
ben + cho        alpha  0.40  do not use the labels yet
where ann and ben agree, cho says: bad for unsafe (3x)
```

Krippendorff suggests relying on data with alpha of at least 0.800 and drawing only tentative conclusions from 0.667, and he adds that there are no magical numbers. Here two annotators agree well and the third does not. The last line shows why: the disagreement is systematic, because the third annotator labels every unsafe answer as merely bad. More labelling will not fix it. The definition of "unsafe" in the guidelines and a calibration session with that annotator will.

**Pairwise preferences and rankings.** Asking "which of these two answers is better?" is easier for people than giving absolute scores, and it is how Chatbot Arena ranks models. Turning many votes into a ranking needs a model of the votes. The Bradley–Terry model gives each system a strength and assumes that system *i* beats system *j* with probability strength_i / (strength_i + strength_j). Fitted to all votes at once, it gives the same result in any order of votes. The online Elo rating used for chess updates after each game, so recent votes count more:

```python
import math
import random
from statistics import fmean

rng = random.Random(13)
strength = {"model-a": 1.5, "model-b": 0.9, "model-c": 0.8, "model-d": 0.0}  # true strengths, unknown to the analysis
names = list(strength)
votes = []  # (winner, loser) from human raters who compared two answers side by side
for _ in range(400):
    first, second = rng.sample(names, 2)
    if rng.random() < 1 / (1 + math.exp(strength[second] - strength[first])):
        votes.append((first, second))
    else:
        votes.append((second, first))


def elo(games: list[tuple[str, str]], k: float = 32) -> dict[str, float]:
    """Online Elo: every vote moves the two ratings, so the result depends on the order of the votes."""
    rating = {name: 1000.0 for name in names}
    for winner, loser in games:
        expected = 1 / (1 + 10 ** ((rating[loser] - rating[winner]) / 400))
        rating[winner] += k * (1 - expected)
        rating[loser] -= k * (1 - expected)
    return rating


def bradley_terry(games: list[tuple[str, str]], rounds: int = 300) -> dict[str, float]:
    """Maximum likelihood fit of the Bradley-Terry model to all votes at once (MM algorithm), on the Elo scale."""
    wins = {name: 0 for name in names}
    pairs: dict[tuple[str, str], int] = {}
    for winner, loser in games:
        wins[winner] += 1
        key = tuple(sorted((winner, loser)))
        pairs[key] = pairs.get(key, 0) + 1
    worth = {name: 1.0 for name in names}
    for _ in range(rounds):
        updated = {}
        for name in names:
            denominator = sum(count / (worth[pair[0]] + worth[pair[1]]) for pair, count in pairs.items() if name in pair)
            updated[name] = wins[name] / denominator
        center = math.exp(fmean(math.log(value) for value in updated.values()))
        worth = {name: value / center for name, value in updated.items()}
    return {name: 1000 + 400 * math.log10(value) for name, value in worth.items()}


def ranking(scores: dict[str, float]) -> str:
    return " > ".join(sorted(names, key=lambda name: scores[name], reverse=True))


forward, backward = elo(votes), elo(votes[::-1])
fitted, fitted_backward = bradley_terry(votes), bradley_terry(votes[::-1])
print(f"{'model':<9} {'Elo, votes in order':>20} {'Elo, reversed':>14} {'Bradley-Terry':>14}")
for name in sorted(names, key=lambda name: fitted[name], reverse=True):
    print(f"{name:<9} {forward[name]:>20.0f} {backward[name]:>14.0f} {fitted[name]:>14.0f}")

print("Elo ranking in order:  ", ranking(forward))
print("Elo ranking reversed:  ", ranking(backward))
print("Bradley-Terry, either order:", ranking(fitted), "| same result:",
      all(abs(fitted[name] - fitted_backward[name]) < 1e-6 for name in names))
```

Output:

```text
model      Elo, votes in order  Elo, reversed  Bradley-Terry
model-a                   1057           1086           1098
model-b                   1077           1069           1022
model-c                    917            985           1012
model-d                    949            860            867
Elo ranking in order:   model-b > model-a > model-d > model-c
Elo ranking reversed:   model-a > model-b > model-c > model-d
Bradley-Terry, either order: model-a > model-b > model-c > model-d | same result: True
```

The same 400 votes processed in a different order give Elo rankings that disagree with each other. One of them places the weakest model third. Bradley–Terry recovers the true order and does not depend on the order of the votes. Chatbot Arena moved from online Elo to Bradley–Terry because its coefficients are better suited to statistical estimation, such as confidence intervals (the paper compares bootstrap and robust standard errors). Report rankings with such intervals: systems whose intervals overlap share a rank. Arena also publishes a style-controlled ranking, which adds answer length and formatting to the Bradley–Terry model, because style alone shifts the leaderboard.

## Beyond text: multimodal and voice

| System | What goes wrong | How to measure |
|---|---|---|
| Image input | OCR errors, misread charts and tables, invented visual details, instructions hidden in images | Character error rate on documents, question answering with known answers, injection cases with text in images |
| Speech input | Recognition errors by accent, noise and domain vocabulary, which then propagate into the answer | Word error rate per slice, and end-to-end task success on recorded audio |
| Voice agents | Slow responses, talking over the user, missed interruptions, spoken numbers, names and email addresses | Latency to first audio, barge-in tests, scripted calls with known outcomes |
| Generated images and audio | Policy violations, inconsistency with the request, missing provenance labels | Policy classifiers and human review, checks of provenance metadata |

Speech recognition is measured with the **word error rate**, the edit distance between the recognized and the reference words:

```text
WER = (S + D + I) / N
S substitutions, D deletions, I insertions, N words in the reference

reference:  refund   my   order   four  two  one
recognized: refund   my   border  for   two  one   please
            1 substitution (border) + 1 substitution (for) + 1 insertion (please) over 6 words = 0.50
```

Normalize case, punctuation and number formats before comparing, and report the error rate per accent, noise level and vocabulary slice: an average hides the users the system fails.

## Governance and evidence

Regulators and enterprise customers increasingly expect documented AI risk management. The main frameworks overlap more than they differ:

| Framework | What it is | What testers contribute |
|---|---|---|
| NIST AI RMF 1.0 | A voluntary framework with four functions: Govern, Map, Measure, Manage | Measurement methods, test results and risk tracking (the Measure function) |
| NIST AI 600-1 | The generative AI profile of the AI RMF, with 12 risks such as confabulation, information integrity and harmful bias | An evaluation plan that covers the relevant risks |
| EU AI Act, Regulation (EU) 2024/1689 | A risk-based law: prohibited practices, high-risk systems, transparency duties, rules for general-purpose models | Evidence for the requirements on high-risk systems |
| ISO/IEC 42001:2023 | A certifiable management system standard for AI | Documented, repeatable evaluation and monitoring processes |

For high-risk systems, the EU AI Act sets requirements that map directly onto testing work:

| Article | Requirement | Evidence from testing |
|---|---|---|
| 9 | Risk management system | Risk register linked to tests, residual risks after testing |
| 10 | Data and data governance | Representativeness of datasets, examination for bias |
| 11 and Annex IV | Technical documentation | Evaluation methodology, metrics and results with versions |
| 12 | Record-keeping | Logs and traces that allow incidents to be reconstructed |
| 13 | Transparency to deployers | Documented performance, limitations and known failure modes |
| 14 | Human oversight | Tests showing that people can understand, override and stop the system |
| 15 | Accuracy, robustness and cybersecurity | Accuracy per slice, robustness tests, red-team results |

AI systems used for recruitment, such as filtering applications or evaluating candidates, are high-risk under Annex III of the Act. For job-related products like this site, bias testing, documentation and human oversight are legal requirements, not only good practice. Regulation (EU) 2026/1744 (the Digital Omnibus on AI) moved the date from which these requirements apply. It is now 2 December 2027 for the systems in Annex III, and 2 August 2028 for AI in products covered by Annex I. The core requirements stay the same, and building the evidence takes time, so the postponement is no reason to wait.

Evidence is convincing when it is **traceable and current**. Every important risk should be linked to the tests that cover it, and every test result should belong to the version being released. Model cards for models, datasheets for datasets and evaluation reports for releases record this in a standard form. A small check finds the gaps before an auditor or an incident does:

```python
from datetime import date

release = {"version": "2.4.0", "date": date(2026, 10, 10)}
MAX_AGE_DAYS = 90

# The risk register: every risk names the tests that produce evidence about it
risks = [
    {"id": "R1", "severity": "high", "risk": "answers contradict the refund policy", "tests": ["policy-suite", "policy-judge"]},
    {"id": "R2", "severity": "high", "risk": "one customer sees another's data", "tests": ["tenancy-tests", "red-team-leaks"]},
    {"id": "R3", "severity": "high", "risk": "CV scores differ by gender or origin", "tests": []},
    {"id": "R4", "severity": "medium", "risk": "slow answers at peak load", "tests": ["load-test"]},
    {"id": "R5", "severity": "low", "risk": "answer in the wrong language", "tests": ["language-check"]},
]
# The latest result of every test: status, version tested, date of the run
results = {
    "policy-suite": ("pass", "2.4.0", date(2026, 10, 9)),
    "policy-judge": ("pass", "2.4.0", date(2026, 10, 9)),
    "tenancy-tests": ("pass", "2.4.0", date(2026, 10, 9)),
    "red-team-leaks": ("fail", "2.4.0", date(2026, 10, 8)),
    "load-test": ("pass", "2.1.0", date(2026, 6, 2)),
    "language-check": ("pass", "2.4.0", date(2026, 10, 9)),
    "tone-check": ("pass", "2.4.0", date(2026, 10, 9)),
}

gaps = {}
for risk in risks:
    problems = [] if risk["tests"] else ["no test covers it"]
    for test in risk["tests"]:
        if test not in results:
            problems.append(f"{test} never ran")
            continue
        status, version, ran = results[test]
        age = (release["date"] - ran).days
        if status != "pass":
            problems.append(f"{test} {status}s")
        if version != release["version"]:
            problems.append(f"{test} tested {version}")
        if age > MAX_AGE_DAYS:
            problems.append(f"{test} is {age} days old")
    gaps[risk["id"]] = problems
    print(f"{risk['id']} {risk['severity']:<6} {risk['risk']:<38} {'; '.join(problems) or 'evidence current'}")

linked = {test for risk in risks for test in risk["tests"]}
print("tests that cover no risk:", ", ".join(sorted(set(results) - linked)) or "none")
open_high = [risk["id"] for risk in risks if risk["severity"] == "high" and gaps[risk["id"]]]
print(f"release {release['version']}:", f"no-go, high risks without current evidence: {', '.join(open_high)}" if open_high
      else "evidence complete")
```

Output:

```text
R1 high   answers contradict the refund policy   evidence current
R2 high   one customer sees another's data       red-team-leaks fails
R3 high   CV scores differ by gender or origin   no test covers it
R4 medium slow answers at peak load              load-test tested 2.1.0; load-test is 130 days old
R5 low    answer in the wrong language           evidence current
tests that cover no risk: tone-check
release 2.4.0: no-go, high risks without current evidence: R2, R3
```

The release is blocked by evidence, not by opinion. A failing red-team test and an untested fairness risk block it; the load test is stale and must be repeated before the next release. The check also finds a test that covers no risk, which is either a missing link or wasted effort.

## Designing an evaluation platform

When several teams build LLM features, a shared platform keeps them from rebuilding the same pieces and makes results comparable:

```diagram
datasets (versioned, tagged, access-controlled)
   ↓
runners (offline, CI, sampled production traffic)
   ↓
scorers (code checks, validated judges, human review queues)
   ↓
results store (every run, every case, every version)
   ↓
reports and gates (scorecards, trends, alerts, release decisions, evidence)
```

Principles that make such a platform work:
- **Datasets and scorers are assets** with owners, versions and documentation.
- **Every result links to exact versions** of the application, prompt, model, dataset and judge.
- **Judges publish their validation results** (true positive rate, true negative rate, agreement with people) next to their scores.
- **Adding a case from a production trace takes one step,** so that failures become regression cases.
- **Privacy and access control are built in** from the start, because evaluation data contains real conversations.

## Leading quality strategy

- **Plan from risks.** Rate each risk by severity and likelihood, and spend the evaluation effort accordingly. One severe risk deserves a dedicated suite and a hard gate; a cosmetic one, a few checks.
- **Agree ship criteria before testing.** Limits negotiated after the results are a ritual, not a gate ([Production quality](/learn/llm?topic=production-quality)).
- **Report in terms leaders can act on.** For example: "task success 92% (90–94%), up from 87%; no high-severity security findings; cost per resolved ticket down 18%; fairness tests for the CV ranking feature still missing, so that feature stays off."
- **Make evaluation everyone's work.** Quality scales when every feature team owns its datasets and gates, and the platform team owns the tools.
- **Know when evaluation is not enough.** Some risks need staged rollouts, human review of every decision, or not shipping the feature at all.

| Risk | Severity | Evaluation | Gate |
|---|---|---|---|
| Answers contradict policy | High | Policy suite with code checks and a validated judge, per language | Non-inferiority, plus a floor for each slice |
| Data of one customer reaches another | High | Tenancy tests, red-team leak suite | Zero tolerance |
| Unequal treatment in CV ranking | High | Counterfactual pairs, slice analysis, human review | No significant gap; human oversight in production |
| Slow answers at peak | Medium | Load test against a fake provider and the real limits | p95 limits |
| Wrong reply language | Low | Language check on all traffic | Alert threshold |

## Example project

The methods of this chapter are implemented and tested in [examples/llm-testing/16-benchmarks-governance](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/16-benchmarks-governance):
- contamination checks with n-gram overlap and reworded copies;
- item analysis that finds broken and useless items;
- Bradley–Terry rankings with bootstrap intervals, compared with online Elo;
- Krippendorff's alpha, verified against the published examples;
- a Pareto front for model selection with paired quality comparisons;
- word and character error rates;
- a traceability check that turns a risk register and test results into an evidence report.

All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/16-benchmarks-governance
```

## Common mistakes

- **Choosing a model by its leaderboard rank** without your own evaluation.
- **Comparing benchmark scores from different setups,** or trusting differences smaller than the benchmark's noise.
- **Ignoring contamination,** including in your own benchmark after it has been published.
- **Never analysing the items** of a custom benchmark, so wrong references and useless items stay.
- **Using human labels without measuring agreement,** or averaging over an annotator who disagrees systematically.
- **Ranking systems with online Elo** and reporting ranks without intervals.
- **Reporting average error rates** for speech or images without slices.
- **Treating governance as paperwork** written after the release instead of evidence produced by the tests.
- **Ship criteria decided after the results.**

## Summary

- Public benchmarks build a shortlist; your own evaluation on your cases makes the decision.
- Read a benchmark with its setup, size, date and saturation in mind. Small benchmarks are noisy, and contamination inflates scores.
- Detect contamination with n-gram overlap, reworded copies, canary strings, time splits and private hold-out sets.
- Choose models on the Pareto front of quality, cost and latency. Among candidates within the agreed quality margin of the best one, cost and latency decide. Pilot before switching.
- Build custom benchmarks with expert references, difficulty levels and item analysis, and keep a private hold-out set.
- Run human evaluation as a process with guidelines, calibration, gold items and agreement measured with Krippendorff's alpha. Rank pairwise preferences with Bradley–Terry and intervals.
- Measure multimodal and voice systems per slice, with error rates and end-to-end tasks.
- Produce governance evidence as a by-product of testing: risks linked to tests, results tied to versions, gaps found before release.
