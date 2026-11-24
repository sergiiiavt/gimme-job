# 40-question original mock exam

Set an **80-minute timer** (the real exam allows 2 minutes per question) and answer all 40 before opening the key. These are original practice questions written for this learning path from the public exam guides. They are **not Anthropic exam questions**. Questions are grouped by the six published CCAR-F production scenarios. The CCDV-F API questions now live in the Claude CCDV-F tile.

## Questions 1–10

**1.** A customer support agent sometimes issues refunds above the $500 policy cap, even though the system prompt states the cap clearly. What is the most reliable fix?
A. Restate the $500 cap in capital letters at the end of the system prompt
B. Add few-shot examples in which the agent politely declines large refunds
C. Add a PreToolUse hook that blocks process_refund above $500 and routes to a human
D. Move the agent to a larger model that tends to follow policy instructions more closely

**2.** The support agent's loop ends when the reply text contains "I've resolved your issue". It sometimes stops halfway through a multi-step case. What should control the loop?
A. Continue while stop_reason is tool_use and finish when it is end_turn
B. Match the reply against a longer, curated list of phrases that signal completion
C. Stop after a fixed three iterations, which covers most support cases
D. Ask the model to print DONE when it finishes and stop on that token

**3.** Which signal is the best trigger for handing a support conversation to a human?
A. The customer's sentiment score drops below a configured threshold
B. The model reports its own confidence in the answer as below 0.7
C. The conversation passes ten turns without the case being closed
D. The customer asks for a person, or the request falls outside policy

**4.** After older turns are summarised, the support agent loses the exact order number and refund amount and asks the customer again. What fixes this?
A. Make each summary longer and more detailed so more of the original facts survive
B. Keep IDs, amounts and dates in a pinned case-facts block outside the summary
C. Turn summarisation off and resend the full history on every request
D. Move to a model with a larger context window so nothing is summarised

**5.** The agent often calls get_customer when it should call lookup_order. Both tool descriptions read "Retrieves information." What should you change first?
A. Add a separate classifier model that routes each request to one tool
B. Merge both tools into one generic lookup that accepts any identifier
C. Rewrite both descriptions: what each returns, its inputs, when to prefer it
D. Force tool_choice to lookup_order so the model can never pick the wrong one

**6.** lookup_order fails because the order service timed out. What should the tool return to the model?
A. isError: true with a transient category, a retryable flag and a short message
B. An empty result, so the conversation can continue without interruption
C. An exception that ends the session so the customer can start over with a clean slate
D. The text "Something went wrong" so the model can apologise to the customer

**7.** Which support rule should be enforced in code rather than left to the prompt?
A. Greet the customer by first name in a warm, friendly tone
B. Verify the customer's identity before any change to the account
C. Pick the help-centre article that best matches the question asked
D. Summarise the resolution in two sentences at the end of the chat

**8.** A multi-agent report on "AI's impact on creative industries" covers only visual art. Logs show each subagent researched its assigned subtopic thoroughly. What is the root cause?
A. The subagents' search tool returns too few results for each query
B. The synthesis step dropped the music and film findings it received
C. The context window is too small to hold findings from all subagents
D. The coordinator decomposed the topic too narrowly from the start

**9.** A research subagent produced key findings, but the synthesis subagent never mentions them. What is the most likely reason?
A. Subagents start without the coordinator's context; findings must be passed in
B. Subagents share memory automatically, so this points to a bug in the API
C. The synthesis subagent needs a larger model to notice the extra findings
D. Findings must be copied into the system prompt of every agent in the system

**10.** Four independent research subagents run one after another and the pipeline is slow. What is the best change?
A. Merge the four subagents into one subagent that holds all of the tools
B. Send each subagent's request through the Message Batches API instead
C. Have the coordinator issue all four subagent calls in one response
D. Lower max_tokens on each subagent so that every call returns sooner

## Questions 11–20

**11.** A web-search subagent hits a timeout halfway through its task. What should it return to the coordinator?
A. An empty result marked as success, so the coordinator can move on
B. The failure type, the query attempted, partial results, and retry advice
C. Nothing yet; it should keep retrying the search until it succeeds
D. A signal that stops the whole pipeline so no partial report is produced

**12.** Two credible sources give different market-size figures for the same year. What should the final research report do?
A. Use the figure from whichever of the two sources was published last
B. Average the two figures and present the average as the market size
C. Leave the figure out of the report, since the sources cannot agree
D. Report both figures with their sources and state that they conflict

