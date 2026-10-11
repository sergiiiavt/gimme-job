# Code-based scorers and metrics

A **scorer** turns one model output into a verdict or a number. Code-based scorers do this with ordinary code: parsing, pattern matching, comparison with a reference, arithmetic. They are free, instant, perfectly reproducible and free of the biases of model judges, which makes them the first layer of every evaluation suite. Their limit is equally clear: they can only check what can be specified mechanically, and a badly designed scorer measures the wrong thing with great precision.

This chapter builds the common code-based scorers from first principles, shows exactly where each one fails, and treats scorers as software that needs its own tests and validation.

**Prerequisites:** [Evaluation methodology and datasets](/learn/llm?topic=evaluation-fundamentals), [Structured output and validation](/learn/llm?topic=structured-output-validation).

## What a code-based scorer is

A scorer is a function from a test case and an output to a score with a reason:

```text
scorer(case, output) -> Score(passed: bool or value: float, reason: str)

case    the input plus everything needed to judge it: reference answer, expected facts,
        allowed sources, labels, tags for slicing
output  what the system produced for that input
reason  why the scorer decided as it did, so that a failure can be read without re-running anything
```

Good scorers share four properties:

- **Deterministic:** the same case and output always give the same score.
- **Explainable:** the reason names the rule that failed and the evidence ("found ['60']").
- **Versioned:** a change to a scorer changes every result it produces, so scorers live in version control and their version is stored with results.
- **Tested:** a scorer is code with its own unit tests and, for anything non-trivial, validation against human labels.

## Assertions that need no reference

Many requirements can be checked from the output alone, or from the output and the input:

| Assertion | How to implement it | Example failure it catches |
|---|---|---|
| Valid JSON / schema | Parse and validate against the contract | Truncated object, missing field |
| Length limits | Count words, characters or tokens | A 300-word answer where 120 are allowed |
| Required and forbidden phrases | Patterns with accepted wordings | Missing link to the returns page; "guaranteed refund" |
| Language | Script detection and language-specific letters | English reply to a Ukrainian question |
| Personal data | Patterns for e-mail, phone, IBAN, card numbers | Another customer's e-mail address in a reply |
| Citations | Every cited ID is in the retrieved set | A citation that points to a document never retrieved |
| Links | Every URL is on an allow-list | A link to a look-alike domain |
| Numbers | Extract numbers with units and compare | "60 days" where the policy says 30 |

These checks were introduced in earlier chapters ([Prompts as testable artifacts](/learn/llm?topic=prompts-as-artifacts), [Structured output and validation](/learn/llm?topic=structured-output-validation)). The rest of this chapter covers scores that compare an output with a reference, and the infrastructure around scorers.

## Exact match and token F1

For short factual answers, the classic metrics come from extractive question answering (the SQuAD benchmark):

```text
normalize(text)   lowercase, remove punctuation and the articles a/an/the, collapse whitespace
exact match (EM)  1 if normalize(prediction) == normalize(reference), else 0
token F1          precision = shared tokens / prediction tokens
                  recall    = shared tokens / reference tokens
                  F1        = 2 · precision · recall / (precision + recall)
```

```python
import string
from collections import Counter

ARTICLES = {"a", "an", "the"}


def normalize_answer(text: str) -> str:
    """SQuAD-style normalization: lowercase, drop punctuation and articles, collapse whitespace."""
    text = text.lower()
    text = "".join(ch for ch in text if ch not in string.punctuation)
    return " ".join(word for word in text.split() if word not in ARTICLES)


def exact_match(prediction: str, reference: str) -> float:
    return float(normalize_answer(prediction) == normalize_answer(reference))


def token_f1(prediction: str, reference: str) -> float:
    pred, ref = normalize_answer(prediction).split(), normalize_answer(reference).split()
    if not pred or not ref:
        return float(pred == ref)  # two empty answers match, as in the official SQuAD script
    common = Counter(pred) & Counter(ref)
    overlap = sum(common.values())
    if overlap == 0:
        return 0.0
    precision, recall = overlap / len(pred), overlap / len(ref)
    return 2 * precision * recall / (precision + recall)


reference = "30 days from delivery"
for prediction in ["30 days from delivery", "The 30 days, from delivery!", "Within 30 days of the delivery date",
                   "60 days from delivery", "You have a month after the parcel arrives"]:
    print(f"EM={exact_match(prediction, reference):.0f}  F1={token_f1(prediction, reference):.2f}  {prediction!r}")
```

