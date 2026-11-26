# Hands-on lab in the gimme-job repository

Use a disposable scratch copy with synthetic fixtures. The baseline needs Python/Git only; optional live Claude Code work requires a currently supported account/API setup and an authorized usage budget.

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

Use examples/certification-practice/hooks/block_fixture_write.py and the accompanying example settings. Feed synthetic Write/Edit JSON events for .env.training and answer.py through stdin. Expect exit 2 with stderr for the protected fixture and exit 0 for the normal path. Reject malformed events. Do not test against real secrets; the matcher does not sandbox Bash, symlinks or a remote backend.

## 5. Context

Run /context, then /compact, then /context again, and note what changed. Finish with /clear before starting anything unrelated.

## Executable baseline and independent oracle

Use the [offline practice package](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice). Requires Python 3.10+, no model or API key. Run `python examples/certification-practice/practice.py claude-code`: every reference case should pass. Copy `starter.py` to a scratch file; `--candidate your_solution.py` should fail until you implement the required functions. Retain fixture IDs, expected/actual outputs and the command exit status.

| Stage | Task | Check |
| --- | --- | --- |
| Derive | Read requirements before the reference code | Explain the expected outputs independently |
| Implement | Fill only your track’s starter functions | All selected cases pass; the unfinished starter fails |
| Challenge | Introduce an incorrect boundary, source claim or error state | At least one relevant oracle rejects it |
| Review | Explain a plausible mistake and missing production controls | Record limits, not just a green status |

Run the supplied hook tests separately and inspect stdin, stderr and exit status. Retain the minimal diff and an independently derived oracle. A hook matcher is not a general filesystem sandbox. Optional live-tool practice requires authorized access and a usage budget; production writes are outside this sandbox.
