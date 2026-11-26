# 15-question practice quiz

These are original practice questions written for this learning path from Anthropic's public Claude Code documentation. They are **not** the Claude Academy quiz questions.

## Questions 1–10

**1.** How does Claude Code differ from a chat assistant?
A. It needs no permissions because it runs on your machine
B. It only suggests code; you apply every change by hand
C. It answers faster because it always uses a smaller model
D. It works in a loop: reads, acts, checks results, repeats

**2.** You want Claude to study a large, unclear change and propose an approach without editing source code. Which mode fits?
A. Plan mode
B. Auto mode with deny rules removed
C. acceptEdits mode
D. Default mode with prompts off

**3.** Starting from default, what does pressing Shift+Tab cycle through?
A. default → acceptEdits → plan
B. default → auto → plan
C. plan → default → acceptEdits
D. default → bypass → plan

**4.** Mid-task, answers lose focus and /context shows the window nearly full. You want to carry on with the same task. What do you run?
A. /compact, which summarises the conversation so far
B. /init, which rebuilds the project's CLAUDE.md file
C. /clear, then describe the whole task again from scratch
D. /memory, which removes old files from the context

**5.** Where should "run npm run verify before every commit" live so that every teammate's sessions know it?
A. A prompt everyone pastes at the start of each session
B. A subagent's system prompt in ~/.claude/agents/
C. The project CLAUDE.md, committed to the repository
D. Each developer's own ~/.claude/CLAUDE.md file

**6.** A PreToolUse hook must stop Claude from editing .env. Which exit code blocks the edit?
A. Exit code 1, the usual Unix failure code
B. Exit code 2, with the reason printed to stderr
C. Any non-zero exit code blocks the tool call
D. Exit code 0, with the reason printed to stdout

**7.** Why delegate a large codebase search to a subagent?
A. Its findings are written to CLAUDE.md automatically
B. It works in its own context and returns a summary
C. Subagents always run on a larger, stronger model
D. Subagents can skip the permission rules you have set

**8.** Your team wants one shared MCP server configuration for the issue tracker. Where does it go?
A. In a hook that starts the server before each tool
B. In each developer's shell profile as an alias
C. In .mcp.json at the repository root, committed
D. In CLAUDE.md as a list of the tracker's API calls

**9.** Which workflow is useful for a feature with unclear requirements and multiple affected files?
A. Plan → code → explore → review
B. Commit → code → review → plan
C. Code → test → plan → commit
D. Explore → plan → code → commit

**10.** Subagents named test-reviewer exist in both .claude/agents/ and ~/.claude/agents/. Which one runs?
A. Neither; Claude asks you to rename one
B. The user one in ~/.claude/agents/
C. The project one in .claude/agents/
D. Whichever file was edited most recently

## Questions 11–15

**11.** Which job is best done by a skill?
A. Giving Claude read access to the Jira project
B. Writing every bug report in the team's format
C. Blocking every edit to production config files
D. Keeping long log searches out of the main context

**12.** You want an independent review of a diff Claude just wrote. What gives the most independent opinion?
A. Ask the same session to double-check its own work
B. A fresh session, or a reviewer subagent, reads the diff
C. Switch the same session to acceptEdits and rerun it
D. Tell the same session to think harder and try again

**13.** Which statement about PostToolUse hooks is true?
A. They replace the permission prompt for that tool
B. They can block the tool call before it runs
C. They run only when the tool call has failed
D. They run after the tool and cannot undo the call

**14.** For optional live Claude Code practice, beyond editor and CLI basics, what should you have?
A. A supported Claude Code account/API setup with an authorized usage budget
B. A Free Claude account, which includes Claude Code
C. A Claude Partner Network membership email address
D. A JetBrains IDE licence for the Claude Code plugin

**15.** What is /init for?
A. Installing Claude Code into a new project
B. Listing the MCP servers that are connected
C. Drafting a CLAUDE.md file from your codebase
D. Resetting the conversation before a new task

## Answer key with explanations

1. **D** — an agent gathers context, acts and checks the result in a loop; a chat assistant answers and stops.
2. **A** — Plan Mode reads, explores and writes a plan without editing your source code.
3. **A** — the default cycle is default → acceptEdits → plan; auto joins only when your account offers it.
4. **A** — /compact keeps the task going in less space; /clear is for switching to an unrelated task.
5. **C** — the committed project CLAUDE.md reaches every teammate; a user-level file reaches only its owner.
6. **B** — only exit code 2 blocks a PreToolUse call, and stderr tells Claude why; exit 1 lets the call through.
7. **B** — the subagent's own context absorbs the noisy search, and the main conversation gets just the summary.
8. **C** — a project-scoped server in a committed .mcp.json is shared with everyone who clones the repository.
9. **D** — explore first, plan before editing, then code and commit small, reviewable steps.
10. **C** — when names clash, the project subagent takes priority over the user one.
11. **B** — a skill packages a repeatable procedure; check the resulting report against the rubric.
12. **B** — a fresh context does not share the writer's assumptions; the same session tends to repeat its blind spots.
13. **D** — PostToolUse runs after the tool, so it cannot block it; it can only feed information back to Claude.
14. **A** — Check current supported account/API access. The offline exercise baseline needs neither paid calls nor a particular subscription list.
15. **C** — /init reads the codebase and drafts a CLAUDE.md for you to trim and commit.

## Score interpretation

One correct answer earns one practice mark. The result is diagnostic, not an official exam score or a readiness threshold.