Output:

```text
EM=1  F1=1.00  '30 days from delivery'
EM=1  F1=1.00  'The 30 days, from delivery!'
EM=0  F1=0.60  'Within 30 days of the delivery date'
EM=0  F1=0.75  '60 days from delivery'
EM=0  F1=0.00  'You have a month after the parcel arrives'
```

The last three lines contain the whole lesson. The **wrong** answer "60 days from delivery" scores higher F1 than a **correct** paraphrase, and a correct answer worded differently scores zero. Token overlap measures wording, not truth. Exact match and F1 are appropriate when the expected answer is short and its wording is fixed: labels, IDs, extracted values, names. For free-text answers, check facts instead.

## Fact-based scoring

A fact-based scorer encodes what a correct answer must say, what it must not say, and how to recognise each fact in different wordings. For the question "Can I return shoes after 40 days?":

- **Required:** the return window is 30 days (accepted wordings: "30 days", "thirty days", "one month"); the window counts from delivery ("delivery", "delivered", "arrives").
- **Forbidden:** promising an exception; any day count other than the policy value.

The script below implements this scorer twice. The first version has a realistic bug, and the only way to find it is to compare the scorer with human judgement.

```python
import re

QUESTION = "Can I return shoes after 40 days?"
REQUIRED = {
    "return window is 30 days": r"\b(30|thirty)[- ]days?\b|\b(one|a) month\b",
    "counted from delivery": r"\b(delivery|delivered|arriv(e|es|al))\b",
}
FORBIDDEN = {"promises an exception": r"\b(exception|guarantee|no problem)\b"}
DAY_COUNT = r"\b(\d+)[- ]days?\b"


def unsupported_days_naive(answer: str, question: str) -> set[str]:
    return {n for n in re.findall(DAY_COUNT, answer.lower()) if n != "30"}


def unsupported_days(answer: str, question: str) -> set[str]:
    """Day counts that are neither the policy value nor numbers the customer used."""
    echoed = set(re.findall(DAY_COUNT, question.lower()))
    return {n for n in re.findall(DAY_COUNT, answer.lower()) if n != "30" and n not in echoed}


def score(answer: str, question: str, day_check) -> tuple[bool, list[str]]:
    text = answer.lower()
    failed = [name for name, pattern in REQUIRED.items() if not re.search(pattern, text)]
    failed += [name for name, pattern in FORBIDDEN.items() if re.search(pattern, text)]
    if day_check(answer, question):
        failed.append(f"unsupported day count {sorted(day_check(answer, question))}")
    return not failed, failed


# Human labels: is the answer acceptable?
labelled = [
    ("No. Returns are accepted within 30 days of delivery, and 40 days is outside that window.", True),
    ("You have a month after the parcel arrives, so after 40 days it is too late.", True),
    ("Returns are accepted within 60 days from delivery.", False),
    ("We can make an exception for you this time!", False),
]
for label, day_check in [("naive scorer", unsupported_days_naive), ("fixed scorer", unsupported_days)]:
    agreement = 0
    print(label)
    for answer, acceptable in labelled:
        passed, failed = score(answer, QUESTION, day_check)
        agreement += passed == acceptable
        print(f"  human={acceptable!s:<5} scorer={passed!s:<5} {failed}")
    print(f"  agreement with human labels: {agreement}/{len(labelled)}")
```

Output:

