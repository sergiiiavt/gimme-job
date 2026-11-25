# 15-question practice quiz

Answer all 15 before opening the key; about 15 minutes is plenty. These are original practice questions written for this learning path from Anthropic's public API documentation. They are **not** the Claude Academy quiz questions.

## Questions 1–10

**1.** Where does the system prompt go in a Messages API request?
A. The first user message, before the actual question
B. The top-level system field, separate from messages
C. A request header sent alongside the API key
D. A message in messages with its role set to system

**2.** A response ends mid-sentence with stop_reason max_tokens. What happened?
A. The reply hit the max_tokens limit you set
B. Claude refused the request partway through
C. The network dropped before the reply ended
D. A tool call is waiting for its result first

**3.** In the agent loop, how should your code decide whether to run a tool?
A. Wait until Claude's reply says it is done
B. Run every defined tool after each reply
C. Search the reply text for the word "tool"
D. Check whether stop_reason is tool_use

**4.** What links a tool_result to the call it answers?
A. A tool_use_id matching the tool_use block's id
B. The order of blocks in the assistant message
C. The tool's name, repeated in the result block
D. A timestamp copied from the original tool call

**5.** Your search tool times out. What should the tool_result contain?
A. Nothing; skip it and send the next user turn
B. is_error set, with a short reason such as timeout
C. The last successful result, reused from a cache
D. An empty list, so the agent can move on quickly

**6.** Claude must call extract_fields first, every time. Which tool_choice requests that named tool in a supported configuration?
A. tool, naming extract_fields
B. auto, which lets Claude decide
C. any, which requires some tool
D. none, which turns tools off

**7.** Claude keeps choosing the wrong one of two similar tools. What should you fix first?
A. Move to the most capable model tier available
B. Merge both tools into one generic catch-all tool
C. Raise max_tokens so Claude has room to think
D. The two tools' descriptions and their boundaries

**8.** You must sort 50,000 job titles into three groups cheaply. What is the course's approach to choosing a model?
A. Pick the newest model, because newer is always the best
B. Use the most capable tier so accuracy is as high as possible
C. Compare tiers on real samples; take the cheapest that passes
D. Rotate models at random so the cost spreads out evenly

**9.** Which tool runs on Anthropic's infrastructure, with no implementation in your code?
A. A tool that calls your internal API
B. A database query tool in your backend
C. A search_vacancies tool you define
D. Web search

**10.** Which requirement most strongly justifies explicit control over the agent loop?
A. When you want automatic error wrapping
B. Per-call approval and conditional recovery policies
C. When the tools have simple JSON schemas
D. When you want less code to maintain

## Questions 11–15

**11.** When does extended thinking pay off most?
A. Classifying short texts into fixed labels
B. Reformatting a list into a Markdown table
C. Debugging a multi-step failure in a pipeline
D. Looking up one value in a known document

**12.** In MCP, what is a resource?
A. An action that changes data in another app
B. A remote server that hosts the protocol
C. Data the application reads as context
D. A credential the client uses to sign in

**13.** A long-running agent slows down as old tool results pile up. Which approach fits?
A. Resend every past tool result again on each request
B. Restart the agent from scratch every ten turns
C. Trim tool output and compact old turns, pinning key facts
D. Move to a model with a bigger context window, nothing else

**14.** In Claude Managed Agents, what is a session?
A. The versioned definition of the agent's tools
B. A running instance of an agent in an environment
C. A single Messages API call with no history kept
D. The sandbox template that defines the container

**15.** Which response field reports token usage for a later cost calculation?
A. usage
B. content
C. model
D. stop_reason

## Answer key with explanations

1. **B** — the Messages API takes the system prompt as a top-level field; messages holds only user and assistant turns.
2. **A** — the output was cut off at the limit you set; a pending tool call shows as tool_use instead.
3. **D** — the API states when Claude wants a tool; parsing prose for keywords is brittle.
4. **A** — each tool_result carries the id of the tool_use block it answers.
5. **B** — a structured error lets Claude retry or explain; an empty list looks like a genuine "no results" answer.
6. **A** — naming the tool forces that exact call; any may pick another tool and auto may answer in text.
7. **D** — descriptions are the model's main signal for choosing a tool, so fix them before adding infrastructure.
8. **C** — measure on your own examples and choose the cheapest model that meets the bar.
9. **D** — web search is a built-in server tool; the other three are client tools your code must run.
10. **B** — Custom approval/recovery may require explicit orchestration. Check current SDK extension points; an automatic runner is not the only implementation.
11. **C** — thinking helps multi-step reasoning; simple, well-defined tasks pay the extra tokens for little gain.
12. **C** — resources expose data to read as context; tools perform actions.
13. **C** — trimming and compaction keep the window small, and pinned facts survive the summaries.
14. **B** — a session runs a defined agent inside an environment and is driven by events.
15. **A** — Usage reports token categories, not currency cost by itself. Apply model rates and cache/batch pricing separately.

## Score interpretation

This quiz uses one question = one mark. The real course quiz only needs passing, so use the score to decide what to reread:

- **14–15:** strong; take Claude Platform 101 on Claude Academy now.
- **12–13:** close; reread the chapter behind each wrong answer.
- **11:** gaps remain; redo sections 2 and 3 of the hands-on lab, then retake.
- **Below 11:** read the three study chapters again and do the lab before the course.
