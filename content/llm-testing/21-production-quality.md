Evals on a laptop catch problems once. Production quality needs evals that run automatically: **gates before merge** and **monitors after deploy**. This chapter connects LLM evaluation to CI/CD, observability, performance and cost.

## 1. Two loops

```text
offline loop (before release)                 online loop (after release)
  dataset -> run app -> score -> gate           traffic -> trace -> sample -> score -> alert
       ^                                                                     |
       +----------- new failure cases from production -----------------------+
```

The offline loop prevents known regressions. The online loop finds unknown problems and feeds them back into the offline dataset. A mature team runs both.

## 2. Evals in CI/CD

Design the pipeline around cost and speed:

| Stage | Trigger | Scope | Typical gate |
|---|---|---|---|
| Unit tests (fake model) | Every push | All deterministic code | 100% pass |
| Smoke evals | Every pull request that touches prompts, models or LLM code | 20–50 critical cases, deterministic checks plus a few judges | No critical case fails; key rates within tolerance |
| Full evals | Nightly and before release | Full golden dataset with repeated runs | Thresholds per metric and segment, compared with baseline |
| Red-team suite | Weekly and before release | Security dataset and automated scanners | No new high-severity findings |

Practical rules:

- **Compare against a baseline**, not against a fixed absolute number only. Store baseline results as an artifact.
- **Use tolerances.** Because scores are noisy, fail on drops larger than the measured run-to-run variation.
- **Cache** model responses by input, prompt version and model version to make reruns cheap.
- **Post a scorecard** in the pull request with flipped cases linked.
- **Never let CI call production tools** with real side effects.

For general deployment-gate design, see [Cloud & DevOps — deployment gates](/learn/cloud-devops?topic=deployment-gates).

## 3. Tracing and observability

A **trace** records one request as a tree of **spans**: the model call, retrieval, each tool call and post-processing. For each LLM span, record:

- model name and version, parameters and prompt version;
- input and output (with PII redaction where required);
- token counts, latency, time to first token and cost;
- retrieved document IDs and scores;
- tool names, arguments and results;
- errors and retries.

**OpenTelemetry** defines semantic conventions for generative AI spans, so traces can move between vendors. Tools such as **Langfuse**, **LangSmith** and **Arize Phoenix** store traces and attach scores to them.

## 4. Online evaluation

Production traffic shows inputs your dataset never imagined. Online evaluation:

1. **samples** traces (for example 5% of traffic, plus 100% of traces with errors or negative feedback);
2. runs **deterministic checks** and validated **judges** asynchronously, never on the user's request path;
3. **aggregates** scores by time, feature, segment, model and prompt version;
4. **alerts** when a rate drifts beyond a threshold;
5. sends failing traces to a **review queue** for humans.

Respect privacy: get consent where required, redact personal data before storing traces or sending them to a third-party judge, and set retention limits.

## 5. User feedback

- **Explicit:** thumbs up/down, ratings, "report a problem".
- **Implicit:** regenerate clicks, copy actions, abandonment, escalation to a human, follow-up questions that repeat the original question.

Feedback is biased: unhappy users click more, and many users never click. Use it to find cases to review, not as a quality metric on its own.

**The most important habit:** every confirmed production failure becomes a new case in the golden dataset, with a tag pointing to the incident.

## 6. Performance testing

LLM latency has its own metrics:

| Metric | Meaning |
|---|---|
| TTFT (time to first token) | How long until streaming output starts; drives perceived speed |
| Tokens per second | Output generation speed |
| End-to-end latency | Including retrieval, tools and post-processing |
| p50 / p95 / p99 | Percentiles; tail latency matters more than averages |
| Error and throttle rate | 429s, timeouts, provider 5xx under load |

Load-test notes:

- use realistic input and output lengths, because latency scales with tokens;
- respect provider rate limits and budgets; test against a staging key with known quotas;
- test streaming clients, connection limits and timeouts;
- measure behaviour under throttling: queueing, backoff and graceful errors.

Tools such as **k6** and **Locust** work for LLM endpoints. See [Performance & reliability](/learn/performance) for load-testing fundamentals.

## 7. Cost testing

Cost is a quality attribute. Track:

- input and output tokens per request, by feature;
- cache hit rate, for both prompt caching and response caching;
- cost per successful task, not only per request;
- cost regressions: a prompt change that adds 500 tokens to every call is a real regression.

Add cost assertions to eval runs: "median tokens per request does not grow by more than 15% compared with baseline."

## 8. Model migration testing

Switching models (a new version, a cheaper model or another provider) is a high-risk change:

1. run the full offline suite on the candidate with repeated runs;
2. compare per segment and read flipped cases;
3. re-validate judges if the judge model changes;
4. check format compliance, refusal behaviour, latency, cost and language quality;
5. roll out gradually (shadow traffic, then a percentage canary) with online evaluation on;
6. keep a fast rollback path.

Pin model versions in production. A moving alias can change behaviour without any change in your code.

## 9. A/B testing and experiments

For prompt or model changes that offline evals cannot settle, run an online experiment:

- define the primary metric (task success, resolution without escalation) and **guardrail metrics** (safety violations, latency, cost) before starting;
- randomize by user, not by request, to avoid inconsistent experiences;
- run long enough for the planned sample size;
- stop early only for guardrail breaches.

## 10. Case study: GimmeJob's Learning Path Advisor in production

The advisor in this repository shows several of these practices:

- Langfuse callbacks capture LangGraph and model execution; a root trace records the retrieval strategy, embedding model, retrieved IDs and scores;
- deterministic runtime quality scores (`retrieval_top_score`, `grounded_node_ratio`, `source_validity`, `map_connected`) are attached to every trace, so you can monitor them over time without a judge model;
- token usage reported by the model integration lets Langfuse compute per-generation and total cost;
- the `/health` endpoint reports model, retrieval and tracing readiness without exposing secrets;
- the production deploy refreshes the RAG index automatically after the Worker deploys, so new learning content reaches retrieval without a manual step.

## 11. QA quick reference

- Run smoke evals on every relevant pull request and full evals nightly.
- Gate on change compared with baseline, with tolerances based on measured noise.
- Trace every model, retrieval and tool span with versions, tokens and cost.
- Score sampled production traffic asynchronously; alert on drift.
- Turn every production failure into a dataset case.
- Measure TTFT, p95 latency, throttling and cost per successful task.
- Treat model changes as migrations: full suite, canary, rollback.

## 12. Practice

1. Add a GitHub Actions job that runs your smoke eval suite on pull requests and fails on a regression compared with a stored baseline.
2. Instrument your bot with tracing (Langfuse or Phoenix) including tokens, cost and retrieved IDs.
3. Add one online judge on a 10% sample and a dashboard of its pass rate over time.
4. Load-test the bot with k6 or Locust at three concurrency levels; report TTFT and p95.
5. Migrate the bot to a different model using the process in section 8 and write a one-page migration report.

**Exit check:** a bad prompt change is blocked before merge, and a production quality drop triggers an alert with linked traces.

## Sources

- [OpenTelemetry — semantic conventions for generative AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Langfuse documentation](https://langfuse.com/docs)
- [Arize Phoenix](https://phoenix.arize.com/)
- [promptfoo — CI/CD integration](https://www.promptfoo.dev/docs/integrations/ci-cd/)
- [Grafana k6 documentation](https://grafana.com/docs/k6/latest/)
- [Locust](https://locust.io/)
