# Designing tools for agents

A tool is the only way an agent can act on the world, and the tool definition is the only thing the model knows about that action. The model reads the name, the description and the argument schema, and decides from them alone when to call the tool and with what. Designing tools is therefore part interface design and part prompt writing.

This chapter covers how to define tools, constrain their arguments, shape their results and errors, handle side effects and retries, and decide how many tools an agent should have. How to test tool definitions and individual calls is covered in [Evaluating agents and tool use](/learn/llm?topic=agent-testing&section=testing-tool-definitions-and-calls).

**Prerequisites:** [How an AI agent works](/learn/agentic?topic=how-agents-work).

## What a tool definition is

Provider APIs and the Model Context Protocol describe a tool the same way: a name, a description and a JSON Schema for the arguments. Here is a real one, the vacancy search tool of the GimmeJob MCP server:

```json
{
  "name": "search_jobs",
  "description": "Search GimmeJob vacancies through the canonical RAG pipeline, with optional source, status, and remote filters.",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["query"],
    "properties": {
      "query": { "type": "string", "minLength": 1, "maxLength": 500, "description": "Natural-language vacancy search." },
      "limit": { "type": "integer", "minimum": 1, "maximum": 25, "default": 10 },
      "remote": { "type": "boolean" },
      "source": { "type": "string", "minLength": 1, "maxLength": 100 },
      "status": { "type": "string", "minLength": 1, "maxLength": 100 }
    }
  }
}
```

The model sees this text and nothing else: not the code behind it, not the database, not the other teams' conventions. Every gap in the definition is filled by a guess.

## Names and descriptions are prompts

Write a tool description the way you would brief a new colleague: what the tool does, when to use it, when not to, and what the arguments mean, including formats and units.

| Weak | Better | Why |
|---|---|---|
| `search` | `search_jobs` | Names a resource; avoids clashing with `search_docs` from another server |
| `user` | `user_id` | Says that an identifier is expected, not a name or an e-mail |
| "Gets data." | "Returns open vacancies matching a natural-language query. Use it before analyze_vacancy to find a job_id." | Says what comes back and how the tool fits with others |
| `date` | `posted_after` with "ISO 8601 date, e.g. 2026-11-01" | Removes guessing about format and meaning |
| `status` (free text) | `status` with an `enum` of allowed values | The model cannot invent a value that does not exist |

When several servers are connected, tool names compete with each other. Prefixing by service or resource (`jobs_search`, `jobs_analyze`) keeps choices unambiguous. Descriptions are worth iterating on like any other prompt: small wording changes can move how often the right tool is chosen.

The GimmeJob definition above is a fair starting point with room to improve. Its description says what the tool does but not when to prefer it, and `status` and `source` are free strings, so the model has to guess their values. An `enum` for each, and one sentence on how the tool relates to `analyze_vacancy`, would remove both guesses.

## Constrain arguments with a schema

The schema is your first line of defence against bad calls. Use the keywords that turn a guess into an error:

- `required` for arguments the tool cannot work without;
- `enum` for closed sets of values;
- `minimum`, `maximum`, `minLength`, `maxLength` and `pattern` for ranges and formats;
- `additionalProperties: false`, so an invented argument is rejected instead of silently ignored.

Some provider APIs offer a strict mode that makes the model's output match the schema. It helps, but validate on the server anyway: a client may not use strict mode, a schema keyword may be unsupported, and a call that matches the schema can still have a value that is wrong for this request. Return validation problems in words the model can act on:

