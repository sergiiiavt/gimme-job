# Final review & checklist

## High-yield distinctions

- **system field vs system message:** the system prompt is a top-level field, never a message.
- **Stop reasons:** end_turn means done, max_tokens means cut off by your limit, and tool_use means run a tool and send the result back.
- **tool_use_id:** every tool_result must carry the id of the tool_use block it answers.
- **Errors in tools:** return is_error with a reason, never an empty success.
- **tool_choice:** auto lets Claude decide, any forces some tool, a named tool forces that one, and none blocks tools.
- **Client vs server tools:** client tools run in your code; built-in tools such as web search run on Anthropic's side.
- **Skills vs MCP:** MCP gives access to systems and data; skills teach a procedure.
- **Tool Runner vs manual loop:** the Tool Runner saves code; the manual loop keeps a place for approval and custom logic.
- **Messages API vs Managed Agents:** your own loop gives control; Managed Agents gives a hosted harness for long-running work.

## Distractors to expect

- "Use the biggest model" when the problem is a vague tool description.
- "Raise max_tokens" when the loop logic is wrong.
- "Return an empty result" when the tool actually failed.
- "Parse Claude's text" when a structured field already says what happened.

## Checklist before the course quiz

- [ ] I can write a Messages API request from memory and name the three main response fields.
- [ ] I have written an agent loop by hand that stops on end_turn and has an iteration cap.
- [ ] I compared two model tiers on real examples and chose on evidence.
- [ ] I can name the three built-in tools and say where they run.
- [ ] I can explain when to use Managed Agents instead of my own loop.
- [ ] I scored 13 or more on the practice quiz.

## After Claude Platform 101

Building with the Claude API goes much deeper. Introduction to Model Context Protocol teaches you to build MCP servers. For the proctored path, the Claude CCDV-F tile builds directly on this course.
