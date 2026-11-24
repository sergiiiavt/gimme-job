# Model selection & optimisation

About 17% of CCDV-F: pick the right model, then make it cheaper and faster without losing quality. Most questions give you a cost, latency or volume constraint and ask for the best lever.

## Model tiers

| Tier | Choose it for |
| --- | --- |
| Opus | The hardest reasoning and long agentic coding, where quality outweighs cost |
| Sonnet | The balanced default for most production applications |
| Haiku | Fast, high-volume work: routing, classification, extraction, cheap subagents |

- Decide with an evaluation set, not by reputation. Run the same real examples through two tiers and take the cheapest that meets your bar.
- A common pattern pairs a stronger coordinator with Haiku-tier workers, and escalates only ambiguous items to a larger model.
- Pin a specific model version in production so behaviour does not shift under you, and re-run your evaluation set before upgrading.

## Prompt caching

- Mark stable blocks with `cache_control`. The cache matches an exact prefix in the order **tools, system, messages**.
- Put stable content first, such as tool definitions, the system prompt and reference documents. Put anything that varies, such as a timestamp, a user's name or the question, after the last breakpoint.
- The default cache lifetime is 5 minutes, and cached reads cost a fraction of normal input tokens.
- A near-zero hit rate almost always means something variable sits before the breakpoint.

## Message Batches

- Batches cost half as much as synchronous calls and return results within 24 hours.
- Each request carries a `custom_id` so you can match results back, and results stay available for 29 days.
- There is no latency guarantee, so never put batches on a path a user or a merge waits on.
- Resubmit only the failed items, identified by `custom_id`.

## Tokens and latency

- The **token-counting** endpoint estimates the input size and cost before you send, and checks that a request fits the context window.
- **Streaming** does not make the full answer faster, but the first words appear sooner, which is what users notice.
- To make answers genuinely faster: a smaller model, a lower `max_tokens`, shorter requested outputs, fewer round trips, and independent calls run in parallel.
- **Extended thinking** improves hard multi-step reasoning at the cost of tokens and time. Leave it off for classification and formatting.

## Choosing the lever

| Constraint | First lever |
| --- | --- |
| A large repeated system prompt is expensive | Prompt caching |
| A nightly job over 100,000 documents | Message Batches on a smaller tier |
| Users complain the UI feels slow | Streaming, then a smaller model or shorter outputs |
| Quality drops on rare, hard cases | Route only those cases to a bigger model |
| Requests sometimes exceed the context window | Count tokens, trim or chunk the input |
