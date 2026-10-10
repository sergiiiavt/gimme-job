You cannot test well what you do not understand how to build. This chapter walks through the parts of a typical LLM application and gives every part a testing seam: a place where you can observe, control or replace behaviour.

By the end you will have a small **support bot** as your system under test. It does retrieval over a folder of documents and calls one tool. Every later chapter tests that same bot.

## 1. The anatomy of an LLM feature

A production LLM feature is mostly ordinary software around one non-deterministic call:

```text
user input
  -> input validation and guardrails
  -> context assembly (system prompt, history, retrieved documents, tool definitions)
  -> model call (provider SDK, parameters, retries, timeouts)
  -> output parsing and validation (schema, policy checks)
  -> tool execution loop (optional)
  -> post-processing, rendering, logging, tracing
  -> user
```

Only the model call is probabilistic. Everything else can and should be tested with normal deterministic tests. A common mistake is to evaluate the whole pipeline end to end with an LLM judge while basic parsing and validation code has no unit tests.

## 2. Prompts are code

A prompt is executable configuration. Treat it like code:

- store prompts in version-controlled files, not inline string literals scattered in the codebase;
- give each prompt an identifier and a version;
- review prompt diffs in pull requests;
- record the prompt version in logs and traces;
- run evals before merging a prompt change.

Core prompt-engineering techniques you must recognise when testing:

| Technique | Purpose | Typical bug |
|---|---|---|
| System prompt / role | Sets persona, rules and boundaries | Rules ignored in long conversations |
| Clear delimiters (XML tags, fenced sections) | Separates instructions from data | User data that contains the delimiter breaks the structure |
| Few-shot examples | Shows the expected format and judgement | The model copies example content into real answers |
| Step-by-step reasoning | Improves multi-step tasks | Reasoning leaks into user-facing output; longer latency |
| Output format instructions | Requests JSON, Markdown, length limits | Format followed most of the time, not always |
| Prompt templates with variables | Reuse with dynamic input | Missing or unescaped variables, injection through variables |

## 3. Structured output

Free text is hard to test. Wherever the application consumes model output programmatically, require **structured output**:

- provider JSON mode or schema-constrained output where available;
- a schema in code (for example Pydantic in Python or Zod in TypeScript);
- strict validation of every response, with a clear failure path.

```python
from pydantic import BaseModel, Field

class TicketTriage(BaseModel):
    category: str = Field(pattern="^(billing|technical|account|other)$")
    priority: int = Field(ge=1, le=4)
    summary: str = Field(max_length=280)
    needs_human: bool
```

Testing implications:

- schema validity becomes a cheap deterministic assertion on every eval case;
- test the application's behaviour when validation fails: retry, fallback, error message;
- check enum drift ("Billing" vs "billing"), missing optional fields and extra fields.

## 4. Tool calling (function calling)

The model does not run code. It returns a request such as "call `get_order_status` with `{"order_id": "A-1042"}`". Your application executes the tool and sends the result back as a new message.

Testing seams in a tool call:

- **Selection:** did the model choose the right tool, or a tool at all?
- **Arguments:** are they schema-valid and semantically correct?
- **Execution:** does the tool handle invalid, missing or malicious arguments safely?
- **Result handling:** does the model use the tool result faithfully, including errors and empty results?
- **Authorization:** can the tool act only for the current user? The model's request is untrusted input.

## 5. Retrieval-augmented generation (RAG)

RAG gives the model fresh or private knowledge at request time:

```text
offline:  documents -> chunking -> embeddings -> vector index
online:   question -> (rewrite) -> retrieve top-k chunks -> (rerank) -> prompt with context -> answer with citations
```

Every arrow is a test target. Chapter 5 tests RAG in depth. For now, build the simplest version:

1. split Markdown files into chunks by heading;
2. embed each chunk and store it in a local vector store (Chroma, pgvector, or an in-memory list);
3. retrieve the top 4 chunks by cosine similarity;
4. instruct the model to answer only from the provided context and to cite chunk IDs.

## 6. Agents and the Model Context Protocol

