# Agentic architecture & orchestration

The largest CCAR-F domain (27%). Questions describe a production agent misbehaving and ask for the most reliable fix, which is usually structural rather than a better prompt.

## The agent loop

An agent is a loop around the Messages API:

1. Send the conversation and the tool definitions.
2. If `stop_reason` is `tool_use`, run each requested tool.
3. Append the results as `tool_result` blocks, each matching its `tool_use_id`, in a user turn.
4. Call the API again. `end_turn` ends the model turn; separately verify the application task is complete.

Never decide that the task is done by parsing the model's text for phrases such as "I've resolved your issue". An iteration cap is a safety net against runaway loops, not the control that ends normal work.

## Coordinator and subagents

The hub-and-spoke pattern has a coordinator that decomposes the task, subagents that each work in an isolated context with a scoped tool set, and a synthesis step that combines results.

- **Context inheritance depends on the orchestration system.** Do not assume shared history. Anything a subagent needs, including earlier findings, must be passed in its prompt.
- **Independent subagents run in parallel** when the coordinator issues several subagent calls in one response.
- **Narrow decomposition is the classic failure.** If the task plan assigned only visual art and those workers completed their assignments, the report’s missing music/film/writing coverage started in the decomposition. Fix the decomposition, not the workers.

## Hooks: rules that must always hold

Prompts are probabilistic. When a business rule must hold every time, enforce it in code.

- A **PreToolUse** hook inspects a tool call before it runs and can block it, for example `process_refund` above a $500 cap, or any account change before identity is verified.
- A **PostToolUse** hook transforms a tool result before the model sees it, for example normalising three date formats to ISO 8601.

Use the prompt for judgment calls such as tone and which help article fits; use hooks and gates for limits, identity and irreversible actions.

## Escalation and handoff

Escalate to a human on explicit criteria:

- the customer asks for a person;
- the request falls outside documented policy;
- the agent cannot make progress.

Do not use sentiment or uncalibrated model self-confidence alone as a universal complexity signal; use explicit policy and validated evidence. Hand off with a structured summary: customer, issue, steps already tried, and a recommended next action, so the human does not start from zero.

## Sessions

Resume a named session to continue long work. **Fork** a session to branch conversation state. This does not isolate filesystem changes, credentials or external side effects. Starting fresh with a pasted summary loses detail; `/clear` throws the state away.

## Worked example

A support agent sometimes refunds $900 when policy caps refunds at $500. Capital letters in the system prompt, more examples or a larger model all improve the odds without guaranteeing the rule. The architect's answer is a PreToolUse hook that blocks the call above the cap and routes the case to a human with the context attached.

## Gate and handoff example

The model proposes send_application for tenant training, job-7, candidate-2. The server checks actor authorization and looks up approval for those exact arguments. A tenant change invalidates the approval; a model-produced approved=true is not authorization. In the offline exercise no message is actually sent. An error after reading the job returns status=error plus that partial evidence, not done. A PreToolUse hook can block matched tool calls; enforce backend limits independently and do not treat the hook as a filesystem sandbox.
