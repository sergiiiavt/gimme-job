# AI coding agents in QA work

A coding agent is the agent loop applied to a code repository. Tools such as Claude Code, OpenAI Codex, GitHub Copilot's coding agent and Cursor read files, search the code, edit it and run commands, then show you a diff or open a pull request. For QA engineers they can write and repair tests, reproduce bugs, explain CI failures and review changes, and they can also produce tests that look right and check nothing.

This chapter covers what a coding agent is, how to give it a project's rules, which QA tasks fit it, how to check its work, how this site is built with agents, and what the evidence says about productivity. Evaluating agents in general is covered in [Evaluating agents and tool use](/learn/llm?topic=agent-testing).

**Prerequisites:** [How an AI agent works](/learn/agentic?topic=how-agents-work), [Human approval and action boundaries](/learn/agentic?topic=human-approval).

## What a coding agent is

The loop is the same as in any agent; the tools are the repository and the shell:

```diagram
Task from you ("make the checkout test stable")
        ↓
Agent reads instructions files, searches and reads code
        ↓
Agent edits files and runs commands (tests, linters, builds)
        ↓
Agent reads the output and decides the next step        (repeat)
        ↓
Result: a diff, a commit or a pull request for review
```

Coding agents differ mainly in where they run and how much they may do on their own:

| Setting | Typical form | What to watch |
|---|---|---|
| Local, interactive | A CLI or IDE agent in your checkout | Permission mode: which commands and edits need your confirmation |
| Cloud, asynchronous | An agent works in a sandbox and opens a pull request | What the sandbox can reach: secrets, networks, other repositories |
| CI-triggered | An agent fixes failing checks or answers review comments | Who reviews its commits before they merge |

The permission model is the approval gate from the [previous chapter](/learn/agentic?topic=human-approval) applied to your machine: reading is cheap, editing should be reviewable, and running commands, installing packages, pushing and deleting deserve explicit control.

## Give the agent the project's rules

An agent knows the language and common frameworks; it does not know your project's conventions, invariants or definition of done. Write them down where agents read them.

**AGENTS.md** is a plain Markdown file at the repository root, described by its maintainers as a README for agents: how to build, how to test, what not to touch. Many coding agents read it, nested files can cover parts of a monorepo, the file closest to the edited code wins, and an explicit instruction in the chat overrides it. Claude Code reads its own `CLAUDE.md` files and falls back to `AGENTS.md` when there is no `CLAUDE.md`. Both are context, not enforcement: the agent is asked to follow them, and hooks, CI and permissions are what actually enforce anything.

A useful instructions file for a test project is short and concrete:

```markdown
# Agent instructions

## Commands
- Install: `npm ci`
- Fast checks while working: `npm run lint && npm run test:unit`
- Before finishing: `npm run verify` (all must pass)

## Testing rules
- Test behaviour through public functions, API responses or rendered output, not source text.
- Never delete, skip or weaken an existing assertion to make a test pass. If a test is wrong, say why.
- A bug fix starts with a test that fails before the fix and passes after it.
- No real network calls or production credentials in tests; use the fixtures in `tests/fixtures`.

## Scope
- Change only the files the task needs. Ask before touching CI configuration or dependencies.
```

Keep one source of truth. This repository keeps its rules in `AGENTS.md`, and its `CLAUDE.md` only points there, so the two never drift apart.

## Good QA tasks for an agent

| Task | Why it fits | What you check |
|---|---|---|
| Reproduce a bug as a failing test | Clear goal, verifiable result | The test fails for the reported reason, not for a setup error |
| Write tests for a well-specified function | The specification is the oracle | Cases come from the specification, not from reading the implementation |
| Stabilise a flaky test | Agents are patient with logs and reruns | The fix removes the cause (wait, data, order), not the symptom (retry, longer sleep) |
| Migrate tests to a new API or framework version | Repetitive, mechanical, testable | Same number of meaningful assertions before and after |
| Explain a failing CI run | Long logs, needle in a haystack | The explanation points at a concrete line you can verify |
| Generate test data or fixtures | Tedious to write by hand | Edge cases are present; no real personal data |
| Review a pull request for missing tests | Systematic reading | Suggestions name concrete untested branches |

The common thread is a result you can check without trusting the agent: a test that fails and then passes, a diff you can read, a log line you can find.

## Tasks to keep for yourself

Some decisions should stay with a person, even when an agent can produce an answer:

- **Deciding what correct behaviour is.** When the specification is silent, an agent will infer the expected result from the current code, which turns today's bug into tomorrow's assertion.
- **Making a red build green at any cost.** Agents asked to "make the tests pass" sometimes delete assertions, loosen expected values or skip tests. Ask for the cause instead.
- **Anything with production access or real secrets.** Give agents sandboxes and test credentials.
- **Large refactors without a safety net.** Without tests to catch regressions, a large agent-written refactor is a large unreviewed change.

## Checking an agent's work

