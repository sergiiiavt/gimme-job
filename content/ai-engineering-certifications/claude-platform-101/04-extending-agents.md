# Extending your agent

The third and fourth sections of Claude Platform 101: reach beyond your own code, keep long-running agents inside the context window, and let Anthropic run the loop for you.

## Built-in tools

Some tools run on Anthropic's infrastructure, so you add them to the request without implementing them yourself:

- **Web search** finds current information, with citations.
- **Web fetch** reads the content of a specific URL.
- **Code execution** runs code in a sandbox, for calculations, data analysis and file work.

Your own tools (client tools) run in your code. Built-in tools (server tools) run on Anthropic's side, and their results come back in the same response.

## Skills

Skills package a procedure once, as instructions plus scripts and resources, and reuse it across calls. Claude loads a skill only when the task needs it. On the API, skills run with the code execution tool.

## MCP

The Model Context Protocol connects Claude to third-party tools and data through MCP servers. A server exposes **tools** (actions), **resources** (data to read as context) and **prompts** (reusable templates). Connecting an existing MCP server saves writing a tool schema for every action yourself.

## Context management

A long-running agent fills its context window with old tool results until it gets slow, expensive or hits the limit. The patterns the course teaches:

- **Trim tool output** to the fields the agent needs before returning it.
- **Clear or summarise old turns** (compaction) and keep the facts that must survive, such as IDs, amounts and decisions, in a pinned block.
- **Cache the stable prefix**, the tools and system prompt, with prompt caching so repeated calls cost less.
- **Count tokens** before sending when you are close to the limit.

## Managed agents

Claude Managed Agents is a pre-built agent harness that runs on Anthropic's infrastructure. You define the agent once (model, system prompt, tools, MCP servers and skills) and reference it by ID. Each **session** runs that agent in an **environment**, a sandbox where Claude can run commands and read and write files. You communicate through **events**: send a user message, stream the agent's events back, and answer when it pauses for input. Sessions are stateful and keep their history and sandbox state on the server.

| Run your own loop with the Messages API when | Use Managed Agents when |
| --- | --- |
| You need fine-grained control of every step | The task is long-running or asynchronous |
| Tools must run inside your own systems | You want a sandbox, file handling and state without building them |
| Latency per step matters most | You would otherwise build your own agent runtime |

## Building with Claude Code

The course ends by using Claude Code to build against the API: describe the integration, let Claude Code scaffold it, then run and test it. The same review rules apply as for any generated code: read the diff, and run it against real examples before you trust it.
