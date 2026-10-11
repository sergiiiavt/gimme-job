Some qualities cannot be checked by regex or overlap metrics: helpfulness, tone, correctness of reasoning, policy compliance. **Model-graded evaluation** uses an LLM as a grader, also called **LLM-as-a-judge**. It scales human-like judgement, but a judge is itself an untested model until you measure it.

This chapter also covers how to test anything when outputs vary between runs.

## 1. When to use a judge

Use a judge when:

- the criterion needs understanding of meaning (does the answer actually address the question?);
- there are many valid outputs;
- human review of every case is too slow or expensive.

Do not use a judge when a deterministic check works, or when the judge would need knowledge it does not have (for example, your private policy, unless you include it in the judge prompt).

## 2. Judge patterns

| Pattern | Question to the judge | Good for |
|---|---|---|
| Pointwise with rubric | "Does this answer meet criterion X? Answer PASS or FAIL with a reason." | Regression suites, CI gates |
| Reference-guided | "Compared with this reference answer, is the output factually consistent?" | Q&A with known answers |
| Pairwise | "Which of answers A and B is better for this question?" | Comparing prompts or models |
| Claim decomposition | "List claims in the answer; mark each as supported or unsupported by the context." | Faithfulness and hallucination checks |
| G-Eval style | Judge writes evaluation steps from criteria, then scores | Research-style scoring with probabilities |

## 3. Writing a good rubric

Most bad judges come from vague rubrics. Rules:

- **One criterion per judge.** Separate "faithful", "complete" and "polite". A combined score hides which part failed.
- **Prefer binary PASS/FAIL to 1–10 scales.** Scales drift, cluster around 7–8 and are hard to act on. If you need nuance, use a few binary criteria.
- **Define failure precisely** with examples of borderline cases.
- **Ask for the reason before the verdict.** Reasoning first usually improves accuracy and gives you something to debug.
- **Use structured output** for the verdict so parsing never fails.
- **Give the judge everything it needs:** question, answer, context, policy, reference.

```text
You are grading a customer-support answer.

Criterion: FAITHFUL. The answer must not state any policy, number or promise
that is not supported by the CONTEXT. Paraphrasing is fine. Saying "I don't know"
is fine. Adding general advice that is not a policy claim is fine.

<context>{{context}}</context>
<question>{{question}}</question>
<answer>{{answer}}</answer>

Return JSON: {"reasoning": "<one short paragraph>", "verdict": "PASS" | "FAIL"}
```

## 4. Known judge biases

| Bias | Description | Mitigation |
|---|---|---|
| Position bias | In pairwise comparison, prefers the first (or second) answer | Run both orders; count a win only if consistent |
| Verbosity bias | Prefers longer answers | Tell the judge length is not quality; control for length in analysis |
| Self-preference | Prefers outputs from its own model family | Use a judge from a different provider when comparing models |
| Leniency | Passes almost everything | Add hard negative examples; check the judge's failure rate on known-bad cases |
| Format sensitivity | Small rubric wording changes swing scores | Version the judge prompt; re-validate after edits |

## 5. Calibrating a judge against humans

A judge is a classifier. Measure it like one.

1. Take 100–200 outputs. Have a domain expert label each one PASS or FAIL for the criterion. Write down the reason for each FAIL.
2. Run the judge on the same outputs.
3. Compute agreement:

| | Human PASS | Human FAIL |
|---|---|---|
| Judge PASS | true positive | false positive (missed defect) |
| Judge FAIL | false negative (false alarm) | true negative |

- **True positive rate** (recall on good outputs) and **true negative rate** (recall on bad outputs) matter more than raw accuracy, because most outputs are usually good.
- **Cohen's kappa** measures agreement corrected for chance. Values above about 0.6 are usually considered substantial agreement.
4. Read every disagreement. Fix the rubric or add examples, then measure again on a **different** sample to avoid overfitting the judge.
5. Re-validate when you change the judge model or the rubric.

If expert humans disagree with each other often, the criterion is not defined well enough. Fix the definition before automating it.

## 6. Correcting the measured rate

If the judge says 90% of outputs pass, the true pass rate is not necessarily 90%. With measured TPR and TNR you can estimate the real rate and its uncertainty. At minimum, report the judge's TPR and TNR next to every judged metric so readers know how much to trust it.

## 7. Metamorphic and property-based testing

When you cannot know the right answer, you can still know how answers should **relate** to each other. These relations are **metamorphic relations**:

| Relation | Transformation | Expected |
|---|---|---|
| Paraphrase invariance | Rephrase the question | Same facts in the answer |
| Irrelevant noise | Add an unrelated sentence | Same answer |
| Order invariance | Reorder retrieved documents | Same answer |
| Negation | Negate a key fact in the context | Answer changes accordingly |
| Language | Translate the question | Equivalent answer in the new language |
| Counterfactual fairness | Swap a name, gender or region | Equivalent quality and tone |

**Property-based testing** generates many inputs automatically. Hypothesis can generate structured inputs for deterministic parts, such as prompt templates, parsers and validators.

```python
from hypothesis import given, strategies as st

@given(st.text(min_size=0, max_size=5000))
def test_prompt_builder_always_escapes_user_text(user_text):
    prompt = build_prompt(user_text)
    assert prompt.count("<user_input>") == 1
    assert prompt.count("</user_input>") == 1
```

## 8. Testing under non-determinism

Because outputs vary, one run is a sample, not a result.

- **Repeat runs.** Run each case several times (3–10, depending on cost) and record the pass rate per case.
- **pass@k** means at least one of k attempts passed. It is useful when a human or system can pick the best attempt, for example code generation.
- **pass^k** means all k attempts passed. It measures reliability, and it is what users experience when they call a feature repeatedly. pass^k drops fast: a case that passes 90% of the time passes all 8 runs only about 43% of the time.
- **Set thresholds on rates, not single runs.** For example: "refund policy cases pass at least 95% over 5 runs each."
- **Separate flaky cases.** A case that flips often is either testing an ambiguous requirement or a real instability. Investigate before you quarantine it.
- **Fix what you can:** low temperature, pinned model version and structured output reduce variance but never remove it.

## 9. Cost control for judge-heavy suites

- Run deterministic checks first; skip the judge when they already fail.
- Use a smaller judge model for simple criteria after validating it against the larger one.
- Cache model outputs and judge verdicts by input hash during development.
- Run a fast smoke subset on every pull request and the full suite nightly.

## 10. QA quick reference

- One criterion per judge, binary verdicts, reason before verdict, structured output.
- Validate every judge against human labels; report TPR, TNR and kappa.
- Mitigate position, verbosity and self-preference bias.
- Use metamorphic relations when the right answer is unknown.
- Measure pass rates over repeated runs; report pass^k for reliability.

## Sources

- [Zheng et al. — Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)
- [Liu et al. — G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634)
- [Hamel Husain — Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/)
- [Chen et al. — Evaluating Large Language Models Trained on Code (pass@k)](https://arxiv.org/abs/2107.03374)
- [Hypothesis documentation](https://hypothesis.readthedocs.io/)