```text
naive scorer
  human=True  scorer=False ["unsupported day count ['40']"]
  human=True  scorer=False ["unsupported day count ['40']"]
  human=False scorer=False ['return window is 30 days', "unsupported day count ['60']"]
  human=False scorer=False ['return window is 30 days', 'counted from delivery', 'promises an exception']
  agreement with human labels: 2/4
fixed scorer
  human=True  scorer=True  []
  human=True  scorer=True  []
  human=False scorer=False ['return window is 30 days', "unsupported day count ['60']"]
  human=False scorer=False ['return window is 30 days', 'counted from delivery', 'promises an exception']
  agreement with human labels: 4/4
```

The naive rule "no day count other than 30" rejects both good answers, because good answers repeat the customer's own "40 days". The scorer looked reasonable and would have reported a false regression on every correct answer. Two practices prevent this:

- **Design facts from real outputs.** Read a sample of good and bad answers before writing patterns, and include the ways correct answers actually phrase things.
- **Validate the scorer against human labels** before trusting it, exactly as you would validate a model judge ([LLM-as-a-judge](/learn/llm?topic=model-graded-evaluation)). Keep the labelled answers as unit tests of the scorer.

## BLEU and ROUGE, step by step

BLEU (from machine translation) and ROUGE (from summarization) compare n-grams, sequences of n consecutive words, between a candidate and a reference:

```text
BLEU   p_n = clipped n-gram matches / candidate n-grams          (n = 1..4; clipping counts each
                                                                   reference n-gram at most as often
                                                                   as it occurs in the reference)
       BP  = 1 if candidate is longer than the reference, else exp(1 − reference length / candidate length)
       BLEU = BP · exp( (1/4) Σ log p_n )                        (precision-oriented)

ROUGE-n recall = n-gram overlap / reference n-grams              (recall-oriented)
ROUGE-L        = F1 of the longest common subsequence (LCS) of words
               = 2 · LCS / (candidate length + reference length)
```

```python
import math
from collections import Counter


def ngrams(tokens: list[str], n: int) -> Counter:
    return Counter(tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1))


def bleu(candidate: str, reference: str, max_n: int = 4) -> float:
    """Sentence BLEU: geometric mean of clipped n-gram precisions times a brevity penalty.
    Add-one smoothing of the 2- to 4-gram precisions keeps short sentences from scoring exactly zero."""
    cand, ref = candidate.lower().split(), reference.lower().split()
    if not cand or not ref:
        return 0.0
    log_precisions = []
    for n in range(1, max_n + 1):
        cand_ngrams, ref_ngrams = ngrams(cand, n), ngrams(ref, n)
        clipped = sum(min(count, ref_ngrams[gram]) for gram, count in cand_ngrams.items())
        total = sum(cand_ngrams.values())
        if n > 1:
            clipped, total = clipped + 1, total + 1
        if clipped == 0:
            return 0.0
        log_precisions.append(math.log(clipped / total))
    brevity = 1.0 if len(cand) > len(ref) else math.exp(1 - len(ref) / len(cand))
    return brevity * math.exp(sum(log_precisions) / max_n)


def lcs_length(a: list[str], b: list[str]) -> int:
    table = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i, x in enumerate(a, 1):
        for j, y in enumerate(b, 1):
            table[i][j] = table[i - 1][j - 1] + 1 if x == y else max(table[i - 1][j], table[i][j - 1])
    return table[-1][-1]


def rouge(candidate: str, reference: str) -> dict[str, float]:
    cand, ref = candidate.lower().split(), reference.lower().split()
    scores = {}
    for n in [1, 2]:
        overlap = sum((ngrams(cand, n) & ngrams(ref, n)).values())
        scores[f"ROUGE-{n} recall"] = overlap / max(sum(ngrams(ref, n).values()), 1)
    lcs = lcs_length(cand, ref)
    scores["ROUGE-L F1"] = 2 * lcs / (len(cand) + len(ref)) if lcs else 0.0  # F1 of lcs/len(cand) and lcs/len(ref)
    return scores


reference = "unworn shoes can be returned within 30 days of delivery"
candidates = {
    "same words": "unworn shoes can be returned within 30 days of delivery",
    "correct paraphrase": "you may send back shoes you have not worn for a month after they arrive",
    "wrong number": "unworn shoes can be returned within 60 days of delivery",
    "opposite meaning": "unworn shoes cannot be returned within 30 days of delivery",
}
for name, candidate in candidates.items():
    r = rouge(candidate, reference)
    print(f"{name:<19} BLEU={bleu(candidate, reference):.2f}  " + "  ".join(f"{k}={v:.2f}" for k, v in r.items()))
```

