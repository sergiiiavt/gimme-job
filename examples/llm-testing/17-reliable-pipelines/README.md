# Reliable AI pipelines

Companion to [Reliable AI pipelines and hallucination control](https://gimme-job.com/learn/llm?topic=ai-reliability).

The model is an untrusted proposal source. The application owns the authenticated tenant, requested field, current policy registry, validation and final answer template. It blocks fabricated values, foreign or expired evidence, stale versions, malformed output and additional model-generated claims. Provider failures produce an abstention. Operation messages come from trusted receipt states, with unknown outcomes requiring reconciliation.

This is a bounded design for reviewed integer policy facts, not semantic verification of arbitrary prose. Fact ingestion, authentication, intent resolution, HTML escaping, persistent traces, real tool execution, approvals and provider reconciliation are integration responsibilities. A wrong registry fact still produces a wrong answer: a test demonstrates this limit deliberately. No live model accuracy is claimed.

From the repository root:

```bash
python examples/llm-testing/17-reliable-pipelines/reliable_pipeline.py
uv run --project examples/llm-testing pytest examples/llm-testing/17-reliable-pipelines -q
```

The demo needs only Python's standard library. The tests use the course's existing pytest dependency and run offline in the existing CI course suite.

The statistical helper calculates a one-sided binomial upper bound after zero observed failures. Its assumptions require independent representative trials with the same failure probability. Repeated paraphrases or one repeated prompt do not justify treating the whole sample as independent production coverage.
