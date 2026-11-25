# Agent loop & tools

The second section of Claude Platform 101: how Claude acts, observes and decides, and how you give it tools.

## The agent loop

1. Send the conversation and your tool definitions.
2. If Claude needs a tool, the response has stop_reason tool_use and a **tool_use** block with an id, the tool name and its input.
3. Your code runs the tool.
4. You send back a user message with a **tool_result** block that carries the same tool_use_id and the output. If the tool failed, set is_error and describe the failure.
5. Repeat until stop_reason is end_turn.

The loop is driven by stop_reason, not by searching Claude's text for "done". Add a maximum number of iterations as a safety net.

## Defining a tool

A tool definition has:

- **name**, such as search_vacancies.
- **description**: what it does, when to use it, what it returns, and its limits. This is the model's main signal for choosing the tool, so most tool bugs are description bugs.
- **input_schema**: a JSON Schema for the arguments, with types, required fields and enums.

**tool_choice** controls whether Claude must use tools:

| Value | Effect |
| --- | --- |
| auto | Claude decides; this is the default when tools are present |
| any | Claude must call one of the tools |
| tool, with a name | Claude must call that specific tool |
| none | Claude may not call tools |

## Thinking

With extended thinking turned on, Claude reasons step by step in **thinking blocks** before its answer. It helps on multi-step problems such as debugging, planning and maths, at the cost of extra tokens and latency. Leave it off for simple lookups, classification and formatting.

## From hand-written loop to Tool Runner

The course has you write the loop by hand first, so you understand it. Then you replace it with the SDK's **Tool Runner**, which runs the loop, wraps errors and checks types for you. It is in beta in the official SDKs. Keep a manual loop when you need a human approval step, custom logging or conditional execution between tool calls.

## Worked example

"Find remote QA lead vacancies posted this week and summarise the top three."

1. Claude calls search_vacancies with role "QA lead", remote true and posted_within_days 7.
2. Your code returns 12 results as the tool_result.
3. Claude calls get_vacancy for the three best matches.
4. Claude answers with the summary, and stop_reason is end_turn.

If search_vacancies times out, return is_error with "timeout, retry later" rather than an empty list. An empty list looks like a true "no vacancies" answer.

## Execute the result contract

A tool-use block has a call ID; the application validates arguments/authorization, invokes the tool and returns its result with the matching tool_use_id. Preserve multiple calls and results rather than assuming the first block is text. A failed tool must not become empty success. The offline `trace_outcome` and `check_extraction` cases check the relevant decisions; the stdio lab shows a scripted complete loop.
