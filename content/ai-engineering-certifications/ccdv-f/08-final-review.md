# Final review

## The meta-rule

When an option makes the system **deterministic, measurable or scoped**, it usually beats an option that asks the model to try harder. Code checks beat prompt wording, evaluation beats intuition, and least privilege beats warnings.

## High-yield distinctions

- **Retry or fix:** retry selected transient 429, 529 and 5xx only when replay-safe and within attempt/deadline budgets, with backoff and jitter; fix 400; check the key for 401 and 403.
- **Stop reasons:** max_tokens means cut off, tool_use means run the tool, pause_turn means send it back, and refusal means show a fallback.
- **Streaming vs batches:** streaming improves perceived latency for users; batches halve cost for work nobody waits on.
- **Caching:** an exact prefix of tools, system and messages; anything variable goes after the last breakpoint.
- **Tiers:** Haiku for bulk and routing, Sonnet as the default, Opus for the hardest reasoning; decide with an evaluation set.
- **Workflow vs agent:** use a workflow when the steps are known and an agent when they are not; start simple.
- **Tool errors:** is_error with a reason, never an empty success.
- **Schema vs validation:** a schema fixes the shape; code validates the meaning.
- **Injection:** treat content as data, scope the tools, and gate irreversible actions.
- **Evaluation:** a regression set on every change, reported by segment.

## Distractors to expect

1. "Use a bigger model" when the cause is a setting, a description or missing validation.
2. "Retry" for errors that will never succeed unchanged.
3. "Add a line to the prompt" when the rule needs enforcement in code.
4. "Batch it" for work a person is waiting on.
5. "Look at the overall average" when one segment is failing.
6. "Build an agent" when routing or a chain is enough.
