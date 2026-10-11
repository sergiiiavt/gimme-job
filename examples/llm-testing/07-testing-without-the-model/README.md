# Testing LLM code without the model

Chapter: [Testing LLM code without the model](https://gimme-job.com/learn/llm?topic=testing-without-the-model)

A small support assistant built around an injected model client, and a test suite that covers its deterministic behaviour without calling any model.

| File | Content |
|---|---|
| `assistant.py` | `SupportAssistant`: input guardrail, context assembly, model call, tool loop with a round limit, stop-reason handling, usage accounting, event log |
| `context.py` | `build_messages`: keeps the system prompt and the newest turns within a token budget |
| `tools.py` | Tool router: unknown tools, invalid arguments and foreign orders are rejected; identity comes from the session |
| `doubles.py` | Dummy, stub, scripted stub, spy, mock, fault injector and fake model clients |
| `contracts.py` | Normalizes OpenAI chat and Anthropic message bodies into one `Reply` |
| `http_client.py` | Minimal client for an OpenAI-compatible endpoint (for record and replay) |
| `fixtures/contracts/*.json` | Response bodies in the documented provider shapes: text, tool calls, truncation, content filter, refusal |
| `cassettes/refund_question.yaml` | A recorded HTTP exchange (credentials filtered) replayed with vcrpy |
| `snapshots/system_prompt.txt` | Reviewed snapshot of the rendered system prompt |
| `test_without_the_model.py` | 31 tests: every double, tool use and authorization, Hypothesis invariants for context assembly, snapshot, contracts, replay, credential scan |

Key ideas shown by the tests:

- Inject the client; then a dummy proves a path never calls the model, a spy shows exactly what was sent, a mock verifies the number of calls, a fault injector exercises the timeout path.
- Incomplete, blocked or unknown replies are never delivered as answers; endless tool requests stop at a round limit.
- A model cannot read another customer's order, even if it passes a `user_id` itself.
- Context assembly keeps its invariants for any generated conversation.
- Replayed traffic matches on the request body and contains no credentials.

Update the prompt snapshot after reviewing a deliberate change:

```bash
UPDATE_SNAPSHOTS=1 uv run --project examples/llm-testing pytest examples/llm-testing/07-testing-without-the-model -k snapshot
```

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/07-testing-without-the-model
```
