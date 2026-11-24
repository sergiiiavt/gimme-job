# 15-question practice quiz

Answer all 15 before opening the key; about 15 minutes is plenty. These are original practice questions written for this learning path from Anthropic's public API documentation. They are **not** the Claude Academy quiz questions.

## Questions 1–10

**1.** Where does the system prompt go in a Messages API request?
A. A message in messages with its role set to system
B. The top-level system field, separate from messages
C. The first user message, before the actual question
D. A request header sent alongside the API key

**2.** A response ends mid-sentence with stop_reason max_tokens. What happened?
A. Claude refused the request partway through
B. A tool call is waiting for its result first
C. The network dropped before the reply ended
D. The reply hit the max_tokens limit you set

**3.** In the agent loop, how should your code decide whether to run a tool?
A. Check whether stop_reason is tool_use
B. Search the reply text for the word "tool"
C. Run every defined tool after each reply
D. Wait until Claude's reply says it is done

**4.** What links a tool_result to the call it answers?
A. The tool's name, repeated in the result block
B. The order of blocks in the assistant message
C. A tool_use_id matching the tool_use block's id
D. A timestamp copied from the original tool call

**5.** Your search tool times out. What should the tool_result contain?
A. An empty list, so the agent can move on quickly
B. is_error set, with a short reason such as timeout
C. Nothing; skip it and send the next user turn
D. The last successful result, reused from a cache

**6.** Claude must call extract_fields first, every time. Which tool_choice guarantees it?
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
A. Use the most capable tier so accuracy is as high as possible
B. Pick the newest model, because newer is always the best
C. Compare tiers on real samples; take the cheapest that passes
D. Rotate models at random so the cost spreads out evenly

**9.** Which tool runs on Anthropic's infrastructure, with no implementation in your code?
A. Web search
B. A search_vacancies tool you define
C. A database query tool in your backend
D. A tool that calls your internal API

**10.** When is a hand-written agent loop a better fit than the SDK's Tool Runner?
A. When you want less code to maintain
B. When a person must approve some tool calls
C. When the tools have simple JSON schemas
D. When you want automatic error wrapping

## Questions 11–15

**11.** When does extended thinking pay off most?
A. Classifying short texts into fixed labels
B. Reformatting a list into a Markdown table
C. Debugging a multi-step failure in a pipeline
D. Looking up one value in a known document

**12.** In MCP, what is a resource?
A. A remote server that hosts the protocol
B. An action that changes data in another app
C. A credential the client uses to sign in
D. Data the application reads as context

**13.** A long-running agent slows down as old tool results pile up. Which approach fits?
A. Restart the agent from scratch every ten turns
B. Trim tool output and compact old turns, pinning key facts
C. Move to a model with a bigger context window, nothing else
D. Resend every past tool result again on each request

**14.** In Claude Managed Agents, what is a session?
A. A running instance of an agent in an environment
B. A single Messages API call with no history kept
C. The sandbox template that defines the container
D. The versioned definition of the agent's tools

**15.** Which response field tells you what a request cost?
A. stop_reason
B. content
C. usage
D. model

## Answer key with explanations

1. **B** — the Messages API takes the system prompt as a top-level field; messages holds only user and assistant turns.
2. **D** — the output was cut off at the limit you set; a pending tool call shows as tool_use instead.
3. **A** — the API states when Claude wants a tool; parsing prose for keywords is brittle.
4. **C** — each tool_result carries the id of the tool_use block it answers.
5. **B** — a structured error lets Claude retry or explain; an empty list looks like a genuine "no results" answer.
6. **A** — naming the tool forces that exact call; any may pick another tool and auto may answer in text.
7. **D** — descriptions are the model's main signal for choosing a tool, so fix them before adding infrastructure.
8. **C** — measure on your own examples and choose the cheapest model that meets the bar.
9. **A** — web search is a built-in server tool; the other three are client tools your code must run.
10. **B** — Tool Runner runs calls automatically; an approval step, custom logging or conditional execution need the manual loop.
11. **C** — thinking helps multi-step reasoning; simple, well-defined tasks pay the extra tokens for little gain.
12. **D** — resources expose data to read as context; tools perform actions.
13. **B** — trimming and compaction keep the window small, and pinned facts survive the summaries.
14. **A** — a session runs a defined agent inside an environment and is driven by events.
15. **C** — usage reports input and output tokens, which is what you are billed for.

## Score interpretation

This quiz uses one question = one mark. The real course quiz only needs passing, so use the score to decide what to reread:

- **14–15:** strong; take Claude Platform 101 on Claude Academy now.
- **12–13:** close; reread the chapter behind each wrong answer.
- **11:** gaps remain; redo sections 2 and 3 of the hands-on lab, then retake.
- **Below 11:** read the three study chapters again and do the lab before the course.
