# Applications & integration

A third of CCDV-F: how a request is built, how responses arrive, why they stop, and how to handle failures. Expect scenarios in which a working prototype breaks in production.

## Request shape

`POST /v1/messages` needs `model`, `max_tokens` and `messages`, plus the `x-api-key` and `anthropic-version` headers. The system prompt is the top-level `system` parameter, never a message with a system role. `messages` holds alternating user and assistant turns, and each turn's content can be text or blocks such as images, documents, tool calls and tool results.

The response carries `content` blocks, a `stop_reason` and `usage` with the input and output token counts. Record `usage` safely; calculate cost with the model, applicable rates and cache/batch categories, rather than treating token count as a currency bill.

## Streaming

Server-sent events arrive in order: `message_start`, `content_block_start`, repeated `content_block_delta`, `content_block_stop`, `message_delta` (carrying the stop reason and usage), and `message_stop`. Stream long outputs to avoid HTTP timeouts and to show progress to users. The official SDKs assemble the events into a final message for you.

## Stop reasons

| `stop_reason` | Meaning | What your code does |
| --- | --- | --- |
| `end_turn` | The model turn finished | Verify the application task and use the answer if complete |
| `max_tokens` | Output hit your limit and was cut off | Raise the limit or ask for less; never parse a cut-off JSON |
| `stop_sequence` | A configured stop sequence was produced | Continue your own logic |
| `tool_use` | The model wants a tool run before it continues | Run the tool, send a `tool_result` |
| `pause_turn` | A long server-side tool turn paused | Send the response back to let it continue |
| `refusal` | The model declined for safety reasons | Show a safe fallback; do not retry blindly |

## Errors and retries

- For selected transient **429**, **529** and **5xx** responses, retry only replay-safe work within attempt/deadline budgets. Use bounded exponential backoff and jitter, honour `retry-after`, and prevent layered SDK/application retries from multiplying.
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

A job-description summariser works in testing but fails in production on long postings: some responses are cut off and some requests time out. Check two plausible causes before attributing the problem to the model. `max_tokens` is too low for long inputs, so check `stop_reason` and raise it or ask for a shorter summary. A non-streaming call over a slow connection exceeds the HTTP timeout, so stream it.

## Retry and streaming failure matrix

400: repair input, no unchanged retry. 401/403: repair credentials/authorization. 429: wait within deadline for replay-safe work. 503/529: bounded retry if safe. Unknown payment timeout: reconcile the operation ID before replay; an SDK retry can otherwise duplicate effects. A stream may fail after partial output: retain diagnostic state, mark the response incomplete and do not parse partial JSON as a final record. Apply sanitized logging and avoid duplicating retries at several layers.
