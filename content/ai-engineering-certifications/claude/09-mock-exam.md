# 40-question original mock exam

Set an **80-minute timer** (the real exam allows 2 minutes per question) and answer all 40 before opening the key. These are original practice questions written for this learning path from the public exam guides. They are **not Anthropic exam questions**. Questions are grouped by the six published CCAR-F production scenarios. The CCDV-F API questions now live in the Claude CCDV-F tile.

## Questions 1–10

**1.** A customer support agent sometimes issues refunds above the $500 policy cap, even though the system prompt states the cap clearly. What is the most reliable fix?
A. Add a PreToolUse hook that blocks process_refund above $500 and routes to a human
B. Move the agent to a larger model that tends to follow policy instructions more closely
C. Restate the $500 cap in capital letters at the end of the system prompt
D. Add few-shot examples in which the agent politely declines large refunds

**2.** The support agent's loop ends when the reply text contains "I've resolved your issue". It sometimes stops halfway through a multi-step case. What should control the loop?
A. Stop after a fixed three iterations, which covers most support cases
B. Match the reply against a longer, curated list of phrases that signal completion
C. Handle stop_reason and tool results, then verify task completion separately
D. Ask the model to print DONE when it finishes and stop on that token

**3.** Which signal is the best trigger for handing a support conversation to a human?
A. The customer's sentiment score drops below a configured threshold
B. The conversation passes ten turns without the case being closed
C. The model reports its own confidence in the answer as below 0.7
D. The customer asks for a person, or the request falls outside policy

**4.** After older turns are summarised, the support agent loses the exact order number and refund amount and asks the customer again. What fixes this?
A. Make each summary longer and more detailed so more of the original facts survive
B. Turn summarisation off and resend the full history on every request
C. Keep IDs, amounts and dates in a pinned case-facts block outside the summary
D. Move to a model with a larger context window so nothing is summarised

**5.** The agent often calls get_customer when it should call lookup_order. Both tool descriptions read "Retrieves information." What should you change first?
A. Force tool_choice to lookup_order so the model can never pick the wrong one
B. Merge both tools into one generic lookup that accepts any identifier
C. Rewrite both descriptions: what each returns, its inputs, when to prefer it
D. Add a separate classifier model that routes each request to one tool

**6.** lookup_order fails because the order service timed out. What should the tool return to the model?
A. An exception that ends the session so the customer can start over with a clean slate
B. isError: true with a transient category, a retryable flag and a short message
C. An empty result, so the conversation can continue without interruption
D. The text "Something went wrong" so the model can apologise to the customer

**7.** Which support rule should be enforced in code rather than left to the prompt?
A. Verify the customer's identity before any change to the account
B. Pick the help-centre article that best matches the question asked
C. Greet the customer by first name in a warm, friendly tone
D. Summarise the resolution in two sentences at the end of the chat

**8.** A report covers only visual art. The task plan assigned only visual art, and every worker completed its assigned topic. Where was the coverage gap introduced?
A. The subagents' search tool returns too few results for each query
B. The synthesis step dropped the music and film findings it received
C. The context window is too small to hold findings from all subagents
D. The coordinator decomposed the topic too narrowly from the start

**9.** Research findings never reach synthesis. Which integration contract should you check first?
A. Whether findings are explicitly included in the synthesis input
B. Subagents share memory automatically, so this points to a bug in the API
C. Findings must be copied into the system prompt of every agent in the system
D. The synthesis subagent needs a larger model to notice the extra findings

**10.** Four independent research subagents run one after another and the pipeline is slow. What is the best change?
A. Merge the four subagents into one subagent that holds all of the tools
B. Have the coordinator issue all four subagent calls in one response
C. Send each subagent's request through the Message Batches API instead
D. Lower max_tokens on each subagent so that every call returns sooner

## Questions 11–20

**11.** A web-search subagent hits a timeout halfway through its task. What should it return to the coordinator?
A. Nothing yet; it should keep retrying the search until it succeeds
B. The failure type, the query attempted, partial results, and retry advice
C. A signal that stops the whole pipeline so no partial report is produced
D. An empty result marked as success, so the coordinator can move on

**12.** Two credible sources still give different figures after dates and scope are checked. What should the report do?
A. Report both figures with their sources and state that they conflict
B. Use the figure from whichever of the two sources was published last
C. Average the two figures and present the average as the market size
D. Leave the figure out of the report, since the sources cannot agree

