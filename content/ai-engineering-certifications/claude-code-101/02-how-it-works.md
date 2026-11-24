# How Claude Code works

The first two sections of Claude Code 101: what a coding agent is, where Claude Code runs, and how permissions keep you in control.

## A coding agent, not a chat window

A chat assistant answers and stops. Claude Code works in a loop inside your project:

1. **Gather context:** read files, search the code, run commands such as git status.
2. **Act:** edit files, run tests, call tools.
3. **Check the result:** read the test output or the error, then decide the next step.

The loop repeats until the task is done or Claude needs you. Everything it reads, plus your conversation, fills the **context window**, which is why managing context is a core skill.

## Where it runs

- **Terminal:** run claude in a project folder.
- **IDE:** the VS Code extension, and the JetBrains plugin, which runs Claude Code in the IDE terminal.
- **Desktop app:** the Code mode of the Claude desktop app.
- **Web:** cloud sessions from claude.ai, with no local install.

Configuration such as CLAUDE.md, skills and hooks works the same on every surface.

## Permission modes

| Mode | What Claude does | Use it when |
| --- | --- | --- |
| default | Asks before editing files or running commands | You are learning, or the change is risky |
| acceptEdits | Edits files without asking; you review the result later, for example in git diff | You trust the direction and will review the diff |
| plan | Reads, explores and writes a plan, but does not edit your source code | The task is large, unclear or touches many files |
| auto | Runs without prompts, with a safety check on each action | Your account offers it and you want long hands-off runs |

- Press **Shift+Tab** to cycle default → acceptEdits → plan. Auto appears in the cycle only when your account meets its requirements.
- Prefix a single prompt with **/plan** to plan just that request, or start with claude --permission-mode plan.
- When a plan is ready, you approve it, choose how edits should be approved, or keep planning with feedback. Ctrl+G opens the plan in your editor.
- **Permission rules** sit on top of modes: allow rules pre-approve specific tools, and deny rules block in every mode.

## Your first prompt

Good first prompts are specific and checkable:

- "Explain how the interview-question catalog is loaded. Don't change anything." A safe way to explore.
- "Add a test for the empty-search case in the catalog filter, run it, and show me the result." Scoped, with a built-in check.

Avoid "improve the code": nothing in it tells Claude, or you, when the task is done.
