# First request & model choice

The first section of Claude Platform 101: what a request contains, what comes back, and how to pick a model on evidence instead of guessing.

## Chat versus building

A chat answers a question and the thread ends. An application sends Claude structured requests, gives it tools, lets it act on real systems, and runs that loop for one user or for a million. That is a different skill from prompting, and it is what the Claude Platform is for.

## Your first API call

A Messages API request is POST /v1/messages with:

- **Headers:** x-api-key with your key from the Claude Console, and anthropic-version.
- **model:** which Claude model answers.
- **max_tokens:** the most tokens the reply may use. A reply that hits it is cut off.
- **messages:** alternating user and assistant turns.
- **system** (optional): top-level instructions such as role, rules and format. It is a separate field, not a message.

The response holds:

- **content:** a list of blocks, such as text, a tool call, or thinking.
- **stop_reason:** why Claude stopped. end_turn means it finished, max_tokens means it hit your limit, and tool_use means it wants a tool run.
- **usage:** input and output token counts, which are what you pay for.

## Choosing the right model

| Tier | Strength | Typical use |
| --- | --- | --- |
| Opus | The most capable reasoning and long agentic work | Hard analysis, complex coding agents |
| Sonnet | Balanced capability, speed and cost | Most production features |
| Haiku | Fastest and cheapest | Classification, routing, high-volume extraction, cheap subagents |

The course's rule is to **measure, not guess**: run the same 10–20 real examples through two tiers and compare quality, latency and cost. Choose the cheapest model that passes your bar, and escalate only the hard cases to a bigger one.

## Keeping spend predictable

- **Workspaces** in the Claude Console separate projects, keys and usage.
- **Spend and rate limits** cap what a workspace can use, so a runaway loop cannot surprise you.
- **The Workbench** lets you try prompts and parameters in the Console before you write code.
- Set max_tokens deliberately, and log usage from every response.
