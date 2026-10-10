At the pro level, the job changes from writing evals to owning **how an organization decides whether an AI product is good enough to ship**. That requires statistical rigor, benchmark literacy, human evaluation programs, governance evidence and the ability to explain all of it to non-specialists.

## 1. Statistical rigor

Every eval score is an estimate from a sample. Report it with its uncertainty.

### Confidence intervals

For a pass rate `p` measured on `n` independent cases, a rough 95% interval is `p ± 1.96 × sqrt(p(1−p)/n)`:

| Cases (n) | Observed pass rate | Approximate 95% interval |
|---|---|---|
| 50 | 85% | ±10 pp |
| 100 | 85% | ±7 pp |
| 400 | 85% | ±3.5 pp |
| 1,600 | 85% | ±1.7 pp |

To halve the interval you need four times as many cases. A 2-point improvement on 100 cases is almost always noise. For small samples or rates near 0% or 100%, use the Wilson interval instead of the normal approximation.

### Comparing two versions

- Use **paired** comparisons: run both versions on the same cases and analyse per-case differences. Pairing removes the variation between cases and needs far fewer samples than comparing two independent averages.
- **Bootstrap** resampling of cases gives intervals for any metric, including complex ones.
- When cases are clustered (several questions about the same document, several turns of the same conversation), resample by cluster, or the intervals will be too narrow.
- Repeated runs per case reduce noise from sampling; report both case-level and run-level variation.

### Avoiding self-deception

- **Overfitting the eval:** tuning prompts against the same dataset until the score rises. Keep a held-out set and refresh it.
- **Multiple comparisons:** if you test 20 prompt variants, one will look better by chance.
- **Metric gaming:** a model optimized for a judge can learn the judge's blind spots. Re-validate judges against fresh human labels.

## 2. Benchmarks and their limits

Public benchmarks measure general model capability. Common harnesses:

- **lm-evaluation-harness** (EleutherAI): runs hundreds of academic benchmarks against open models;
- **HELM** (Stanford CRFM): broad evaluation across scenarios and metrics, including calibration, robustness and fairness;
- **Inspect AI**: a framework for writing and running evaluation tasks, including agentic ones;
- **Chatbot Arena** style pairwise human preference leaderboards.

Know their limits:

- **Contamination:** benchmark questions may be in the training data, inflating scores.
- **Saturation:** when top models score near 100%, the benchmark no longer separates them.
- **Mismatch:** a model's rank on public benchmarks says little about your support bot. Your own eval suite is the benchmark that matters for your product.
- **Setup sensitivity:** prompt format, few-shot count and answer extraction change scores.

## 3. Building a custom benchmark

When your domain needs its own benchmark (for example, QA test-case generation quality):

1. define the capability precisely and what is out of scope;
2. collect tasks from real work, with expert-written references or grading rubrics;
3. measure **inter-annotator agreement** on the references; drop or fix tasks experts disagree on;
4. split into public development and private held-out sets;
5. include difficulty tiers so the benchmark does not saturate quickly;
6. publish the methodology and known limitations;
7. version it and plan refreshes.

## 4. Human evaluation programs

Humans remain the ground truth for subjective and high-stakes criteria. Running human evaluation well means:

- **written guidelines** with definitions, examples and borderline cases;
- **calibration sessions** where annotators label the same items and discuss disagreements;
- **agreement metrics** (Cohen's kappa for two raters, Krippendorff's alpha for more) tracked over time;
- **gold questions** with known answers mixed in to check annotator attention;
- **tooling** that shows the full context (conversation, retrieved documents, tool calls) in one view;
- **ethics:** fair pay, protection from harmful content, and no personal data without consent.

## 5. Multimodal and voice systems

- **Images:** OCR accuracy, chart and table reading, hallucinated visual details, prompt injection through text inside images.
- **Audio input:** speech recognition errors by accent, noise and domain vocabulary; how errors propagate into the LLM.
- **Voice agents:** end-to-end latency, interruption (barge-in) handling, turn-taking, silence and disconnect handling, and spoken numbers, names and emails.
- **Generated media:** policy compliance, provenance labelling and consistency with the request.

## 6. Governance and compliance evidence

Regulators and customers increasingly ask for evidence of AI risk management. Know the main frameworks:

