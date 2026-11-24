# Hands-on lab in the gimme-job repository

One lab that touches every section of Claude Code 101. Work on a branch in your own clone of gimme-job. You need Claude Code with a Pro, Max or Enterprise account or an API key.

## 1. Project memory

1. Run claude in the repository root, then /init.
2. Edit the draft so CLAUDE.md is short: point to AGENTS.md, and name the fast and full checks (npm run verify:fast while working, npm run verify before publishing).
3. Start a new session and ask "How do I check my change before a PR?" The answer should come from CLAUDE.md.

## 2. Explore and plan

1. Ask: "Explain how /learn/certifications chooses which chapter to show. Don't edit anything."
2. Switch to Plan Mode with Shift+Tab and ask for a plan to add a test for an unknown topic in the URL.
3. Read the plan and push back on one step before approving it.

## 3. A reviewer subagent

Create .claude/agents/test-reviewer.md with a description such as "Use after test files change; reviews tests for weak assertions and missing edge cases", tools limited to Read, Grep and Glob, and a short system prompt. Ask Claude to review your new test with it, and check that the main conversation shows only the summary.

## 4. A hook that blocks

Add a PreToolUse hook in .claude/settings.local.json, for the Edit and Write tools, that exits with code 2 when the target path ends in .env and prints a reason to stderr. Ask Claude to add a variable to .env and confirm that the edit is blocked and that Claude explains why. Then change the script to exit 1 and watch the edit go through: that is the mistake this lab exists to teach.

## 5. Context

Run /context, then /compact, then /context again, and note what changed. Finish with /clear before starting anything unrelated.

## What to keep

The CLAUDE.md, the subagent file and the hook script are three small, concrete things to show in an interview. Delete the .env test change before you push.
