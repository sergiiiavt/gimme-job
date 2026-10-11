# Model client

Chapter: [LLM application anatomy and APIs](https://gimme-job.com/learn/llm?topic=llm-application-anatomy)

The deterministic code around a model call, tested without a model: stop reasons, retries, streaming and cost.

| File | Content |
|---|---|
| `model_client.py` | Normalized `ModelResponse`, stop-reason mapping for OpenAI and Anthropic, `next_action` for every stop reason |
| `retry_policy.py` | Bounded retries: retryable statuses only, exponential backoff with full jitter, `Retry-After`, deadline, no retry on exhausted quota; a `FakeClock` for tests |
| `streaming.py` | Assembles recorded stream events, measures time to first token, detects interrupted streams, assembles tool-call fragments |
| `cost.py` | Cost per request with prompt caching, cost per resolved task |
| `fixtures/*.jsonl` | Recorded streams: complete answer, dropped connection, truncation at the limit, tool call, provider error |
| `test_model_client.py` | Offline tests for all of the above |
| `test_live_provider.py` | Optional live checks against a real provider (`-m live`) |

Key ideas shown by the tests:

- Every stop reason has a defined action, and an unknown future value fails closed.
- A fake clock verifies waiting behaviour instantly: `Retry-After` is honoured, attempts and total time are bounded, 400s and quota errors are never retried.
- Recorded streams are replayed through the same code that handles live streams.
- A prompt that grows by 1,500 tokens raises cost per request by 26% in the example budget.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/04-model-client
```
