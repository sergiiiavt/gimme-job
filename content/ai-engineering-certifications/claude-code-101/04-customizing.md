# Customizing Claude Code

The fourth section of Claude Code 101 covers five ways to shape Claude Code for a project. The quiz checks which one fits which job.

## CLAUDE.md: project memory

- A Markdown file that Claude reads at the start of every session in the project: how to build and test, conventions, things to avoid.
- **Project:** CLAUDE.md in the repository, committed and shared with the team. **User:** ~/.claude/CLAUDE.md, your personal preferences for every project.
- /init drafts a CLAUDE.md from your codebase, and /memory shows which memory files are loaded.
- Keep it short and concrete. "Run npm run verify before every commit" works; "write good code" does nothing.

## Subagents: delegated specialists

- Markdown files with YAML frontmatter: a name, a description of when to use the subagent, an optional tools list and model, then a system prompt.
- **Project:** .claude/agents/, shared through the repository. **User:** ~/.claude/agents/, available in all your projects. When names clash, the project one wins.
- Built-in subagents include Explore, Plan and general-purpose.
- Each subagent works in **its own context** and returns a summary, which keeps the main conversation clean.
- Write a specific description, such as "Use after test files change", so Claude knows when to delegate. Limit tools: a reviewer rarely needs Edit.

## Skills: reusable procedures

- A folder with a SKILL.md file of instructions, plus any scripts or templates, in .claude/skills/ or ~/.claude/skills/.
- Claude loads a skill when a task matches its description. Run /skills to see what is available.
- Use a skill for "how we do X", such as writing a bug report or a release checklist.

## MCP: external tools and data

- The Model Context Protocol connects Claude Code to other systems: an issue tracker, a database, a browser.
- Add a server with claude mcp add. A project-scoped server lives in .mcp.json in the repository, so the whole team gets it.
- Keep secrets out of the committed file; reference environment variables instead.

## Hooks: rules that always run

- Shell commands that Claude Code runs at fixed points, configured in settings.json. Common events are PreToolUse (before a tool runs), PostToolUse (after it runs), UserPromptSubmit, Stop and SessionStart.
- A PreToolUse hook that **exits with code 2 blocks the tool call**, and its stderr message goes to Claude. Exit code 1 does **not** block anything, a common mistake.
- PostToolUse cannot undo a call that already ran. Its stderr is shown to Claude so the next step can change.
- Use hooks for rules that must hold every time: run the formatter after each edit, block edits to .env, send a notification when Claude needs input.

## Which one?

| You want | Use |
| --- | --- |
| Every session to know how to run the tests | CLAUDE.md |
| Claude never to edit .env, with no exceptions | A PreToolUse hook |
| A test-review specialist with read-only tools | A subagent |
| Bug reports written the same way every time | A skill |
| Claude to read and create Jira issues | An MCP server |

The rule of thumb: instructions such as CLAUDE.md and skills make the right behaviour likely; hooks make a rule certain.
