# Final review

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
- "Put it in the prompt" when the rule must hold every time, which needs a deterministic control at the relevant execution boundary; a hook only covers its configured events.
- "Put it in ~/.claude/" when the whole team needs it.
- "/clear" when the task is not finished, which throws away the work in progress.