**13.** One agent has 18 tools and frequently picks the wrong one. What design change helps most?
A. List all 18 tools a second time inside the system prompt for emphasis
B. Set temperature to 0 so that tool selection becomes deterministic
C. Scope each worker to the capabilities needed for its role
D. Give every agent all 18 tools so that no needed capability is missing

**14.** A new teammate says Claude Code ignores team conventions that work fine on your machine. What is the most likely cause?
A. The conventions live in your ~/.claude/CLAUDE.md, not in the repository
B. Their project CLAUDE.md is too long, so Claude Code truncates it
C. They run an older model version that does not read project CLAUDE.md files at all
D. Plan mode is switched off on their machine, so the rules are skipped

**15.** Test files sit next to components across 40 folders. You want testing conventions applied to every *.test.tsx file and nothing else. What is the best approach?
A. A testing section in the root CLAUDE.md that loads for every file
B. A CLAUDE.md file in each of the 40 folders that hold component tests
C. A slash command that developers must remember to run before testing
D. A .claude/rules/ file whose paths frontmatter is **/*.test.tsx

**16.** Everyone who clones the repository should get the same /review command. Where do you define it?
A. A review server entry in the project's .mcp.json configuration
B. .claude/commands/review.md, committed to the repository
C. A review section inside the project's root CLAUDE.md file
D. ~/.claude/commands/review.md on each developer's own machine

**17.** You must migrate authentication across about 30 files, and there are several reasonable approaches. How should the Claude Code session start?
A. One prompt containing all 30 files pasted in, so nothing is missed
B. Plan mode: explore the code and agree an approach before any edits
C. Direct execution, editing the files straight away to save time
D. One Batches API request per file, so the 30 changes run cheaply

**18.** A skill that runs a long codebase analysis floods the main session with output. What fixes it at the source?
A. Shorten SKILL.md so the analysis produces less output overall
B. Move the skill to user level so it no longer loads for the project
C. Run /clear after every use of the skill to empty the session
D. Set context: fork in the skill's frontmatter to isolate the run

**19.** CI logs show Claude Code waiting for interactive input. What is the direct fix?
A. Run Claude Code with -p so it executes without waiting for input
B. Add a verbose logging flag so the job shows where it is stuck
C. Raise the job timeout so Claude Code has longer to finish the review
D. Move the job to a larger runner with more CPU and memory

**20.** CI review findings must be parsed to post inline pull request comments. What is the most robust approach?
A. Use --output-format json with a JSON schema that defines each finding
B. Have Claude write the findings into CLAUDE.md for the next step to read
C. Ask Claude to format its findings as a markdown table and parse that
D. Parse the plain-text output with regular expressions in the workflow

## Questions 21–30

**21.** The CI reviewer posts so many style nits that developers ignore it, including real bugs. What should you change?
A. Lower the temperature so the reviewer makes fewer speculative comments
B. Tell the reviewer in its prompt to "be more conservative" when reporting
C. Switch to a larger model that tends to produce better-judged comments
D. Give explicit criteria: report bugs and security risks, never style

**22.** The session that generated a change also reviews it and keeps missing its own mistakes. What is the better design?
A. Raise max_tokens so the reviewing session can think at greater length
B. Review with a fresh Claude instance that has no generation context
C. Add "be very critical of this code" to the reviewing session's prompt
D. Ask the same session to review its own change a second time

**23.** Every push re-runs the CI review and re-posts the same comments. What fixes it?
A. Delete all earlier review comments before each new review run starts
B. Move the review step to the Batches API so that it runs less often
C. Run the review once a week instead of on every push to the branch
D. Pass in previous findings and ask only for new or unresolved issues

**24.** An extraction pipeline returns plausible invoice numbers for documents that have none. What is the fix?
A. Raise the temperature so the model explores more possible readings
B. Add more few-shot examples of documents that contain invoice numbers
C. Make the field nullable and tell the model to return null when absent
D. Retry the extraction until a non-empty invoice number comes back

**25.** You extract with tool use and a strict JSON schema. Output always parses, yet line items sometimes do not add up to the total. Why, and what next?
A. A schema checks shape, not meaning; validate sums and retry with the error
B. Numeric accuracy requires streaming, so every response should be streamed
C. The schema itself is invalid and has to be rewritten before extraction
D. JSON handles numbers poorly, so the output format should switch to XML

**26.** 50,000 documents must be extracted overnight, and nobody waits on individual results. Which approach fits best?
A. One very large prompt that packs in as many documents as will fit
B. Thousands of parallel synchronous calls, throttled to stay just under the rate limit
C. The Message Batches API, a custom_id per document, resubmit failures only
D. Streaming every response so that results arrive as soon as possible

**27.** Which job is a poor fit for the Message Batches API?
A. A nightly report that triages yesterday's failed test runs
B. Back-filling categories for all of last year's support tickets
C. A weekly audit of every question in a 600-question catalog
D. A pre-merge check that developers wait on before merging

**28.** Overall extraction accuracy is 97%, yet handwritten receipts are wrong a third of the time. What would have caught this early?
A. Allowing more retries per document whenever validation fails
B. Measuring accuracy per document type and sampling each segment
C. Switching to a larger model for every document in the pipeline
D. Raising max_tokens so long receipts are never cut off midway

**29.** You need every file that calls the deprecated legacyFetch( function. Which Claude Code built-in tool fits?
A. Read, run on every file in the repository in turn
B. Bash, running ls -R across the whole repository
C. Glob, which matches file paths against a pattern
D. Grep, which searches inside the contents of files

**30.** A shared MCP server needs a GitHub token, and the MCP config is committed to the repository. What is the right setup?
A. Keep the server in user config only and never share it with the team
B. Put the token directly into .mcp.json so the server works on first clone
C. Reference ${GITHUB_TOKEN} in .mcp.json; each developer sets the variable
D. Store the token in CLAUDE.md, which Claude Code reads at session start

## Questions 31–40

**31.** The model's first action must always be a call to extract_fields. Which tool_choice requests that named tool in a supported configuration?
A. auto, which lets the model decide whether to call a tool
B. any, which requires the model to call one of the tools
C. {"type": "tool", "name": "extract_fields"}, naming the tool
D. none, which prevents the model from calling any tools

**32.** In MCP, what is the difference between a resource and a tool?
A. There is no real difference; the two names are used interchangeably
B. Resources are remote MCP servers, while tools always run as local servers
C. Resources need OAuth to connect, while tools never require authentication
D. Resources expose content to read as context; tools perform actions

**33.** The support agent escalates a case to a human. What should the handoff include?
A. A structured summary: customer, issue, steps tried, next action
B. The model's confidence score and the customer's sentiment rating
C. The full raw transcript, so the human can read every message
D. Only the customer's last message, to keep the handoff short

**34.** An agent reads a 60-page incident report and keeps missing the root cause stated on page 31. Which change helps most?
A. Put a summary of key findings first, with headers
B. Move the report into a tool result, out of the prompt
C. Lower the temperature so the model reads more carefully
D. Repeat the whole report twice in the same prompt

**35.** An extraction agent mishandles postings that give salary as a range in two currencies. What improves it most?
A. Longer instructions that describe every currency format in detail
B. Twenty examples of ordinary postings with one simple salary each
C. A small evaluated set of ambiguous examples with the expected handling
D. A larger model, which already knows how currencies are written

**36.** A teammate says Claude ignores the project's testing conventions. Which command shows which memory files loaded in their session?
A. /init
B. /compact
C. /clear
D. /memory

**37.** The project CLAUDE.md has grown to 900 lines of API, UI and test conventions. What is the best way to organise it?
A. Paste the relevant section into every prompt by hand instead
B. Delete the older half so that the file stays under 450 lines
C. Split it into focused files and pull them in with @path imports
D. Move it all into each developer's own ~/.claude/CLAUDE.md

**38.** An order-lookup tool returns 40 fields per order, and long conversations run out of context. What fits best?
A. Move to the model tier with the largest context window
B. Trim the tool's output to the fields the agent actually uses
C. Summarise the whole conversation after every single turn
D. Split the agent into one subagent for each order field

**39.** A tool returns dates in three documented, unambiguous formats. Where should they be normalized before comparison?
A. A system prompt note that lists all three formats and how to read each
B. A PostToolUse hook that rewrites dates to ISO 8601 before Claude sees them
C. A larger model that is better at reasoning across mixed and ambiguous date formats
D. Few-shot examples that show the model how to convert each date format

**40.** Mid-investigation, you want to try a risky alternative approach without losing the current session's state. What fits?
A. Continue in the same session and undo the changes if they do not work
B. Fork the session, try the alternative there, and keep the original intact
C. Run /clear in the current session and describe the alternative again
D. Start a brand-new session and paste in a summary of the work so far

## Answer key with explanations

1. **A** — A configured hook can block matched tool calls; enforce the refund cap and identity at the backend boundary as well. Prompts alone do not guarantee the rule.
2. **C** — Handle stop_reason and tool results. end_turn finishes a model turn; the application must separately verify task completion.
3. **D** — escalate on explicit criteria; sentiment is not complexity and self-reported confidence is poorly calibrated.
4. **C** — progressive summarisation drops specifics, so pin the facts that must survive outside the summarised history.
5. **C** — descriptions are the model's main signal for tool choice; fix that cheap root cause before adding infrastructure.
6. **B** — structured errors let the agent retry, explain or escalate; an empty result looks like a valid "no orders" answer.
7. **A** — identity checks and limits must hold every time, so gate them in code; tone and relevance are judgment calls.
8. **D** — The assignment scope omitted music, film and writing; correct the decomposition before blaming worker execution.
9. **A** — Context inheritance is runtime-dependent; pass and verify needed findings rather than assuming shared memory.
10. **B** — independent work can be spawned in parallel from one coordinator turn; batches trade latency for cost.
11. **B** — silent success hides the failure and global aborts are disproportionate; give the coordinator what recovery needs.
12. **A** — synthesis keeps provenance; picking or averaging silently invents certainty the evidence lacks.
13. **C** — Scoping can reduce routing confusion and limits privileges; test the actual tool interfaces rather than asserting a universal tool-count threshold.
14. **A** — user-level memory is personal; team conventions belong in the committed project CLAUDE.md.
15. **D** — path-scoped rules apply by glob wherever files live; folder files cannot follow a pattern and root CLAUDE.md loads everywhere.
16. **B** — project commands in .claude/commands/ travel with the repository; the home directory is for personal commands.
17. **B** — plan mode fits large, ambiguous, multi-file changes; direct execution is for well-scoped fixes.
18. **D** — a forked skill runs in its own context and returns only the result, so the noise never reaches the main session.
19. **A** — without print mode Claude Code waits for interactive input that never arrives in CI.
20. **A** — pipelines should consume machine-readable output with a defined shape; text formats drift.
21. **D** — adjectives do not change behaviour, explicit inclusion and exclusion criteria do; cutting false positives restores trust.
22. **B** — the generating session shares its own assumptions; a fresh instance judges the diff on its merits.
23. **D** — give the reviewer the history it needs to deduplicate; the other options hide or delay the noise.
24. **C** — a required field pressures the model to invent a value; give it an honest way to say "not present".
25. **A** — strict schema enforcement checks structure and types, not all cross-field business rules or source support; validate sums and return the specific error.
26. **C** — batches cost half as much and finish within 24 hours; custom_id ties each result to its document.
27. **D** — batches have no latency guarantee, so anything a person or a merge waits on needs synchronous calls.
28. **B** — aggregates hide weak segments; stratified evaluation shows where the system fails.
29. **D** — Grep searches file contents; Glob matches names and paths, not what is inside files.
30. **C** — environment variable expansion keeps the shared config in version control without leaking secrets.
31. **C** — auto may answer in text and any may pick another tool; naming the tool forces that exact call.
32. **D** — resources are data the application loads as context; tools are callable functions that act or compute.
33. **A** — a structured handoff means the human does not start from zero; raw transcripts and scores do not say what to do next.
34. **A** — models attend best to the start and end of long inputs, so lead with the key findings and clear headers.
35. **C** — Use representative edge cases and measure their effect; no universal best example count is established.
36. **D** — /memory shows which memory files loaded, which exposes conventions sitting in someone's user-level file.
37. **C** — @path imports keep the shared CLAUDE.md focused without losing anything or making it personal.
38. **B** — trimming tool output to the needed fields keeps long conversations inside the context window.
39. **B** — Normalize validated, unambiguous tool outputs in code before model consumption. An ambiguous date needs explicit locale/source clarification first.
40. **B** — A fork branches conversation state; it does not isolate filesystem changes, credentials or external side effects.

## Score interpretation

This mock uses one question = one mark. The real exam reports a scaled score from 100 to 1,000 with 720 to pass, so treat the percentage here as a diagnostic, not a prediction:

- **36–40:** strong; take the official practice exam and review readiness against the current official guide.
- **32–35:** close; reread the chapters behind every wrong answer, then retake this mock.
- **28–31:** material gaps remain; redo the hands-on labs for your weakest domain.
- **Below 28:** return to the chapter sequence before doing more mocks.

For every wrong answer, write down why the distractor was tempting and which of the six distractor patterns in the final review it matches.
