# Daily workflows

The third section of Claude Code 101: a repeatable way to work, keeping the context window healthy, and reviewing what Claude wrote.

## Explore → plan → code → commit

| Step | What you ask | Why |
| --- | --- | --- |
| Explore | "Read the vacancy filter and its tests. Don't write code yet." | Claude learns the code before changing it |
| Plan | Switch to Plan Mode: "Plan how to add a salary filter." | You catch a wrong approach before any edit |
| Code | Approve the plan: "Implement it and run the tests." | Changes follow the plan you checked |
| Commit | "Commit with a message that explains why." | Small, reviewable history |

Skipping explore and plan is the most common reason for a large, wrong diff. For a one-line fix, going straight to code is fine.

## Managing context

| Command | What it does | Use it when |
| --- | --- | --- |
| /context | Shows what is using the context window | Responses get slower or less focused |
| /compact | Summarises the conversation so far to free space | You are mid-task and want to keep going |
| /clear | Starts a fresh conversation in the same project | You switch to an unrelated task |

- Start a new task with /clear rather than carrying an old task's context along.
- Delegate noisy work, such as searching a large codebase or reading long logs, to a **subagent**. It works in its own context and returns only a summary.
- Put durable facts, such as how to run tests, in **CLAUDE.md** instead of repeating them in every session.

## Code review

- Ask for a review of the diff before you commit: "Review the staged changes for bugs and missing tests."
- A **fresh session or a reviewer subagent** is a better reviewer than the session that wrote the code, because it does not share the writer's assumptions.
- Ask for findings ranked by severity, each with file and line, so you can act on them.
- Treat the review as input. You still read the diff and run the tests yourself.

## A QA example

A flaky end-to-end test fails one run in five.

1. **Explore:** "Read the test and the page it covers. List what could make it nondeterministic. Don't edit."
2. **Plan:** "Propose a fix that removes the cause, not a longer timeout."
3. **Code:** "Apply it and run the test 20 times in a loop."
4. **Commit:** "Commit with the root cause in the message."

## A bounded debugging task

Reproduce member=true, subtotal=100 returning 10 instead of 20. Read the relevant function and tests, add the missing boundary, make the compatible comparison fix, then rerun affected checks. If context is compacted, retain the exact requirement, failing input, changed files and test results. A compacted summary can lose facts; reread the source before the next decision.
