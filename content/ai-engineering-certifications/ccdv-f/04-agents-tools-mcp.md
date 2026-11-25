# Agents, workflows, tools & MCP

About a quarter of CCDV-F: agents and workflows (14.7%) plus tools and MCP (10.6%). Expect questions that ask for the simplest design that works.

## Workflows or agents

- A **workflow** follows code paths you define; the model fills in steps. An **agent** decides its own steps and tool calls in a loop.
- Start with the simplest thing that works: a single call, then a workflow, and an agent only when the steps cannot be known in advance.

| Pattern | How it works | Fits |
| --- | --- | --- |
| Prompt chaining | Each call works on the previous call's output, with checks between steps | Fixed multi-step tasks, such as outline → draft → translate |
| Routing | A first call classifies the input and sends it to a specialised path | Mixed traffic, such as billing versus technical questions |
| Parallelization | Independent subtasks run at the same time, or several attempts vote | Speed, or confidence through agreement |
| Orchestrator-workers | A coordinator splits the task dynamically and combines the results | Tasks whose subtasks cannot be predicted |
| Evaluator-optimizer | One call produces and another critiques, in a loop | Work with clear quality criteria, such as translations or test plans |

## The agent loop over the API

1. Send the messages and your tool definitions.
2. While `stop_reason` is `tool_use`, run each requested tool and reply with `tool_result` blocks that carry the matching `tool_use_id`.
3. Stop on `end_turn`, and keep an iteration cap as a safety net.

When Claude asks for several tools in one response (**parallel tool use**), run them and return all the results together in the next user message.

## Tools

- A definition has a **name**, a **description** (the model's main signal for choosing a tool) and an **input_schema** in JSON Schema.
- `tool_choice`: `auto` lets Claude decide, `any` forces some tool, `{"type": "tool", "name": ...}` forces a specific tool, and `none` blocks tools.
- Return failures as a `tool_result` with `is_error` and a useful reason. An empty success hides the failure.
- Give each agent only the tools its job needs. Selection gets worse as the tool list grows, and least privilege limits the damage from a bad call.
- **Server tools** such as web search, web fetch and code execution run on Anthropic's side. **Client tools** run in your code.

## MCP

- MCP servers expose **tools** (actions), **resources** (data read as context) and **prompts** (reusable templates).
- Transports: **stdio** for a local server started as a process, **Streamable HTTP** for a remote server.
- Through the Messages API you can connect remote MCP servers directly, without writing a client for each one.
- Keep credentials in environment variables or a secret store, never in a committed configuration file.

## Harnesses

- The **Claude Agent SDK** gives you the agent harness behind Claude Code as a library, with its tools, context handling and hooks.
- **Claude Managed Agents** runs the harness for you on Anthropic's infrastructure: define an agent once, start sessions in an environment, and drive them through events. It fits long-running and asynchronous work.
- Your own loop on the Messages API gives the most control, for example approval gates and custom logging between steps.

## Worked example

A support assistant has to answer billing and technical questions, and only billing needs the refund tool. Routing fits better than one big agent: a Haiku-tier classifier routes each question, and the billing path alone gets the refund tool, behind an approval step for amounts above a threshold.

## One trace, four outcomes

Given read-job → history-error, expected status is error with both event IDs. Given read-job only and no completion event, expected incomplete. If the next event exceeds max_steps, return budget with evidence already observed. Given validated finish, return done. Use `trace_outcome` fixtures to distinguish these outcomes. Tool descriptions and strict argument validation do not replace server-side authorization; an agent harness owns state, retries, cancellation, budgets and recovery.
