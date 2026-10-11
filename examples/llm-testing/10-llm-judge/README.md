# LLM-as-a-judge

Chapter: [LLM-as-a-judge](https://gimme-job.com/learn/llm?topic=model-graded-evaluation)

A judge is a measuring instrument: it needs a specification, a calibration against people, a correction for its errors and checks for its biases. This project implements each of them for one criterion of the support assistant, "does not invent policy".

| File | Content |
|---|---|
| `judge_prompt.py` | The versioned judge prompt, rendering that answers cannot break or inject into, and strict parsing of the `{"critique", "verdict"}` contract: anything invalid is an error, never a pass |
| `simulated_judge.py` | A judge with known error rates and configurable position and verbosity bias, seeded by case ID, for testing the methods themselves |
| `judge_validation.py` | TPR, TNR, kappa and Wilson intervals on development and test labels. Command-line tool |
| `rate_correction.py` | The Rogan–Gladen correction of a judged pass rate with a bootstrap interval over labels and verdicts. Command-line tool |
| `bias_probes.py` | Position-bias report from verdicts in both orders, the pairwise win rate with ties, and a verbosity probe. Command-line tool |
| `data/` | The policy, 40 development and 40 test answers with human labels and judge verdicts, 1,000 production verdicts, 50 pairwise results |
| `test_live_judge.py` | Optional: the same prompt and contract on a real model (`-m live`) |

## Validate the judge

```bash
cd examples/llm-testing/10-llm-judge
uv run --project .. python judge_validation.py data/labels_dev.jsonl data/labels_test.jsonl
```

```text
judge v1, dev   TPR 1.00  TNR 0.43 (95% CI 0.16-0.75)  kappa 0.55  missed failures 4 of 7
judge v2, dev   TPR 0.97  TNR 1.00 (95% CI 0.65-1.00)  kappa 0.92  missed failures 0 of 7
judge v2, test  TPR 0.97  TNR 0.83 (95% CI 0.44-0.97)  kappa 0.80  missed failures 1 of 6
```

The development set flatters the judge that was tuned on it, and six failures in the test set leave the TNR anywhere between 0.44 and 0.97. More labelled failures are the next step before the judge guards a release.

## Correct a judged pass rate

```bash
uv run --project .. python rate_correction.py data/labels_test.jsonl data/production_verdicts.jsonl
```

```text
judge verdicts: 812/1000 pass (81.2%)
judge quality on 40 labelled answers: TPR 0.97, TNR 0.83
corrected pass rate 80.3%, 95% interval 62.6% to 89.8%
```

## Measure position bias

```bash
uv run --project .. python bias_probes.py data/pairwise.jsonl
```

```text
50 pairs, consistent in both orders: 30 (60%)
the answer shown first won 58% of judgements
one order only: B wins 48%
both orders: B wins 18, A wins 12, ties 20, B win rate 56%
```

## What the tests show

- Answers containing braces, dollar signs or placeholder-like text are copied into the prompt literally; a lowercase verdict, an extra field or a missing critique is rejected as invalid.
- Accuracy hides a judge that catches nothing: passing everything is 85% accurate with a TNR of 0 and a kappa of 0.
- Validation recovers the error rates of a simulated judge, and the TNR interval narrows from more than 0.4 wide with six failures to less than 0.2 with sixty.
- For a lenient simulated judge on answers whose true pass rate is 70%, the raw verdicts report about 80%, and the corrected estimate returns to 70% with the truth inside its interval. A judge no better than chance is refused.
- Judging both orders exposes a position-biased judge, and counting inconsistent pairs as ties moves the win rate toward the truth.
- The verbosity probe passes an unbiased judge and flags one that lets padded failing answers pass.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/10-llm-judge
LLM_PROVIDER=anthropic LLM_MODEL=<pinned model id> ANTHROPIC_API_KEY=... uv run --project examples/llm-testing pytest examples/llm-testing/10-llm-judge -m live
```