Output:

```text
same words          BLEU=1.00  ROUGE-1 recall=1.00  ROUGE-2 recall=1.00  ROUGE-L F1=1.00
correct paraphrase  BLEU=0.07  ROUGE-1 recall=0.10  ROUGE-2 recall=0.00  ROUGE-L F1=0.08
wrong number        BLEU=0.70  ROUGE-1 recall=0.90  ROUGE-2 recall=0.78  ROUGE-L F1=0.90
opposite meaning    BLEU=0.74  ROUGE-1 recall=0.90  ROUGE-2 recall=0.78  ROUGE-L F1=0.90
```

The answer with the wrong number and the answer with the opposite meaning both score around 0.7 to 0.9; the correct paraphrase scores 0.1 or less. Research on natural-language generation found that these metrics correlate weakly with human judgement for open-ended text, and BLEU values are not even comparable across papers unless tokenization is standardized (the purpose of the sacreBLEU tool). Library defaults matter as well: the default tokenizer of the rouge-score package keeps only the characters a–z and 0–9, so Ukrainian text gets no tokens at all unless you pass your own tokenizer.

Where n-gram metrics remain useful:

- **Regression smoke checks** of near-deterministic outputs, where any large drop in overlap with the previous version is worth a look.
- **Translation and text normalization tasks** with several references, where wording is part of the requirement.
- **Corpus-level trends** across thousands of outputs, not single-case decisions. BLEU was originally defined for a whole test set, with n-gram counts summed over all sentences; the average of sentence scores is a different number.

## Embedding similarity and BERTScore

Embedding similarity compares meaning rather than wording, so it rewards correct paraphrases. It still scores negation, wrong numbers and swapped roles as close ([Embeddings and similarity](/learn/llm?topic=embeddings-similarity)). **BERTScore** matches each token of the candidate with its most similar token in the reference using contextual embeddings; it correlates better with human judgement than n-grams but inherits the same blindness to small, meaning-changing edits.

```python
# Run on your own machine: pip install bert-score
from bert_score import score

candidates = ["you may send back shoes you have not worn for a month after they arrive"]
references = ["unworn shoes can be returned within 30 days of delivery"]
precision, recall, f1 = score(candidates, references, lang="en")
print(f"BERTScore F1 = {f1[0]:.3f}")
```

Use similarity scorers as **pre-filters and trend signals**: an off-topic answer scores low and can fail early; a high score never proves correctness on its own.

## Classification metrics

Many LLM features are classifiers in disguise: ticket triage, intent detection, guardrails, the "needs a human" flag, a judge's PASS/FAIL. For those, use classification metrics on a labelled set.

```python
from collections import Counter

LABELS = ["billing", "returns", "technical", "other"]
# (human label, model label) for 20 triaged messages
pairs = ([("billing", "billing")] * 5 + [("billing", "returns")] * 1 +
         [("returns", "returns")] * 6 + [("returns", "other")] * 1 +
         [("technical", "technical")] * 3 + [("technical", "other")] * 2 +
         [("other", "other")] * 1 + [("other", "returns")] * 1)

confusion = Counter(pairs)
print("human vs model" + "".join(f"{label:>11}" for label in LABELS))
for expected in LABELS:
    print(f"{expected:<14}" + "".join(f"{confusion[(expected, predicted)]:>11}" for predicted in LABELS))

per_class = {}
for label in LABELS:
    tp = confusion[(label, label)]
    fp = sum(confusion[(other, label)] for other in LABELS if other != label)
    fn = sum(confusion[(label, other)] for other in LABELS if other != label)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    per_class[label] = (precision, recall, f1, tp + fn)
    print(f"{label:<10} precision={precision:.2f} recall={recall:.2f} F1={f1:.2f} support={tp + fn}")

accuracy = sum(confusion[(label, label)] for label in LABELS) / len(pairs)
macro_f1 = sum(values[2] for values in per_class.values()) / len(LABELS)
weighted_f1 = sum(values[2] * values[3] for values in per_class.values()) / len(pairs)
print(f"accuracy={accuracy:.2f}  macro F1={macro_f1:.2f}  weighted F1={weighted_f1:.2f}")
```

