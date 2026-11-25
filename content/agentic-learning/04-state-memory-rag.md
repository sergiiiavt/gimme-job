# State, memory and RAG

A language model remembers nothing between calls. Everything it knows during a call is the text you send in that call: instructions, tool definitions, the conversation, tool results and any documents you retrieved. What users experience as an agent's "memory" is application engineering: deciding what to keep, where to store it, and what to put back into the next request.

This chapter covers the context window as the model's only working memory, the kinds of state an agent has, how to keep long conversations inside a budget, retrieval as memory, long-term memory and its boundaries, and the GimmeJob Learning Path Advisor as a case study. How to test retrieval quality is covered in [Evaluating RAG systems](/learn/llm?topic=rag-testing).

**Prerequisites:** [How an AI agent works](/learn/agentic?topic=how-agents-work), [Embeddings and similarity](/learn/llm?topic=embeddings-similarity).

## The context window is the only memory

Every request assembles a context from several sources:

```diagram
System prompt (role, rules)          ─┐
Tool definitions                      │
Long-term memory you chose to load    ├──→  context window  ──→  model  ──→  answer or tool call
Documents retrieved for this turn     │
Conversation so far                   │
Tool results from earlier steps      ─┘
```

The window has a hard limit in tokens, but the practical limit is lower. Models use information at the start and end of a long input better than information in the middle, as the "Lost in the Middle" study showed, and Anthropic describes recall degrading as context grows. More context is therefore not free: each extra block costs money and latency and can push the important part out of focus.

The working rule is the one Anthropic calls context engineering: give the model the smallest set of high-signal tokens that lets it take the next step well.

## Four kinds of state

| State | What it holds | Lifetime | Where it usually lives | Main risk |
|---|---|---|---|---|
| Conversation | The turns of this session | One session | Client or server session store | Grows without bound |
| Working state | Plan, progress, intermediate results of the current task | One task | Agent runtime, files, a scratchpad | Lost on crash; stale after retries |
| Long-term memory | Facts that should survive sessions, such as user preferences | Weeks to forever | Database or memory store, per user | Wrong, stale or poisoned entries |
| Knowledge | Documents the agent can look up | As long as the source exists | Search index over the source of truth | Outdated index, irrelevant hits |

Keeping these apart is most of the design. A preference such as "answer in Ukrainian" is long-term memory; "we already checked the login test" is working state; a chapter about HTTP caching is knowledge. Each has a different owner, lifetime and deletion rule, and mixing them makes every one of them harder to reason about.

## Keeping a long conversation inside the budget

Sooner or later a conversation or a task outgrows the budget you want to spend per request. The common strategies:

| Strategy | How it works | Trade-off |
|---|---|---|
| Sliding window | Keep the system prompt and the most recent turns | Simple; forgets early facts |
| Summarization (compaction) | Replace old turns with a short summary | Keeps the gist; the summary can drop details or be wrong |
| Structured notes | The agent writes progress to a file or store and rereads it | Survives long tasks; needs discipline about format |
| Sub-agents | A helper explores in its own context and returns a condensed result | Main context stays small; more calls overall |
| Just-in-time retrieval | Keep references (ids, file paths) and fetch content only when needed | Little upfront context; extra tool calls |

A sliding window with a note about what was dropped is a reasonable default. The code below keeps the newest turns that fit a token budget and marks explicitly how many older messages were omitted. Token counts are approximated as one token per four characters; a real system would use the provider's tokenizer.

```python
def fit_history(system, turns, budget):
    # An estimator for plain-text teaching messages, not a provider tokenizer.
    def cost(message):
        return 4 + (len(message["content"]) + 3) // 4

    system_message = {"role": "system", "content": system}
    latest_user = next((i for i in range(len(turns) - 1, -1, -1)
                        if turns[i]["role"] == "user"), len(turns))
    # Keep the latest request and every following reply together.
    for dropped in range(latest_user + 1):
        kept = turns[dropped:]
        notice = ([{"role": "system", "content": f"{dropped} older messages omitted."}]
                  if dropped else [])
        history = [system_message, *notice, *kept]
        used = sum(cost(message) for message in history)
        if used <= budget:
            return history, used
    raise ValueError("Budget cannot hold the system, omission notice and latest request")

turns = [
    {"role": "user", "content": "I test a payments API. Which status codes matter most?"},
    {"role": "assistant", "content": "Start with 200, 201, 400, 401, 403, 404, 409, 422 and 5xx handling. " * 6},
    {"role": "user", "content": "How do I test idempotency keys?"},
    {"role": "assistant", "content": "Send the same request twice with one key and compare the effects. " * 4},
    {"role": "user", "content": "And retries after a timeout?"},
]
history, used = fit_history("You are a QA mentor.", turns, budget=160)
for turn in history:
    print(turn["role"], "|", turn["content"][:70])
print("tokens used:", used)
```