```python
SEARCH_JOBS_SCHEMA = {
    "required": ["query"],
    "properties": {
        "query": {"type": "string", "maxLength": 500},
        "limit": {"type": "integer", "minimum": 1, "maximum": 25},
        "remote": {"type": "boolean"},
    },
}

PY_TYPES = {"string": str, "integer": int, "boolean": bool}

def validate_arguments(schema, arguments):
    errors = []
    for name in schema["required"]:
        if name not in arguments:
            errors.append(f"'{name}' is required.")
    for name, value in arguments.items():
        rule = schema["properties"].get(name)
        if rule is None:
            allowed = ", ".join(schema["properties"])
            errors.append(f"Unknown argument '{name}'. Allowed: {allowed}.")
            continue
        expected = PY_TYPES[rule["type"]]
        if isinstance(value, bool) and expected is int:
            errors.append(f"'{name}' must be an integer, got a boolean.")
        elif not isinstance(value, expected):
            errors.append(f"'{name}' must be a {rule['type']}.")
        elif expected is int and not rule["minimum"] <= value <= rule["maximum"]:
            errors.append(f"'{name}' must be between {rule['minimum']} and {rule['maximum']}, got {value}.")
        elif expected is str and len(value) > rule.get("maxLength", 10_000):
            errors.append(f"'{name}' is longer than {rule['maxLength']} characters.")
    return errors

for call in [
    {"query": "Senior QA Python", "limit": 10},
    {"limit": 100, "city": "Kyiv"},
    {"query": "Playwright", "remote": "yes"},
]:
    problems = validate_arguments(SEARCH_JOBS_SCHEMA, call)
    print("OK" if not problems else "isError: " + " ".join(problems))
```

A production server would use a schema library instead of this hand-written check (the GimmeJob server uses Zod with strict objects), but the principle is the same: reject unknown arguments, enforce ranges, and say exactly what to change.

## Return what the model needs

A tool result goes straight into the model's context, where it competes with the task for attention. Return the smallest result that lets the model take its next step.

- **Prefer meaningful fields over raw records.** A title, a company and a status help the next decision; internal flags and audit columns do not.
- **Use identifiers the model can carry.** Short, readable ids are copied correctly more often than long opaque ones.
- **Cap and page large results.** Return the first page with a total count and a cursor, and say in the result how to get more.
- **Offer a concise and a detailed mode** when one caller needs a list and another needs the full text.
- **Return structured data and text together.** MCP results can carry `structuredContent` for programs and a text block for the model. The specification asks servers that return structured content to include the same JSON as text.

| Result field | Keep? | Reason |
|---|---|---|
| `id`, `title`, `company`, `status` | Yes | Needed to choose and to call the next tool |
| `description` | Truncated | Useful, but long; the GimmeJob tool caps it at 4,000 characters |
| `retrievalScore` | Optional | Helps the model weigh results; noise for most tasks |
| Internal row timestamps, raw JSON blobs | No | Tokens without information for the task |

## Errors the model can recover from

An error message is an instruction for the next step. Compare:

| Unhelpful | Actionable |
|---|---|
| `Error 400` | `'limit' must be between 1 and 25, got 100.` |
| `Not found` | `No vacancy with id 'job_9'. Use search_jobs to find current ids.` |
| A stack trace | `The vacancy source did not respond in 10 s. Try again later or search without 'source'.` |

MCP separates two kinds of failure. A **protocol error** is a JSON-RPC error for a request the server cannot process at all, such as an unknown tool. A **tool execution error** is a normal result with `isError: true` and a message, for failures the model can do something about, including invalid argument values. The 2025-11-25 revision of the specification states explicitly that input validation errors belong in the second group, because only a tool result reaches the model and lets it correct the call. The GimmeJob server follows this: an unknown tool name returns JSON-RPC error `-32602`, and invalid arguments return an `isError` result that lists what is wrong.

## Read tools, write tools and side effects

Borrow the vocabulary of HTTP. A **safe** operation only reads. An **idempotent** operation can be repeated with the same effect as running it once. Classify every tool, because the classification decides how you retry it and whether a human must confirm it.

| Kind | Example | Retry | Confirmation |
|---|---|---|---|
| Read | `search_jobs`, `lookup_order` | Freely, with backoff | Not needed |
| Idempotent write | "set status of job X to APPLIED" | Yes, same effect | Depends on impact |
| Non-idempotent write | "send e-mail", "create ticket" | Only with an idempotency key | Usually needed |
| Destructive | "delete branch", "refund payment" | No automatic retry | Always |

Two techniques make writes safer. An **idempotency key** chosen by the caller lets the server recognise a retried request and apply it once. A **preview or dry-run** mode returns what would happen without doing it, so a person, or a check in code, can approve the real call.

Be careful with tools that look like reads. In GimmeJob, `analyze_vacancy` returns an analysis, but it also stores that analysis in the database and may call a paid model API. That makes it a write with a cost, and it should be treated as one when deciding retries and limits.