**13.** One agent has 18 tools and frequently picks the wrong one. What design change helps most?
A. Give each subagent only the four or five tools its role actually needs
B. Give every agent all 18 tools so that no needed capability is missing
C. List all 18 tools a second time inside the system prompt for emphasis
D. Set temperature to 0 so that tool selection becomes deterministic

**14.** A new teammate says Claude Code ignores team conventions that work fine on your machine. What is the most likely cause?
A. They run an older model version that does not read project CLAUDE.md files at all
B. Their project CLAUDE.md is too long, so Claude Code truncates it
C. The conventions live in your ~/.claude/CLAUDE.md, not in the repository
D. Plan mode is switched off on their machine, so the rules are skipped

**15.** Test files sit next to components across 40 folders. You want testing conventions applied to every *.test.tsx file and nothing else. What is the best approach?
A. A CLAUDE.md file in each of the 40 folders that hold component tests
B. A .claude/rules/ file whose paths frontmatter is **/*.test.tsx
C. A testing section in the root CLAUDE.md that loads for every file
D. A slash command that developers must remember to run before testing

**16.** Everyone who clones the repository should get the same /review command. Where do you define it?
A. ~/.claude/commands/review.md on each developer's own machine
B. A review section inside the project's root CLAUDE.md file
C. A review server entry in the project's .mcp.json configuration
D. .claude/commands/review.md, committed to the repository

**17.** You must migrate authentication across about 30 files, and there are several reasonable approaches. How should the Claude Code session start?
A. Plan mode: explore the code and agree an approach before any edits
B. Direct execution, editing the files straight away to save time
C. One Batches API request per file, so the 30 changes run cheaply
D. One prompt containing all 30 files pasted in, so nothing is missed

**18.** A skill that runs a long codebase analysis floods the main session with output. What fixes it at the source?
A. Run /clear after every use of the skill to empty the session
B. Shorten SKILL.md so the analysis produces less output overall
C. Set context: fork in the skill's frontmatter to isolate the run
D. Move the skill to user level so it no longer loads for the project

**19.** A GitHub Actions job that runs Claude Code hangs until it times out. What is the fix?
A. Raise the job timeout so Claude Code has longer to finish the review
B. Run Claude Code with -p so it executes without waiting for input
C. Add a verbose logging flag so the job shows where it is stuck
D. Move the job to a larger runner with more CPU and memory

**20.** CI review findings must be parsed to post inline pull request comments. What is the most robust approach?
A. Parse the plain-text output with regular expressions in the workflow
B. Ask Claude to format its findings as a markdown table and parse that
C. Have Claude write the findings into CLAUDE.md for the next step to read
D. Use --output-format json with a JSON schema that defines each finding

## Questions 21–30

**21.** The CI reviewer posts so many style nits that developers ignore it, including real bugs. What should you change?
A. Give explicit criteria: report bugs and security risks, never style
B. Tell the reviewer in its prompt to "be more conservative" when reporting
C. Lower the temperature so the reviewer makes fewer speculative comments
D. Switch to a larger model that tends to produce better-judged comments

**22.** The session that generated a change also reviews it and keeps missing its own mistakes. What is the better design?
A. Ask the same session to review its own change a second time
B. Review with a fresh Claude instance that has no generation context
C. Raise max_tokens so the reviewing session can think at greater length
D. Add "be very critical of this code" to the reviewing session's prompt

**23.** Every push re-runs the CI review and re-posts the same comments. What fixes it?
A. Run the review once a week instead of on every push to the branch
B. Delete all earlier review comments before each new review run starts
C. Pass in previous findings and ask only for new or unresolved issues
D. Move the review step to the Batches API so that it runs less often

**24.** An extraction pipeline returns plausible invoice numbers for documents that have none. What is the fix?
A. Retry the extraction until a non-empty invoice number comes back
B. Add more few-shot examples of documents that contain invoice numbers
C. Raise the temperature so the model explores more possible readings
D. Make the field nullable and tell the model to return null when absent

**25.** You extract with tool use and a strict JSON schema. Output always parses, yet line items sometimes do not add up to the total. Why, and what next?
A. A schema checks shape, not meaning; validate sums and retry with the error
B. The schema itself is invalid and has to be rewritten before extraction
C. Numeric accuracy requires streaming, so every response should be streamed
D. JSON handles numbers poorly, so the output format should switch to XML

**26.** 50,000 documents must be extracted overnight, and nobody waits on individual results. Which approach fits best?
A. Thousands of parallel synchronous calls, throttled to stay just under the rate limit
B. The Message Batches API, a custom_id per document, resubmit failures only
C. Streaming every response so that results arrive as soon as possible
D. One very large prompt that packs in as many documents as will fit

**27.** Which job is a poor fit for the Message Batches API?
A. A nightly report that triages yesterday's failed test runs
B. A weekly audit of every question in a 600-question catalog
C. A pre-merge check that developers wait on before merging
D. Back-filling categories for all of last year's support tickets

**28.** Overall extraction accuracy is 97%, yet handwritten receipts are wrong a third of the time. What would have caught this early?
A. Switching to a larger model for every document in the pipeline
B. Allowing more retries per document whenever validation fails
C. Raising max_tokens so long receipts are never cut off midway
D. Measuring accuracy per document type and sampling each segment

**29.** You need every file that calls the deprecated legacyFetch( function. Which Claude Code built-in tool fits?
A. Glob, which matches file paths against a pattern
B. Grep, which searches inside the contents of files
C. Read, run on every file in the repository in turn
D. Bash, running ls -R across the whole repository

**30.** A shared MCP server needs a GitHub token, and the MCP config is committed to the repository. What is the right setup?
A. Reference ${GITHUB_TOKEN} in .mcp.json; each developer sets the variable
B. Put the token directly into .mcp.json so the server works on first clone
C. Store the token in CLAUDE.md, which Claude Code reads at session start
D. Keep the server in user config only and never share it with the team

## Questions 31–40

**31.** The model's first action must always be a call to extract_fields. Which tool_choice setting guarantees it?
A. auto, which lets the model decide whether to call a tool
B. any, which requires the model to call one of the tools
C. {"type": "tool", "name": "extract_fields"}, naming the tool
D. none, which prevents the model from calling any tools

**32.** In MCP, what is the difference between a resource and a tool?
A. Resources are remote MCP servers, while tools always run as local servers
B. Resources need OAuth to connect, while tools never require authentication
C. There is no real difference; the two names are used interchangeably
D. Resources expose content to read as context; tools perform actions

**33.** The support agent escalates a case to a human. What should the handoff include?
A. A structured summary: customer, issue, steps tried, next action
B. The full raw transcript, so the human can read every message
C. Only the customer's last message, to keep the handoff short
D. The model's confidence score and the customer's sentiment rating

**34.** An agent reads a 60-page incident report and keeps missing the root cause stated on page 31. Which change helps most?
A. Repeat the whole report twice in the same prompt
B. Put a summary of key findings first, with headers
C. Move the report into a tool result, out of the prompt
D. Lower the temperature so the model reads more carefully

**35.** An extraction agent mishandles postings that give salary as a range in two currencies. What improves it most?
A. Longer instructions that describe every currency format in detail
B. Twenty examples of ordinary postings with one simple salary each
C. Two to four examples of the ambiguous cases, with the reasoning
D. A larger model, which already knows how currencies are written

**36.** A teammate says Claude ignores the project's testing conventions. Which command shows which memory files loaded in their session?
A. /clear
B. /compact
C. /init
D. /memory

**37.** The project CLAUDE.md has grown to 900 lines of API, UI and test conventions. What is the best way to organise it?
A. Split it into focused files and pull them in with @path imports
B. Move it all into each developer's own ~/.claude/CLAUDE.md
C. Delete the older half so that the file stays under 450 lines
D. Paste the relevant section into every prompt by hand instead

**38.** An order-lookup tool returns 40 fields per order, and long conversations run out of context. What fits best?
A. Move to the model tier with the largest context window
B. Trim the tool's output to the fields the agent actually uses
C. Summarise the whole conversation after every single turn
D. Split the agent into one subagent for each order field

**39.** Tool results arrive with dates in three formats, and the agent sometimes compares them wrongly. Where is the most reliable place to normalise them?
A. A system prompt note that lists all three formats and how to read each
B. Few-shot examples that show the model how to convert each date format
C. A PostToolUse hook that rewrites dates to ISO 8601 before Claude sees them
D. A larger model that is better at reasoning across mixed and ambiguous date formats

**40.** Mid-investigation, you want to try a risky alternative approach without losing the current session's state. What fits?
A. Start a brand-new session and paste in a summary of the work so far
B. Fork the session, try the alternative there, and keep the original intact
C. Run /clear in the current session and describe the alternative again
D. Continue in the same session and undo the changes if they do not work

## Answer key with explanations

1. **C** — a rule that must hold every time needs deterministic enforcement; a hook always fires, while wording, examples and bigger models only raise the odds.
2. **A** — the API says whether the model wants a tool run; parsing prose for "done" is brittle and an iteration cap is only a safety net.
3. **D** — escalate on explicit criteria; sentiment is not complexity and self-reported confidence is poorly calibrated.
4. **B** — progressive summarisation drops specifics, so pin the facts that must survive outside the summarised history.
5. **C** — descriptions are the model's main signal for tool choice; fix that cheap root cause before adding infrastructure.
6. **A** — structured errors let the agent retry, explain or escalate; an empty result looks like a valid "no orders" answer.
7. **B** — identity checks and limits must hold every time, so gate them in code; tone and relevance are judgment calls.
8. **D** — every subagent did its job, so the gap was created upstream in the coordinator's decomposition.
9. **A** — each subagent starts with only what it is given; passing context between agents is the coordinator's job.
10. **C** — independent work can be spawned in parallel from one coordinator turn; batches trade latency for cost.
11. **B** — silent success hides the failure and global aborts are disproportionate; give the coordinator what recovery needs.
12. **D** — synthesis keeps provenance; picking or averaging silently invents certainty the evidence lacks.
13. **A** — selection degrades as the tool menu grows; scoped tool sets per role also follow least privilege.
14. **C** — user-level memory is personal; team conventions belong in the committed project CLAUDE.md.
15. **B** — path-scoped rules apply by glob wherever files live; folder files cannot follow a pattern and root CLAUDE.md loads everywhere.
16. **D** — project commands in .claude/commands/ travel with the repository; the home directory is for personal commands.
17. **A** — plan mode fits large, ambiguous, multi-file changes; direct execution is for well-scoped fixes.
18. **C** — a forked skill runs in its own context and returns only the result, so the noise never reaches the main session.
19. **B** — without print mode Claude Code waits for interactive input that never arrives in CI.
20. **D** — pipelines should consume machine-readable output with a defined shape; text formats drift.
21. **A** — adjectives do not change behaviour, explicit inclusion and exclusion criteria do; cutting false positives restores trust.
22. **B** — the generating session shares its own assumptions; a fresh instance judges the diff on its merits.
23. **C** — give the reviewer the history it needs to deduplicate; the other options hide or delay the noise.
24. **D** — a required field pressures the model to invent a value; give it an honest way to say "not present".
25. **A** — schemas remove syntax errors only; semantic rules need a validation step and a retry that names the error.
26. **B** — batches cost half as much and finish within 24 hours; custom_id ties each result to its document.
27. **C** — batches have no latency guarantee, so anything a person or a merge waits on needs synchronous calls.
28. **D** — aggregates hide weak segments; stratified evaluation shows where the system fails.
29. **B** — Grep searches file contents; Glob matches names and paths, not what is inside files.
30. **A** — environment variable expansion keeps the shared config in version control without leaking secrets.
31. **C** — auto may answer in text and any may pick another tool; naming the tool forces that exact call.
32. **D** — resources are data the application loads as context; tools are callable functions that act or compute.
33. **A** — a structured handoff means the human does not start from zero; raw transcripts and scores do not say what to do next.
34. **B** — models attend best to the start and end of long inputs, so lead with the key findings and clear headers.
35. **C** — a few targeted examples of the hard cases fix edge-case handling better than longer instructions.
36. **D** — /memory shows which memory files loaded, which exposes conventions sitting in someone's user-level file.
37. **A** — @path imports keep the shared CLAUDE.md focused without losing anything or making it personal.
38. **B** — trimming tool output to the needed fields keeps long conversations inside the context window.
39. **C** — normalising in a hook is deterministic and happens before the model reasons over the data.
40. **B** — forking explores an alternative without polluting or losing the original session.

## Score interpretation

This mock uses one question = one mark. The real exam reports a scaled score from 100 to 1,000 with 720 to pass, so treat the percentage here as a diagnostic, not a prediction:

- **36–40:** strong; take the official practice exam and book once it reports 900 or more.
- **32–35:** close; reread the chapters behind every wrong answer, then retake this mock.
- **28–31:** material gaps remain; redo the hands-on labs for your weakest domain.
- **Below 28:** return to the chapter sequence before doing more mocks.

For every wrong answer, write down why the distractor was tempting and which of the six distractor patterns in the final review it matches.