Whatever you drop, drop it deliberately and visibly. A silent cut is worse than a short summary, because the model will answer as if the missing turns never happened.

This estimator is for plain text. The omission notice counts against the budget; the latest user request is mandatory. An infeasible budget raises explicitly. In production use the provider tokenizer, reserve output tokens and preserve complete tool-call/result groups. Do not elevate an untrusted conversation summary into system instructions.

## Retrieval as memory

Retrieval-augmented generation (RAG) turns a large body of knowledge into a few relevant passages per request: split the sources into chunks, embed them, find the chunks closest to the query, and put those into the context with their source. For an agent, retrieval is the memory that does not fit in any window, and it can be a tool the agent calls when it decides it needs to look something up.

Three design decisions matter more than the choice of vector database:

- **The unit of retrieval.** Retrieve sections, not whole documents. On this site every Markdown `##` section of a learning chapter is its own retrieval document with its own deep link, so an answer can point at the exact section.
- **The query.** The latest user message is often a poor query. "And retries?" means nothing without the earlier turn about payments. Build the query from the conversation, not only from the last line.
- **The link back.** Store a canonical source for every chunk, so the answer can cite it and the application can check citations against what was actually retrieved.

Retrieval quality is measurable: recall of the relevant passages, precision of what you inject, and whether the final answer stays faithful to them. Those checks are covered in [Evaluating RAG systems](/learn/llm?topic=rag-testing).

## Long-term memory and its boundaries

Some products remember facts across sessions: a preferred language, a tech stack, the user's level. Long-term memory makes an agent feel personal, and it is also the easiest place to create privacy and security problems.

| Worth remembering | Do not store |
|---|---|
| Stable preferences ("answer in Ukrainian", "uses Playwright with TypeScript") | Secrets, tokens, passwords, personal identifiers |
| Facts the user stated about their own work | Guesses the model made about the user |
| Decisions that should not be relitigated | One-off details of a single task |
| Pointers to where something lives | Copies of documents that already have a source of truth |

Four rules keep memory safe:

- **Scope it to one user or tenant.** A memory written in one account must never be readable in another. Test this the same way you test any other data isolation.
- **Let the user see, correct and delete it.** Memory the user cannot inspect is memory the user cannot trust.
- **Never write memory straight from untrusted content.** If a web page or an e-mail the agent read can cause a memory entry, an attacker can plant instructions that persist into future sessions. This is indirect prompt injection with a long half-life.
- **Expire or revalidate.** Facts go stale; a memory with a date and a source can be checked, one without cannot.

## Case study: the Learning Path Advisor

The Advisor on the [AI Assistant](/ai-assistant) page recommends learning material from this site. It is a good example of keeping state simple.

```diagram
Browser keeps the conversation and sends it with every request
        ↓
Contextualize query: if the new message is a short follow-up, prepend the previous user turn (no model call)
        ↓
Retrieve: canonical RAG over the site's learning sections, up to 8 results, in the chosen language
        ↓
Route: repository answer if material was found, otherwise a general answer
        ↓
Compose the answer with the model, citing retrieved sources
        ↓
Verify grounding: drop any link that was not among the retrieved results
```

Design choices worth copying:

- **The service is stateless.** The conversation lives in the browser and arrives with each request, so there is no server-side session to leak, expire or lose. The cost is that the client sends the history every time.
- **Context building is deterministic and traced.** The follow-up rule is plain code: a message with four or fewer meaningful words is treated as a follow-up, and the previous user topic is prepended to the retrieval query. The trace shows exactly which branch was taken.
- **Retrieval is shared with the rest of the site.** The Advisor and the MCP server use one canonical RAG pipeline, so a new learning section becomes retrievable in both without separate registration.
- **The application checks the model's citations.** After the model writes its answer, code removes every source link that is not in the set of retrieved documents. The model cannot invent a link that survives to the user.

## Common mistakes

- **Sending everything every time.** Long contexts cost more, respond slower and bury the important part.
- **Dropping history silently.** Summarize or mark what was cut, or the model will contradict earlier turns.
- **Retrieving with the raw last message.** Short follow-ups need the conversation to become a useful query.
- **Retrieving whole documents.** Large chunks dilute relevance and make citations vague.
- **Mixing kinds of state.** Preferences, task progress and knowledge need different storage, lifetimes and deletion.
- **Writing memory from untrusted input.** Planted instructions then persist into future sessions.
- **Memory without per-user scope.** One user's memory appearing in another's session is a data leak.

## Summary

The model's only memory is the context you send, and a smaller, sharper context usually works better than a bigger one. Separate conversation, working state, long-term memory and knowledge, because each has its own owner, lifetime and risks. Keep long sessions inside a budget with deliberate trimming, summaries, notes or sub-agents. Use retrieval as the memory that does not fit, with section-level chunks, queries built from the conversation and canonical links. Treat long-term memory as user data: scoped, visible, deletable, and never written from untrusted content.
