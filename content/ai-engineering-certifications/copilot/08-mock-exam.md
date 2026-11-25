# 30-question original mock exam

Set a **50-minute timer** (the real GH-300 allows about 100 minutes for a longer paper) and answer all 30 before opening the key. These are original practice questions written for this learning path from the public GH-300 study guide. They are **not Microsoft or GitHub exam questions**.

## Questions 1–10

**1.** Which Copilot plans let an organization configure content exclusion?
A. Every plan, including Copilot Free for individuals
B. Enterprise only, through the enterprise account settings
C. Free and Pro, the plans for individual developers
D. Business and Enterprise, the plans for organizations

**2.** You excluded secrets/** an hour ago, but one developer still gets suggestions drawing on those files. What do you check first?
A. Rename the excluded files with a different extension so that they are skipped
B. Check pattern, scope, supported client/feature and policy refresh
C. Open a support ticket straight away, since exclusions always apply instantly
D. Disable Copilot for the whole organization until the issue is fully resolved

**3.** Which statement about content exclusion is accurate?
A. It encrypts excluded files at rest so that Copilot is unable to decode them
B. It is a security boundary: no AI tool anywhere can read an excluded file
C. It limits Copilot's context; support varies and semantic details can leak
D. It also applies to every third-party AI extension installed in the IDE

**4.** Legal wants to minimise the chance of suggestions that reproduce public code. Which setting addresses this directly?
A. Turn off Copilot Chat for every member of the organization
B. Move all developers from Copilot Business to the Free plan
C. Exclude every repository in the organization from Copilot
D. Block "suggestions matching public code" at organization level

**5.** Public-code matches are allowed in your organization. What helps developers judge the licence risk of a suggestion?
A. GitHub Spark, which scans generated code for any licence conflicts
B. The Copilot metrics API, which reports acceptance rates per language
C. The organization audit log, which records every accepted suggestion
D. Code referencing, which shows the matching public code and its licence

**6.** Repository-wide guidance such as "use Vitest, never Jest" should go in which file?
A. The scripts section of the project's package.json
B. README.md in the root of the repository
C. .copilotignore in the root of the repository
D. .github/copilot-instructions.md in the repository

**7.** You want rules that apply only when Copilot works on test files. What is the right mechanism?
A. A comment at the top of every test file that describes the rules
B. A copilot-instructions.md placed in every folder that holds tests
C. .github/instructions/tests.instructions.md with applyTo: "**/*.test.ts"
D. A VS Code user setting that each developer adds on their own machine

**8.** The team wants one reusable prompt for generating API tests that anyone can run the same way. Where does it live?
A. A GitHub Gist linked from the team's wiki page
B. A pinned message in the team's Slack channel
C. .github/prompts/api-tests.prompt.md in the repository
D. .github/workflows/api-tests.yml in the repository

**9.** Which Copilot capability edits several files, runs terminal commands with your approval, and iterates until failing tests pass?
A. Ask mode in Copilot Chat in the IDE
B. Agent mode in Copilot Chat in the IDE
C. Inline suggestions in the code editor
D. Pull request summaries on github.com

**10.** You assign a GitHub issue to Copilot, and it works in its own environment and opens a draft pull request. What is this?
A. The Copilot cloud agent, formerly called the coding agent
B. Copilot CLI, running inside a GitHub Actions workflow job
C. Next edit suggestions, running in the developer's own IDE
D. GitHub Spark, building a small app from the issue's text

## Questions 11–20

**11.** Which Copilot Chat slash command generates unit tests for the selected code?
A. /tests, which writes tests for the selected code
B. /explain, which explains how the selected code works
C. /fix, which proposes a fix for problems in the code
D. /doc, which writes documentation comments for the code

**12.** In VS Code chat you want an answer that draws on the whole repository, not just the open file. What do you add?
A. @terminal, to ask about the integrated terminal
B. @workspace or #codebase in the prompt
C. #selection, to attach the highlighted code
D. /new, to scaffold a brand-new project

**13.** An admin must grant Copilot seats to 200 new hires automatically from the HR system. What should they use?
A. An export of the organization's audit log every morning
B. Content exclusion settings configured for the organization
C. The Copilot user management endpoints of the REST API
D. A Copilot Space shared with every new hire on day one