MCP lets a server describe tool behaviour with hints, and earlier revisions defined annotations such as read-only and destructive. The specification is clear that clients must treat these as untrusted unless the server itself is trusted. Decide permissions and confirmations in the host, not from the tool's own description. How to test approval gates and permissions is in [Safety: permissions and approvals](/learn/llm?topic=agent-testing&section=safety-permissions-and-approvals).

## Timeouts, retries and limits

Tools call networks, databases and other models, so they fail and they hang. Decide the behaviour in code, per tool:

- **Timeout every call.** A tool that never returns blocks the whole loop.
- **Retry only what is safe to repeat.** Reads and idempotent writes can be retried with exponential backoff and jitter; other writes need an idempotency key or no retry at all.
- **Avoid layered retries.** If the HTTP client, the tool and the agent loop each retry three times, one failure can become 27 calls. Pick one layer.
- **Enforce limits the model cannot override.** Maximum page size, maximum calls per run and maximum spend belong in the application, not in the prompt.
- **Report retries in the result.** "Succeeded after 2 retries" tells the model, and you, that the dependency is unhealthy.

## How many tools

More tools do not make an agent more capable. Each tool adds text to every request and another option to choose from, and overlapping tools make choices worse. Build a few tools that match whole tasks instead of mirroring every endpoint of an API.

| Endpoint-shaped tools | Task-shaped tool |
|---|---|
| `list_jobs`, `get_job`, `get_company`, `get_salary` | `search_jobs` returning title, company, salary and status together |
| `list_test_runs`, `get_run`, `get_failures`, `get_logs` | `summarize_failed_run(run_id)` returning failures with the relevant log lines |

A useful check is to give the agent realistic tasks and read the traces. Tools it never uses, tools it confuses with each other, and long chains of calls that could be one call all show where the tool set should change.

## Case study: the GimmeJob MCP tools

The GimmeJob server exposes four tools. Together they cover a narrow task, finding vacancies and preparing for them, which is a good shape for an agent's tool set.

| Tool | Purpose | Limits | Side effects |
|---|---|---|---|
| `search_jobs` | Semantic vacancy search with filters | `limit` 1 to 25, query up to 500 characters | None |
| `get_interview_questions` | Search the public interview catalog | `limit` 1 to 25 | None |
| `get_learning_progress` | Read the user's private progress and matching learning material | `limit` 1 to 15 | None, but returns private data |
| `analyze_vacancy` | Analyse one stored vacancy and suggest preparation | One `job_id` per call | Stores the analysis; may call a paid model |

What it does well: every schema sets `additionalProperties: false` and explicit ranges, the server validates again with strict schemas, validation problems come back as `isError` results, and results carry both JSON text and `structuredContent`. What could be better is mostly in the descriptions: closed value sets as `enum`s, and a sentence in each description on when to use the tool and which tool comes next. The next chapter looks at the same server from the protocol side: [Model Context Protocol](/learn/agentic?topic=model-context-protocol).

## Common mistakes

- **Mirroring an API one endpoint per tool.** The agent spends steps stitching data that one task-shaped tool could return.
- **Vague names and descriptions.** `search`, `data` or `run` force the model to guess, and the guess changes between runs.
- **Free strings for closed sets.** Without an `enum`, the model will eventually send a value that does not exist.
- **Trusting the schema alone.** Validate every call on the server and return actionable errors as tool results.
- **Huge results.** Full records, logs or pages of rows crowd out the task; cap, truncate and page.
- **Retrying writes blindly.** A retried "send e-mail" sends two e-mails unless an idempotency key prevents it.
- **Treating annotations as permissions.** A tool calling itself read-only is a hint; the host decides what is allowed.

## Summary

The model knows a tool only through its name, description and schema, so write them as carefully as a prompt and as precisely as an interface. Constrain arguments with `required`, `enum`, ranges and `additionalProperties: false`, and validate again on the server. Return small, meaningful results and error messages that say what to do next; in MCP, invalid arguments are tool execution errors, not protocol errors. Classify every tool as a read, an idempotent write, a non-idempotent write or a destructive action, and let that decide retries and confirmations. Prefer a few task-shaped tools over many endpoint-shaped ones.
