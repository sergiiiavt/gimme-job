# Final review & checklist

## High-yield distinctions

- **Plan Mode vs acceptEdits:** Plan Mode explores and proposes without editing source code; acceptEdits edits without asking each time.
- **/compact vs /clear:** /compact summarises and keeps the task going; /clear starts fresh for unrelated work.
- **Project vs user scope:** .claude/agents/, .claude/skills/, .mcp.json and the repository CLAUDE.md are shared through the repository; the ~/.claude/ versions are personal. A project subagent wins a name clash.
- **Instructions vs hooks:** CLAUDE.md and skills make behaviour likely; a hook makes a rule certain.
- **Exit codes:** in a PreToolUse hook, exit 2 blocks and sends stderr to Claude, while exit 1 blocks nothing.
- **Subagent vs skill:** a subagent is a separate worker with its own context; a skill is a procedure loaded into the current one.
- **Writer vs reviewer:** a fresh session or a reviewer subagent reviews better than the session that wrote the code.

## Distractors to expect

- "Use a bigger model" when the real fix is context or configuration.
- "Put it in the prompt" when the rule must hold every time, which is a job for a hook.
- "Put it in ~/.claude/" when the whole team needs it.
- "/clear" when the task is not finished, which throws away the work in progress.

## Checklist before the course quiz

- [ ] I can explain the agent loop and why the context window matters.
- [ ] I know the permission modes and the default Shift+Tab cycle.
- [ ] I have used /context, /compact and /clear in a real session.
- [ ] I have written a CLAUDE.md, a subagent and a hook that blocks, from the hands-on lab.
- [ ] I can say when to use CLAUDE.md, a skill, a subagent, MCP or a hook.
- [ ] I scored 13 or more on the practice quiz.

## After Claude Code 101

Claude Code in Action goes deeper into long, hands-off sessions. Introduction to Agent Skills and Introduction to Subagents each take one topic further. For the proctored path, the Claude Code chapter of the Claude CCAR-F tile builds directly on this course.
