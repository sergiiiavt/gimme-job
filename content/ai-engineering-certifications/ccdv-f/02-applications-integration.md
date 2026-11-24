# Applications & integration

A third of CCDV-F: how a request is built, how responses arrive, why they stop, and how to handle failures. Expect scenarios in which a working prototype breaks in production.

## Request shape

`POST /v1/messages` needs `model`, `max_tokens` and `messages`, plus the `x-api-key` and `anthropic-version` headers. The system prompt is the top-level `system` parameter, never a message with a system role. `messages` holds alternating user and assistant turns, and each turn's content can be text or blocks such as images, documents, tool calls and tool results.

The response carries `content` blocks, a `stop_reason` and `usage` with the input and output token counts. Log `usage` on every call; it is your cost record.

## Streaming

Server-sent events arrive in order: `message_start`, `content_block_start`, repeated `content_block_delta`, `content_block_stop`, `message_delta` (carrying the stop reason and usage), and `message_stop`. Stream long outputs to avoid HTTP timeouts and to show progress to users. The official SDKs assemble the events into a final message for you.

## Stop reasons

| `stop_reason` | Meaning | What your code does |
| --- | --- | --- |
| `end_turn` | The model finished | Use the answer |
| `max_tokens` | Output hit your limit and was cut off | Raise the limit or ask for less; never parse a cut-off JSON |
| `stop_sequence` | A configured stop sequence was produced | Continue your own logic |
| `tool_use` | The model wants a tool run before it continues | Run the tool, send a `tool_result` |
| `pause_turn` | A long server-side tool turn paused | Send the response back to let it continue |
| `refusal` | The model declined for safety reasons | Show a safe fallback; do not retry blindly |

## Errors and retries

- Retry **429** (rate limit), **529** (overloaded) and **5xx** errors with exponential backoff and jitter, honouring `retry-after`.
- Never retry a **400** unchanged; it means the request itself is wrong, so fix it.
- **401 and 403** are key or permission problems; retrying will not help.
- Rotating keys to dodge a rate limit is not a strategy. Request higher limits, smooth traffic or move bulk work to batches.
- The official SDKs retry transient errors automatically; know their defaults before adding your own retry layer on top.

## Platforms

The same model families run on the Claude API, Amazon Bedrock and Google Vertex AI. Model IDs, authentication and the timing of new features differ by platform, so check that a feature is available on the platform you target before designing around it.

## Integration patterns

- **Synchronous request** for anything a user is waiting on.
- **Streaming** for long answers in a UI.
- **Message Batches** for large offline jobs where nobody waits; see the next chapter.
- **Idempotent job records** so that a retried request never double-charges or double-writes.
- **Timeouts at every layer**, longer than the model needs for your max_tokens, with streaming for anything slow.

## Worked example

A job-description summariser works in testing but fails in production on long postings: some responses are cut off and some requests time out. The cause is two settings, not the model. `max_tokens` is too low for long inputs, so check `stop_reason` and raise it or ask for a shorter summary. A non-streaming call over a slow connection exceeds the HTTP timeout, so stream it.