Output:

```text
human vs model    billing    returns  technical      other
billing                 5          1          0          0
returns                 0          6          0          1
technical               0          0          3          2
other                   0          1          0          1
billing    precision=1.00 recall=0.83 F1=0.91 support=6
returns    precision=0.75 recall=0.86 F1=0.80 support=7
technical  precision=1.00 recall=0.60 F1=0.75 support=5
other      precision=0.25 recall=0.50 F1=0.33 support=2
accuracy=0.75  macro F1=0.70  weighted F1=0.77
```

How to read it:

- **Accuracy** (0.75) hides which classes fail. The confusion matrix shows that technical tickets leak into "other" (recall 0.60): those customers wait for the wrong team.
- **Macro F1** averages classes equally, so small classes count as much as large ones; **weighted F1** follows the class frequencies. Report the one that matches the business question, and always show per-class numbers.
- **Precision versus recall** is a cost decision: for the escalation flag, missing a case (low recall) is usually worse than escalating unnecessarily (low precision).
- **Twenty cases are far too few** for decisions; the point here is the method. Sample sizes are covered in [Benchmarks, human evaluation and governance](/learn/llm?topic=pro-practice).

## Execution-based scoring

When the output is code, a query or a calculation, the strongest scorer **executes** it:

- **Generated code:** run it against unit tests in a sandbox (an isolated container or process with no network, limited CPU, memory and time). The HumanEval benchmark popularized this, together with the pass@k measure for several attempts.
- **Generated SQL:** run the query on a fixed test database and compare **result sets**, not query text; two different queries can be equally correct. A wrong query can also return the right rows by coincidence on one small database, so run each query on several databases built to tell such queries apart (test-suite accuracy), read-only and with a time or step limit.
- **Generated calculations or plans:** recompute the answer with trusted code and compare values with an explicit tolerance.

Executing model-generated code is a security risk in its own right: never run it in the evaluation process itself or with access to secrets or the network.

## Building a scoring harness

In practice several scorers run on every case, and results are aggregated overall and by slice (language, feature, difficulty). A slice that fails while the average looks fine is the most common way regressions hide.

```python
import json
import re
from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Score:
    scorer: str
    passed: bool
    reason: str = ""


def valid_json(case: dict, output: str) -> Score:
    try:
        json.loads(output)
        return Score("valid_json", True)
    except ValueError as error:
        return Score("valid_json", False, str(error))


def mentions_expected_days(case: dict, output: str) -> Score:
    days = re.findall(r"\b(\d+) (?:days?|днів)\b", output)
    ok = case["expected_days"] in days and all(d == case["expected_days"] for d in days)
    return Score("expected_days", ok, "" if ok else f"found {days}")


def short_enough(case: dict, output: str) -> Score:
    try:
        words = len(json.loads(output).get("answer", "").split())
    except ValueError:
        return Score("max_40_words", False, "not JSON")
    return Score("max_40_words", words <= 40, f"{words} words")


SCORERS = [valid_json, mentions_expected_days, short_enough]

cases = [
    {"id": "r1", "lang": "en", "expected_days": "30", "output": '{"answer": "Returns: 30 days from delivery."}'},
    {"id": "r2", "lang": "en", "expected_days": "30", "output": '{"answer": "You can return within 60 days."}'},
    {"id": "r3", "lang": "uk", "expected_days": "30", "output": '{"answer": "Повернення протягом 30 днів від доставки."}'},
    {"id": "r4", "lang": "uk", "expected_days": "30", "output": 'Відповідь: 30 днів'},
    {"id": "r5", "lang": "en", "expected_days": "14", "output": '{"answer": "Exchanges are possible for 14 days."}'},
]

by_slice = defaultdict(lambda: [0, 0])
failures = []
for case in cases:
    scores = [scorer(case, case["output"]) for scorer in SCORERS]
    case_passed = all(score.passed for score in scores)
    for key in ["all", f"lang={case['lang']}"]:
        by_slice[key][0] += case_passed
        by_slice[key][1] += 1
    failures += [(case["id"], score.scorer, score.reason) for score in scores if not score.passed]

for key, (passed, total) in sorted(by_slice.items()):
    print(f"{key:<8} pass rate {passed}/{total} = {passed / total:.0%}")
for failure in failures:
    print("FAIL", failure)
```