| Framework | What it is | What testers contribute |
|---|---|---|
| **NIST AI RMF 1.0** | Voluntary framework with four functions: Govern, Map, Measure, Manage | Measurement methods, test results, risk tracking |
| **NIST AI 600-1** (Generative AI Profile) | Applies the AI RMF to generative AI risks such as confabulation, information integrity and harmful content | Coverage of the profile's risk categories in eval plans |
| **EU AI Act** (Regulation (EU) 2024/1689) | Risk-based law: prohibited practices, high-risk systems, transparency obligations and general-purpose AI model rules | Evidence of accuracy, robustness, cybersecurity and human oversight for high-risk systems |
| **ISO/IEC 42001** | Certifiable AI management system standard | Documented, repeatable evaluation and monitoring processes |

Note for job-related products: AI systems used for recruitment or for evaluating candidates are listed as high-risk under the EU AI Act. Bias testing, documentation and human oversight are legal requirements there, not only good practice.

Good evidence is **reproducible**: versioned datasets, versioned prompts and models, stored eval results, and a trace from each identified risk to the tests that cover it.

## 7. Designing an evaluation platform

When several teams ship LLM features, a shared platform prevents everyone from rebuilding the same pieces:

```text
datasets (versioned, tagged, access-controlled)
   -> runners (offline, CI, online sampling)
   -> scorers (deterministic checks, validated judges, human review queues)
   -> results store (every run, every case, every version)
   -> dashboards and gates (scorecards, trends, alerts, release decisions)
```

Platform principles:

- a dataset and a scorer are reusable assets with owners and versions;
- every result is linked to the exact app, prompt, model and judge versions;
- judges have published validation stats (TPR, TNR, kappa);
- it is easy for a developer to add a case from a production trace;
- privacy and access control are built in, not added later.

## 8. Leading quality strategy

- **Risk-based eval plans:** start from what can go wrong for users and the business, and size the eval effort by severity.
- **Ship / no-ship criteria** agreed before testing starts, not negotiated after the results.
- **Metrics leaders understand:** "task success 92% ± 2 pp, up from 87%; no high-severity safety findings; cost per resolved ticket down 18%."
- **Teach developers to write evals.** Quality scales when every feature team owns its datasets.
- **Know when evals are not enough:** some risks need staged rollouts, human oversight or not shipping at all.

## 9. Capstone

Combine everything into one public portfolio project:

1. the support bot from chapter 2, extended with RAG and agent tools;
2. a versioned golden dataset with a failure taxonomy;
3. deterministic checks, validated judges with published agreement stats, and RAG and agent evals;
4. a red-team report with findings and fixes;
5. a CI pipeline with regression gates and a tracing dashboard;
6. a methodology write-up: what you measured, with confidence intervals, and what you could not measure.

## 10. Career and portfolio

Roles that use this path: **AI QA engineer**, **LLM evaluation engineer**, **AI red teamer**, **ML quality lead**, and SDETs on AI product teams.

To stand out:

- publish the capstone repository with a clear README;
- write three short articles: judge calibration, a RAG debugging story and red-team findings;
- contribute a merged pull request to an open-source eval tool (promptfoo, DeepEval, Ragas, garak or Inspect);
- practise the interview exercise "design an eval plan for this product in 30 minutes": risks, datasets, metrics, gates and monitoring;
- prepare with the [AI & LLM QA interview questions](/interview/ai-llm).

## 11. QA quick reference

- Report every score with a confidence interval; compare versions with paired analysis.
- Keep held-out data and watch for overfitting and multiple comparisons.
- Treat public benchmarks as context, and your own evals as the decision basis.
- Run human evaluation with guidelines, calibration and agreement metrics.
- Map risks to tests to produce governance evidence.
- Agree ship criteria before testing.

## 12. Practice

1. Recompute your bot's main metrics with bootstrap 95% intervals and redo one earlier prompt comparison as a paired analysis. Was the improvement real?
2. Run one public benchmark task with lm-evaluation-harness or Inspect on two open models and explain why the result does or does not predict your bot's quality.
3. Write annotation guidelines for one criterion and measure agreement between you and one other person.
4. Map your bot's risks to the NIST AI 600-1 categories and list which tests cover each.
5. Publish the capstone and give a 10-minute talk on its methodology.

**Exit check:** other people use your evaluation results to make ship / no-ship decisions, and you can defend every number with its uncertainty.

## Sources

- [Miller — Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640)
- [EleutherAI — lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness)
- [Stanford CRFM — HELM](https://crfm.stanford.edu/helm/)
- [Inspect AI](https://inspect.aisi.org.uk/)
- [Chiang et al. — Chatbot Arena](https://arxiv.org/abs/2403.04132)
- [NIST — AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST AI 600-1 — Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
- [EU AI Act — Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [ISO/IEC 42001 — AI management systems](https://www.iso.org/standard/81230.html)