**14.** Security asks who changed a Copilot policy last week. Where do you look?
A. The Copilot Chat history of each administrator
B. The organization or enterprise audit log
C. The Copilot usage metrics dashboard for the org
D. The IDE logs on each developer's own machine

**15.** In the simplified suggestion architecture taught here, which sequence is conceptually correct?
A. The IDE builds the prompt, a proxy screens it, the model replies, filters run
B. The model responds, the IDE builds the prompt, then the proxy filters it
C. The suggestion is shown first and is filtered only after it is accepted
D. The proxy writes the prompt, the IDE filters it, then the model replies

**16.** What does Copilot mainly use as context for inline suggestions?
A. A live search across all public code on GitHub at request time
B. Code around the cursor, open tabs and related files in the project
C. Only the current line, so that suggestions stay fast and focused
D. The developer's browser history and recently visited documentation

**17.** Copilot keeps generating generic code for a parsing function. Which change helps most?
A. A specific comment of intent with an input/output example
B. Accepting the first suggestion, then fixing it by hand
C. Closing every other file so Copilot focuses on this one
D. A shorter, vaguer comment that gives Copilot more room

**18.** What is few-shot prompting?
A. Keeping every prompt under a few dozen tokens to save context
B. Asking the same question several times in a row for consistency
C. Including several demonstrations of the desired pattern in the prompt
D. Lowering the temperature to get more stable, repeatable answers

**19.** Copilot-generated tests all pass, but a known bug still ships. What most likely happened?
A. The tests asserted current, buggy behaviour instead of the specification
B. The tests should have been generated with /fix rather than with /tests
C. Copilot cannot write unit tests, so the generated tests were never run
D. The team needs Copilot Enterprise for test generation to be reliable

**20.** Which practice reflects responsible use of AI-generated code?
A. Review, test and scan it exactly as you would a colleague's code
B. Assume suggestions are licence-compliant because Copilot filters them
C. Skip security scanning for AI-generated code to keep pipelines fast
D. Commit it without review whenever it compiles and the tests pass

## Questions 21–30

**21.** What is GitHub Copilot CLI?
A. A linter that checks GitHub Actions workflow files for common mistakes
B. A self-hosted runner that executes GitHub Actions jobs on your machine
C. An agentic assistant in the terminal that edits files and runs commands
D. A browser extension that adds extra Copilot features to github.com pages

**22.** Which is a real limitation of Copilot that developers must plan for?
A. It never repeats insecure patterns that appear in its training data
B. It always returns the same output for the same prompt and context
C. It knows the content of your company's private intranet pages
D. It can produce plausible but wrong or outdated API usage

**23.** The team wants advisory Copilot review to use its checklist. Where should supported repository guidance live?
A. A comment that each reviewer pastes into every pull request
B. Repository instruction files such as copilot-instructions.md
C. The CODEOWNERS file, which lists who must approve each path
D. The branch protection rules configured on the default branch

**24.** An organization wants Copilot code review on github.com but agent mode disabled in IDEs for now. How?
A. Set the feature policies in the organization's Copilot settings
B. Use content exclusion to exclude every repository from agent mode
C. Create a .copilotignore file that lists agent mode as disabled
D. Ask every developer to uninstall the Copilot extension from their IDE

**25.** Agent mode needs to query your team's issue tracker during a task. What extends it with that capability?
A. The tracker's URL added to copilot-instructions.md as a reference
B. An MCP server for the tracker, configured for agent mode to call
C. The tracker open in a browser tab next to the IDE while you work
D. The tracker's API documentation pasted into every chat request

**26.** A long agent session slows down because exploratory research fills its context. What does the GH-300 outline point you to?
A. Delegate side tasks to sub-agents so the main session stays lean
B. Start every new task in a fresh IDE window so the context resets
C. Turn off MCP servers so the agent has fewer tools to consider
D. Switch to inline suggestions for the rest of the task instead

**27.** Before generating tests for a date-parsing function, which prompt produces the most useful suite?
A. "Write tests that pass", so the pipeline stays green on the branch
B. "List edge cases from the spec first, then write a test for each"
C. "Write tests", with the function selected and nothing else added
D. "Write as many tests as possible", to push coverage numbers up