Output:

```text
all      pass rate 3/5 = 60%
lang=en  pass rate 2/3 = 67%
lang=uk  pass rate 1/2 = 50%
FAIL ('r2', 'expected_days', "found ['60']")
FAIL ('r4', 'valid_json', 'Expecting value: line 1 column 1 (char 0)')
FAIL ('r4', 'max_40_words', 'not JSON')
```

The harness design choices that matter: every failure carries its case ID, scorer name and reason; slices are computed from case tags, not hard-coded; scorers are plain functions, so each can be unit-tested and reused by evaluation frameworks such as promptfoo or DeepEval, which accept custom code assertions.

## Testing and validating scorers

A scorer that is wrong produces confident, wrong evaluation results. Protect scorers like production code:

- **Unit tests with adversarial outputs:** for each scorer, outputs that must pass (including unusual correct wordings) and outputs that must fail (including near misses such as "60 days").
- **Properties:** scores stay within their range, identical text gets the maximum score, a scorer never crashes on empty, huge or malformed output.
- **Linear time:** a scorer runs on every output, including a runaway one of 200,000 characters; a regular expression that backtracks quadratically turns that output into a hung evaluation run.
- **Agreement with human labels:** for any scorer that interprets language, measure agreement on a labelled sample and keep that sample as a regression test of the scorer.
- **Versioning:** when a scorer changes, re-score the baseline with the new version before comparing; otherwise a scorer fix looks like a model regression or improvement.

## Example project

The method of this chapter is implemented and tested in [examples/llm-testing/09-code-based-scorers](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/09-code-based-scorers): exact match, token F1, BLEU and ROUGE with property-based tests, classification metrics for the triage example, a bilingual fact scorer validated against human labels, a scoring harness that compares two versions of a system slice by slice, and execution-based scoring of generated SQL on read-only fixture databases. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/09-code-based-scorers
```

## Common mistakes

- **Using token overlap (F1, BLEU, ROUGE) to judge free-text correctness,** which rewards wrong answers with familiar wording.
- **Writing fact patterns from the reference answer only,** without reading how correct outputs are actually phrased.
- **Trusting a scorer that was never compared with human labels.**
- **Reporting only an average:** no per-class or per-slice results, no failure reasons.
- **Comparing results produced by different scorer versions.**
- **Running generated code in the evaluation process** without a sandbox.

## Summary

- Code-based scorers are the cheapest, fastest and most reproducible layer of evaluation; they must be deterministic, explainable, versioned and tested.
- Exact match and token F1 suit short answers with fixed wording; for free text they reward wording, not truth.
- Fact-based scorers encode required and forbidden facts with accepted wordings, and must be validated against human labels, as the "40 days" bug shows.
- BLEU and ROUGE score wrong numbers and opposite meanings highly; use them for trends and near-deterministic outputs only.
- Embedding similarity and BERTScore reward paraphrases but miss small meaning-changing edits; use them as filters.
- Classification features need confusion matrices and per-class precision and recall chosen by cost; executed code and queries are best scored by execution in a sandbox.
- A scoring harness reports every failure with its reason and every slice separately.