Treat agent output as a pull request from a fast, confident colleague who has never seen your product. Run the tests yourself, read the whole diff, and look for the specific ways test changes go wrong:

| Warning sign | What it usually means |
|---|---|
| Assertions removed or fewer than before | The test now checks less |
| Expected values widened (`== 201` became `in (200, 201)`) | A real behaviour change was hidden |
| Tests marked skip or expected-failure | The problem was postponed, not solved |
| Assertions that only check truthiness (`assert items`) | Almost any result passes |
| Mocks of the very code under test | The test verifies the mock |
| Sleeps or retries added to a flaky test | The race is still there |

Some of these are easy to flag automatically. The function below reads a diff of a test file and reports suspicious changes; a real version would run in CI on every pull request that touches tests.

```python
import re

DIFF = """\
-    assert response.status == 201
+    assert response.status in (200, 201)
-    assert order["total"] == 105.40
+    @mark.skip(reason="flaky on CI")
+    def test_refund_rounding():
-    assert len(items) == 3
+    assert items
"""

def review_test_diff(diff):
    removed = [line[1:].strip() for line in diff.splitlines() if line.startswith("-")]
    added = [line[1:].strip() for line in diff.splitlines() if line.startswith("+")]
    findings = []
    removed_asserts = sum(1 for line in removed if line.startswith("assert "))
    added_asserts = sum(1 for line in added if line.startswith("assert "))
    if added_asserts < removed_asserts:
        findings.append(f"{removed_asserts - added_asserts} assertion(s) removed")
    for line in added:
        if re.search(r"skip|xfail", line):
            findings.append(f"test disabled: {line}")
        if re.fullmatch(r"assert \w+", line):
            findings.append(f"only checks truthiness: {line}")
        if line.startswith("assert ") and " in (" in line:
            findings.append(f"expected value widened: {line}")
    return findings

for finding in review_test_diff(DIFF):
    print("-", finding)
```

Automated flags direct attention to common weakening patterns; they do not replace reading the diff or prove that every weakened assertion was detected.

## Case study: building this site with agents

Much of GimmeJob, including this learning section, is written with coding agents. What makes that workable is not the agent but the rules and checks around it:

- **One instructions file.** `AGENTS.md` defines the scope rules, the product invariants (for example, that public learning content stays in Git and that every learning surface is registered once for retrieval), how tests should be written, and the release process. `CLAUDE.md` only points to it.
- **One command that decides "done".** `npm run verify` runs linting, type checks, content validators, the build, the test suite and the deployment artifact check. A green build alone does not count.
- **Small pull requests with a written reason.** Each change goes through a draft pull request, CI and static analysis before merge, and production is checked after deployment.
- **Checks that catch the agent, too.** While fixing a layout bug on phones, the agent found that the CSS class meant for exactly that case had never been defined; the fix came with a small test ("every CSS class the component uses must exist") so it cannot happen again. Static analysis has also flagged an agent's change for being too complex, and the change had to be split before merge.

The pattern generalises: the more an agent does, the more the project needs explicit rules, one trusted verification command, and reviewable units of change.

## What the evidence says about productivity

Claims about agent productivity range from enormous to negative, and the careful studies are humbling. In METR's randomized study of experienced open-source developers working on their own repositories with early-2025 tools, tasks took about 19% longer when AI was allowed, while the developers believed AI had made them about 20% faster. METR's February 2026 follow-up, with newer agentic tools, more developers and over 800 tasks, estimated a time reduction of 18% for returning developers and 4% for new ones, with uncertainty wide enough to include no effect; the authors called the evidence very weak and changed their study design, partly because developers increasingly refused to work without AI.

Two lessons follow for QA. First, perception is not evidence: measure on your own work, for example by comparing defects escaping, review time and rework for agent-written and human-written changes. Second, benchmarks such as SWE-bench, which judge an agent by whether a repository's own tests pass after its change, are only as good as those tests; an agent that games weak tests scores well and ships bugs.

## Common mistakes

- **No instructions file.** The agent guesses conventions and commands, differently every time.
- **Duplicated instructions.** `AGENTS.md`, `CLAUDE.md` and a wiki page that disagree are worse than one file.
- **"Make the tests pass".** Ask for the cause of the failure; otherwise expect weakened assertions.
- **Letting the agent define correct behaviour.** Expected results come from the specification or from you, not from the current code.
- **Reviewing the summary instead of the diff.** The agent's description of its change is not the change.
- **Broad permissions by default.** Production credentials and unrestricted shell access turn small mistakes into incidents.
- **Assuming a speed-up.** Measure outcomes; developers consistently overestimate the gain.

## Summary

A coding agent is the agent loop working on a repository with file, search and shell tools, so its permissions are an approval gate on your machine. Write the project's rules once, in an instructions file such as `AGENTS.md`, and enforce what matters through CI rather than through instructions alone. Give agents tasks with checkable results, keep decisions about correct behaviour for yourself, and review every test change for removed assertions, widened expectations, skips and truthiness checks. Treat productivity claims, including your own impression, as hypotheses to measure.