**28.** Copilot suggests a call to a library method you have never seen. What is the responsible next step?
A. Accept it, since Copilot suggestions come from real code it has seen
B. Ask Copilot whether the method exists and trust its confirmation
C. Wrap the call in a try/catch so the code survives if it is missing
D. Check the library's documentation or source before relying on it

**29.** Who is responsible for code that Copilot suggests and a developer accepts into the repository?
A. GitHub, because the suggestion came from its hosted model service
B. Nobody in particular, since AI-generated code has no clear owner
C. The developer and organization that accept and ship it, as with any code
D. The authors of the public code the model was originally trained on

**30.** In a simplified architecture with a documented proxy, what is its screening role?
A. It attaches the full contents of every repository in the org
B. It stores the prompt permanently to retrain a model for your org
C. It translates the prompt into English so the model can follow it
D. It screens it, for example for toxic content or hacking attempts

## Answer key with explanations

1. **D** — content exclusion is an organization feature of Copilot Business and Copilot Enterprise.
2. **B** — exclusion changes take time to reach editors and a pattern that does not match does nothing; verify and refresh before escalating.
3. **C** — GitHub documents semantic leakage through IDE-provided information and uneven support on agentic surfaces; treat exclusion as hygiene, not a vault.
4. **D** — the duplication filter checks suggestions against public code and drops matches when set to Block.
5. **D** — code referencing shows where a match came from and under which licence, so the developer can decide.
6. **D** — Copilot reads repository custom instructions from .github/copilot-instructions.md.
7. **C** — path-specific instruction files use an applyTo glob, so the rules follow the files wherever they live.
8. **C** — prompt files in .github/prompts/ are versioned with the repository and run from chat for consistent results.
9. **B** — agent mode plans and executes multi-step work, reads errors and retries, with approval for commands.
10. **A** — the cloud agent works asynchronously on GitHub's infrastructure, starting from an issue and delivering a PR for review.
11. **A** — /tests writes tests; the others fix, explain or document.
12. **B** — workspace and codebase context widen retrieval to the repository; #selection narrows it.
13. **C** — seat assignment and removal can be scripted through the REST API.
14. **B** — Copilot settings and seat changes are recorded as audit log events.
15. **A** — This is a conceptual client/context/model/filter flow, not an invariant implementation or security guarantee for every Copilot surface.
16. **B** — inline suggestions are built from nearby code and other open files; keeping relevant files open improves them.
17. **A** — specific intent with an example is GitHub's prompting basics: single, specific, short, surround.
18. **C** — zero-shot gives only the instruction; few-shot adds examples that show the pattern.
19. **A** — generated tests often mirror the code they read; expected values must come from requirements.
20. **A** — the developer stays accountable; validation, testing and scanning apply to AI output exactly as to human code.
21. **C** — Copilot CLI is an interactive, agentic Copilot in the terminal that works on local files with approval.
22. **D** — LLMs can hallucinate APIs and reproduce insecure patterns, and their output varies between runs.
23. **B** — Repository instructions guide review; they do not deterministically enforce every checklist item or replace required checks.
24. **A** — organization policies switch individual Copilot features on or off, including code review and IDE features.
25. **B** — agent mode reaches external systems through MCP servers.
26. **A** — the August 2026 outline names delegating to sub-agents to optimise context use.
27. **B** — expected behaviour from the specification first, then tests, avoids asserting whatever the code currently does.
28. **D** — verify unfamiliar APIs against documentation or source; the model can confirm its own hallucination.
29. **C** — The accepting developer and organization remain responsible for review and release decisions. This is not a universal legal-ownership ruling.
30. **D** — Screening may apply documented filters; verify the actual client/feature contract rather than inferring a universal filter pipeline or retention guarantee.

## Score interpretation

This mock uses one question = one mark. GH-300 reports a scaled score out of 1,000 with 700 to pass, so treat the percentage here as a diagnostic:

- **27–30:** strong; take Microsoft's free practice assessment, then book.
- **24–26:** close; reread the chapters behind every wrong answer.
- **21–23:** material gaps remain; redo the Copilot lab in the gimme-job repository.
- **Below 21:** return to the chapter sequence before doing more mocks.

Recheck current privacy and safeguard support on the client and plan you use. This practice set does not establish candidates' official error rates.