An **agent** is a loop in which the model decides the next action, observes the result and continues until it decides it is done:

```text
while not done and steps < limit:
    decision = model(context)
    if decision is a tool call: run tool, append result
    else: done = True
```

Agents add new risks: unbounded loops, compounding errors, cost spikes and real-world side effects. Chapter 6 covers agent testing. See also [AI agents & MCP](/learn/agentic).

The **Model Context Protocol (MCP)** is an open protocol for exposing tools, resources and prompts to LLM applications through MCP servers. From a testing view, an MCP server is an API with a contract: tool schemas, error behaviour and permission boundaries.

## 7. The provider call: reliability concerns

The model call is a remote dependency. Test it as one:

- timeouts and retries with backoff on rate limits (HTTP 429) and server errors;
- streaming responses: partial output, interrupted streams, client disconnects;
- token limits: input too long, output truncated;
- provider outages and fallback models;
- cost and token accounting.

## 8. Mocking the model in unit tests

Unit tests must be fast, free and deterministic. Do not call a real model in them.

Options:

| Approach | How | Use for |
|---|---|---|
| Fake client | Inject a client that returns scripted responses | Parsing, routing, retry logic, tool loop control |
| Record and replay | Record real HTTP interactions once, replay them in tests (for example vcrpy cassettes) | Regression tests of integration code |
| Contract fixtures | Store real provider response shapes as JSON fixtures | Testing SDK upgrades and edge cases such as tool calls and refusals |

```python
class FakeLLM:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def complete(self, messages, **params):
        self.calls.append({"messages": messages, "params": params})
        return self.responses.pop(0)


def test_invalid_json_triggers_one_retry_then_fallback():
    llm = FakeLLM(["not json", "still not json"])
    result = triage_ticket("My card was charged twice", llm=llm)
    assert result.category == "other"
    assert result.needs_human is True
    assert len(llm.calls) == 2
```

Mocks test **your code**, not the model's quality. Model quality is the job of evals (chapters 3–5).

## 9. Case study: GimmeJob's AI service

The GimmeJob Learning Path Advisor is a real example of this anatomy. It is in the `ai-service` directory of this repository:

- **FastAPI** exposes the HTTP endpoints;
- **LangGraph** owns orchestration as an explicit workflow: contextualize the conversation, retrieve, choose grounded or general composition, then verify source attribution and map connectivity;
- **LangChain** handles the model, messages and structured output;
- retrieval goes to one canonical RAG pipeline in the Cloudflare Worker, with Vectorize for semantic search and a lexical fallback;
- **Langfuse** records traces, retrieved IDs, token usage and deterministic quality scores.

Notice the testing seams: the workflow steps are explicit, retrieval is a separate service with its own metrics, and output is structured and verified before it reaches the user. The Python tests in `ai-service/tests` cover these steps separately.

## 10. QA quick reference

- Draw the pipeline before testing it. Mark which steps are deterministic.
- Unit-test every deterministic step with a fake model.
- Validate every structured output against a schema.
- Treat model tool requests as untrusted input.
- Version prompts and log the version with every call.
- Test timeouts, 429s, truncated streams and provider fallback.

## 11. Practice

Build the system under test for the rest of the path.

1. Create a folder of 15–30 Markdown documents for a fictional product: pricing, refunds, shipping, account management.
2. Build a support bot that retrieves the top 4 chunks and answers with citations.
3. Add one tool, `get_order_status(order_id)`, backed by a fake in-memory order table.
4. Return structured output: `answer`, `citations`, `used_tool`, `needs_human`.
5. Write offline unit tests with a fake model for parsing, tool routing and retry behaviour.

**Exit check:** the bot runs end to end against a real model, and its unit tests pass with the network disabled.

## Sources

- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Pydantic documentation](https://docs.pydantic.dev/)
- [vcrpy — record and replay HTTP interactions](https://github.com/kevin1024/vcrpy)
- [GimmeJob — learning content discovery and canonical RAG](https://github.com/sergiiiavt/gimme-job/blob/main/docs/LEARNING-RAG.md)
