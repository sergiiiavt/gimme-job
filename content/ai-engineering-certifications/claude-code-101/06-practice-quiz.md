# 15-question practice quiz

Answer all 15 before opening the key; about 15 minutes is plenty. These are original practice questions written for this learning path from Anthropic's public Claude Code documentation. They are **not** the Claude Academy quiz questions.

## Questions 1–10

**1.** How does Claude Code differ from a chat assistant?
A. It answers faster because it always uses a smaller model
B. It only suggests code; you apply every change by hand
C. It works in a loop: reads, acts, checks results, repeats
D. It needs no permissions because it runs on your machine

**2.** You want Claude to study a large, unclear change and propose an approach without editing source code. Which mode fits?
A. Plan mode
B. acceptEdits mode
C. Default mode with prompts off
D. Auto mode with deny rules removed

**3.** Starting from default, what does pressing Shift+Tab cycle through?
A. default → auto → plan
B. plan → default → acceptEdits
C. default → bypass → plan
D. default → acceptEdits → plan

**4.** Mid-task, answers lose focus and /context shows the window nearly full. You want to carry on with the same task. What do you run?
A. /clear, then describe the whole task again from scratch
B. /compact, which summarises the conversation so far
C. /init, which rebuilds the project's CLAUDE.md file
D. /memory, which removes old files from the context

**5.** Where should "run npm run verify before every commit" live so that every teammate's sessions know it?
A. The project CLAUDE.md, committed to the repository
B. Each developer's own ~/.claude/CLAUDE.md file
C. A prompt everyone pastes at the start of each session
D. A subagent's system prompt in ~/.claude/agents/

**6.** A PreToolUse hook must stop Claude from editing .env. Which exit code blocks the edit?
A. Exit code 0, with the reason printed to stdout
B. Exit code 1, the usual Unix failure code
C. Exit code 2, with the reason printed to stderr
D. Any non-zero exit code blocks the tool call

**7.** Why delegate a large codebase search to a subagent?
A. Subagents always run on a larger, stronger model
B. It works in its own context and returns a summary
C. Subagents can skip the permission rules you have set
D. Its findings are written to CLAUDE.md automatically

**8.** Your team wants one shared MCP server configuration for the issue tracker. Where does it go?
A. In each developer's shell profile as an alias
B. In CLAUDE.md as a list of the tracker's API calls
C. In a hook that starts the server before each tool
D. In .mcp.json at the repository root, committed

**9.** Which workflow does Claude Code 101 teach for any feature or task?
A. Code → test → plan → commit
B. Plan → code → explore → review
C. Explore → plan → code → commit
D. Commit → code → review → plan

**10.** Subagents named test-reviewer exist in both .claude/agents/ and ~/.claude/agents/. Which one runs?
A. The project one in .claude/agents/
B. The user one in ~/.claude/agents/
C. Whichever file was edited most recently
D. Neither; Claude asks you to rename one

## Questions 11–15

**11.** Which job is best done by a skill?
A. Blocking every edit to production config files
B. Writing every bug report in the team's format
C. Giving Claude read access to the Jira project
D. Keeping long log searches out of the main context

**12.** You want an independent review of a diff Claude just wrote. What gives the most independent opinion?
A. Ask the same session to double-check its own work
B. Tell the same session to think harder and try again
C. Switch the same session to acceptEdits and rerun it
D. A fresh session, or a reviewer subagent, reads the diff

**13.** Which statement about PostToolUse hooks is true?
A. They can block the tool call before it runs
B. They run only when the tool call has failed
C. They run after the tool and cannot undo the call
D. They replace the permission prompt for that tool

**14.** Besides editor and command-line basics, what do you need for Claude Code 101's hands-on parts?
A. A Pro, Max or Enterprise account, or an API key
B. A Free Claude account, which includes Claude Code
C. A Claude Partner Network membership email address
D. A JetBrains IDE licence for the Claude Code plugin

**15.** What is /init for?
A. Resetting the conversation before a new task
B. Drafting a CLAUDE.md file from your codebase
C. Installing Claude Code into a new project
D. Listing the MCP servers that are connected

## Answer key with explanations

1. **C** — an agent gathers context, acts and checks the result in a loop; a chat assistant answers and stops.
2. **A** — Plan Mode reads, explores and writes a plan without editing your source code.
3. **D** — the default cycle is default → acceptEdits → plan; auto joins only when your account offers it.
4. **B** — /compact keeps the task going in less space; /clear is for switching to an unrelated task.
5. **A** — the committed project CLAUDE.md reaches every teammate; a user-level file reaches only its owner.
6. **C** — only exit code 2 blocks a PreToolUse call, and stderr tells Claude why; exit 1 lets the call through.
7. **B** — the subagent's own context absorbs the noisy search, and the main conversation gets just the summary.
8. **D** — a project-scoped server in a committed .mcp.json is shared with everyone who clones the repository.
9. **C** — explore first, plan before editing, then code and commit small, reviewable steps.
10. **A** — when names clash, the project subagent takes priority over the user one.
11. **B** — a skill packages "how we do X" so it is done the same way every time.
12. **D** — a fresh context does not share the writer's assumptions; the same session tends to repeat its blind spots.
13. **C** — PostToolUse runs after the tool, so it cannot block it; it can only feed information back to Claude.
14. **A** — Claude Code needs Pro, Max or Enterprise, or an API key; it is not part of the Free plan.
15. **B** — /init reads the codebase and drafts a CLAUDE.md for you to trim and commit.

## Score interpretation

This quiz uses one question = one mark. The real course quiz only needs passing, so use the score to decide what to reread:

- **14–15:** strong; take Claude Code 101 on Claude Academy now.
- **12–13:** close; reread the chapter behind each wrong answer.
- **11:** gaps remain; redo steps 3 and 4 of the hands-on lab, then retake.
- **Below 11:** read the three study chapters again and do the lab before the course.
