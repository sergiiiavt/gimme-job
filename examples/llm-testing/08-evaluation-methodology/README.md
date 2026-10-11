# Evaluation methodology

Chapter: [Evaluation methodology and datasets](https://gimme-job.com/learn/llm?topic=evaluation-fundamentals)

The tools of this project cover the method around the scorers: from reading traces to a dataset that can be trusted, and from a run that can be reproduced to a comparison that shows what really changed.

| File | Content |
|---|---|
| `error_analysis.py` | Coded trace reviews turned into a failure taxonomy ranked by frequency times severity, with a saturation check and a list of notes that still need coding. Command-line tool |
| `dataset_builder.py` | Personal-data scrubbing, removal of exact and near duplicates, stratified sampling with a minimum per slice, hash-based dev/test split and a datasheet of what was done. Command-line tool |
| `dataset_validator.py` | Schema errors, duplicate IDs and inputs, leakage between dev and test, test inputs reused as few-shot examples, slices that are too thin. Command-line tool, exit status 1 on problems |
| `pairwise.py` | All-pairs selection of synthetic case specifications from dimensions. Command-line tool |
| `agreement.py` | Raw agreement, Cohen's kappa and the list of disagreements between two reviewers. Command-line tool |
| `eval_runner.py` | Generation separated from scoring, a response cache keyed by model, prompt version and input, a run manifest, and a scorecard with flipped cases and slices. Command-line tool |
| `data/` | Reviewed traces and the taxonomy, a 400-line production log, a golden dataset and a copy with seeded problems, prompt examples, dimensions, and labels from two reviewers |
| `test_*.py` | Tests for every tool, including property-based tests with Hypothesis |

## Error analysis

```bash
cd examples/llm-testing/08-evaluation-methodology
uv run --project .. python error_analysis.py data/annotations.jsonl data/taxonomy.json
```

```text
19 of 40 traces have a problem
category               traces severity priority
invented policy             5        3       15
missing citation            6        2       12
missed order lookup         3        3        9
too long                    4        1        4
wrong language              1        2        2
new categories appeared at traces [2, 3, 5, 8, 13]; none in the last 27
```

The command exits with status 1 while some notes are still without a category, or use a category that is not in the taxonomy.

## From a production log to a dataset

```bash
uv run --project .. python dataset_builder.py data/production_log.jsonl --target 60 --minimum 8 --out dataset.jsonl
uv run --project .. python dataset_validator.py data/golden_with_problems.jsonl --prompt-examples data/prompt_examples.json
```

```text
logged                     400
exact_duplicates_removed   93
near_duplicates_removed    88
personal_data_replaced     80
cases                      64
by_intent                  {'account': 8, 'delivery': 18, 'refunds': 10, 'returns': 28}
by_lang                    {'en': 47, 'uk': 17}
by_split                   {'dev': 42, 'test': 22}
```

```text
13 cases, 7 problem(s)
PROBLEM g10: field 'expected_facts' must be a list
PROBLEM g12: split must be one of ['dev', 'test']
PROBLEM g01: the ID is used 2 times
PROBLEM g03: same input as g01
PROBLEM g08: test input nearly repeats development case g07
PROBLEM g06: test input appears as a few-shot example in the prompt
PROBLEM slice intent=shipping: only 1 case(s), at least 3 needed
```

Near duplicates are messages whose sets of words overlap by at least 80% (Jaccard similarity). For short messages a single changed word is enough to keep them apart; in a longer message, another order number in an otherwise identical question still counts as the same case. The threshold is a judgement: check a sample of what it removes.

## Compare two prompt versions

```bash
uv run --project .. python eval_runner.py data/golden.jsonl --baseline v2 --candidate v3 --cache .eval-cache
```

```text
pass rate: v2 72%, v3 72%
fixed: g07, g08, g09
broken: g10, g11, g12
  g10: missing ['3-5 робочих днів']; output: Standard delivery takes 3-5 business days.
  g11: missing ['3-5 робочих днів']; output: Standard delivery takes 3-5 business days.
  g12: missing ['3-5 робочих днів']; output: Standard delivery takes 3-5 business days.
intent=delivery    3/6 -> 3/6
intent=refunds     4/6 -> 4/6
intent=returns     6/6 -> 6/6
lang=en            6/9 -> 9/9
lang=uk            7/9 -> 4/9
```

The new prompt version fixes the English delivery answers and makes the Ukrainian ones switch to English; the average does not move. Run the command a second time: every output comes from the cache and the model is not called. The system under test is a deterministic fake; a real project passes its own client with the same `generate(prompt_version, text)` method.

## What the tests show

- Priority is frequency times severity: the most frequent failure is not the most important one.
- No e-mail address or phone number from the log reaches the dataset, while order numbers are kept.
- A rare slice gets its minimum number of cases; a slice smaller than the minimum is taken whole.
- The split of a case depends only on its ID, so adding or shuffling cases never moves it between dev and test.
- Every seeded problem in the dataset is found, and the clean golden dataset has none.
- The pairwise selection always covers every pair of values, needs at least as many cases as the two largest dimensions multiplied, and no chosen case can be dropped.
- Cohen's kappa is symmetric, bounded and 1 for identical labels; the chapter's reviewers agree on 87% of cases with a kappa of 0.26.
- The response cache makes a repeated run free and identical, never reuses outputs of another prompt version, and runs on different datasets cannot be compared.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/08-evaluation-methodology
```
