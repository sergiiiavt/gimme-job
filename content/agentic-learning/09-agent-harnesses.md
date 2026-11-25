# Agent harnesses and harness engineering

An agent is a model plus a **harness**: everything around the model that turns its predictions into work. The harness runs the loop, assembles the context, defines the tools, executes them in a sandbox, enforces permissions, compacts long sessions and decides when a run is finished. The short form that became common in 2026 is *Agent = Model + Harness*.

**Harness engineering** is the practice of designing and improving that surrounding system on purpose, so that an agent gets things right more often on the first attempt and catches its own mistakes before a person has to. The term spread in February 2026 through Mitchell Hashimoto's account of adopting coding agents, OpenAI's report on building a product with Codex agents, and LangChain's posts on agent harnesses; Birgitta Böckeler's article on martinfowler.com then gave it a mental model. For QA engineers the topic is close to home: most of a good harness is checks, test infrastructure and feedback loops, which is work QA already knows how to do.

This chapter covers what a harness is and which part of it you own, why it moves results as much as the model, the guides-and-sensors model, the loop that turns each agent mistake into a harness change, harnesses for long-running work, making a codebase legible to agents, where each check should run, how to test the harness itself, and when to remove parts of it.

**Prerequisites:** [How an AI agent works](/learn/agentic?topic=how-agents-work), [AI coding agents in QA work](/learn/agentic?topic=coding-agents-for-qa), [Evaluating and observing agents](/learn/agentic?topic=agent-observability).

## What a harness is

The broadest definition, from LangChain, is that everything that is not the model is the harness: code, configuration and execution logic. That is too wide to be useful on its own, so it helps to split it into layers by who can change them:

```diagram
Model                  the weights: reads the context, proposes the next action
   ↑ wrapped by
Builder harness        the loop, system prompt, built-in tools, sandbox, compaction,
                       subagents and permission modes of the product you use
   ↑ wrapped by
User harness           your AGENTS.md, skills, custom tools, hooks, linters, tests,
                       CI gates, sandbox policy and review steps
```

| Layer | Examples | Who changes it |
|---|---|---|
| Model | Claude, GPT, Gemini and open-weight models | The provider; you only choose |
| Builder harness | Claude Code, Codex, Copilot's coding agent, Cursor; agent SDKs such as the Claude Agent SDK or LangChain's `create_agent` | The product team, or you if you build the agent on an SDK |
| User harness | Instructions files, project skills, hooks, scripts the agent may call, test suites, structural checks, CI, permissions | Your team |

If you build your own agent, as in [How an AI agent works](/learn/agentic?topic=how-agents-work), you write the builder harness too: the loop, the [tools](/learn/agentic?topic=tool-design), the [context management](/learn/agentic?topic=state-memory-rag) and the [approval gates](/learn/agentic?topic=human-approval) are all harness. If you use a coding agent, the builder harness is given and your leverage is the user harness. The rest of this chapter focuses on that outer layer, because it is where a QA team has the most influence.

## Why the harness matters as much as the model

A benchmark score belongs to a model running in a particular harness, not to the model alone. Several public results show how large the harness effect can be:

| Evidence | What changed | Result |
|---|---|---|
| LangChain's coding agent on Terminal Bench 2.0 (February 2026) | Only the harness: prompts, a verification step before finishing, loop detection, time budgets and reasoning settings; the model stayed `gpt-5.2-codex` | 52.8% → 66.5%, from outside the top 30 to the top 5 |
| Anthropic's long-running application builder (March 2026) | A single agent versus a planner, generator and separate evaluator | The single run took 20 minutes and about $9; the full harness took 6 hours and about $200, with a much more complete application |
| Anthropic's SWE-bench Verified result for Claude 3.5 Sonnet | A deliberately minimal harness: a bash tool and a file editor | 49%, showing how much a capable model does with very little scaffolding |

Two lessons follow for anyone who evaluates agents:

- **Compare like with like.** To compare models, keep the harness fixed; to compare harnesses, keep the model fixed. A leaderboard that mixes both tells you which combination won, not which part caused it. The same point is made for public benchmarks in [Benchmarks, human evaluation and governance](/learn/llm?topic=pro-practice).
- **Harness changes need evaluation like any other change.** A new instruction or hook can help one task and hurt five others; LangChain warns explicitly that changes overfitted to single tasks cause regressions elsewhere.

## Guides and sensors

Böckeler's model sorts the controls in a harness along two axes. **Guides** act before the agent acts (feedforward): they make a good first attempt more likely. **Sensors** act after it acts (feedback): they observe the result and let the agent correct itself. Each control is also either **computational**, run by ordinary deterministic code, or **inferential**, run by a model.

| Control | Computational (deterministic, cheap) | Inferential (model-based, slower, probabilistic) |
|---|---|---|
| **Guide** (before the action) | Project templates, code generators and codemods, a bootstrap script, typed APIs that make the wrong call impossible | Conventions in `AGENTS.md`, skills with how-to steps, examples of good tests, a written test strategy |
| **Sensor** (after the action) | Test suites, type checks, linters, structural and architecture tests, mutation testing, coverage of changed lines | AI code review against a checklist, an LLM judge checking a change against the specification, an evaluator agent clicking through the UI |

Both directions are needed. With guides only, the agent follows rules but nobody learns whether they worked; with sensors only, it repeats the same mistakes and burns tokens being corrected. Prefer computational controls wherever a rule can be checked mechanically, and keep inferential ones for what needs judgment.

Sensors work best when their output is written for the agent to read. A failure message that says what is wrong and how to fix it lands in the agent's context at exactly the right moment; Böckeler calls this a positive kind of prompt injection, and OpenAI's team wrote its custom lint messages the same way:

| Weak sensor message | Message written for the agent |
|---|---|
| `E1203 forbidden import` | `ui/cart.tsx imports from db/. UI code may only use the service layer; call CartService.load() instead. See docs/architecture.md#layers.` |
| `1 test failed` | `test_refund_rounding failed: expected 10.05, got 10.04. Rounding happens in money.round_half_even(); do not change the expected value.` |

## The steering loop: every mistake becomes a harness change

Hashimoto's rule is the core of harness engineering: when an agent makes a mistake, take the time to change its environment so that it does not make that mistake again. He names two forms: improving the implicit prompting, typically a line in `AGENTS.md` written after a bad behaviour, and writing actual tools, such as a script that takes a screenshot or runs a filtered set of tests, together with a note that tells the agent the tool exists.

```diagram
Agent run
    ↓
Something goes wrong (review comment, red CI, odd trace, escaped bug)
    ↓
Ask: what would have prevented it?
    ├─ the agent did not know           → add or sharpen a guide (instruction line, skill, example)
    ├─ nothing noticed the mistake       → add a sensor (test, lint rule, structural check, review prompt)
    └─ the action should be impossible   → change permissions, a hook or the sandbox
    ↓
Keep the failure as a regression case for the harness itself
    ↓
The next run starts from a stronger harness                          (repeat)
```

Controls also differ in how firmly they hold. Climb only as high as the problem requires:

| Level | Example | How firmly it holds | Cost |
|---|---|---|---|
| Instruction | "Run `npm run verify` before you finish" in `AGENTS.md` | The agent is asked and may forget in a long session | Lowest |
| Tool or skill | A `run-focused-tests` script with a short skill describing when to use it | The right thing becomes the easy thing | Low |
| Hook | A hook that runs the linter after every edit, or refuses to let the agent finish while tests fail | Runs every time, regardless of what the model decides | Medium: slows every step |
| Gate | Required CI checks, branch protection, permission deny rules, a sandbox without production network access | Cannot be bypassed from inside the agent | Highest: feedback arrives late |

Instructions files are context, not enforcement. When a rule matters, back it with a hook or a gate. In Claude Code, for example, hooks are commands that run at fixed points in a session: before or after a tool call, when a session starts, or when the agent tries to stop. A project might lint every edited file and check tests before the agent may finish:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": ".claude/hooks/lint-edited-file.sh" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": ".claude/hooks/require-green-tests.sh" }]
      }
    ]
  }
}
```

A hook script that exits with code 2 sends its error output back to the agent: after an edit it arrives as feedback, and on `Stop` it keeps the agent working. A stop check must itself be guarded against loops: the hook input says whether the agent is already continuing because of a stop hook, and a script that blocks forever turns a safety net into a trap.

## A minimal harness in code

The example below is a small harness around a scripted stand-in for an agent. The agent claims "done" after each attempt; the harness decides. Three computational sensors check each change, their messages tell the agent how to fix the problem, a loop detector nudges the agent to step back when it keeps editing the same file, and a turn budget stops the run if nothing converges. LangChain's verification step before finishing and loop-detection middleware follow the same idea.

```python
import re

# Sensors run after the agent acts. Each one returns None when the change is
# fine, or a message written for the agent: what is wrong and what to do.
def no_disabled_tests(change):
    if re.search(r"@mark\.skip|xfail|\.only\(", change["diff"]):
        return "A test was disabled. Remove the skip and fix the cause; if the test is wrong, say why."
    return None

def assertions_kept(change):
    before, after = change["asserts_before"], change["asserts_after"]
    if after < before:
        return f"Assertions dropped from {before} to {after}. Restore them or justify each removal."
    return None

def focused_tests_pass(change):
    failed = [name for name, passed in change["tests"].items() if not passed]
    if failed:
        return "Failing: " + ", ".join(failed) + ". Read the first failure before editing again."
    return None

SENSORS = [no_disabled_tests, assertions_kept, focused_tests_pass]

# A scripted stand-in for the agent: each attempt ends with the agent saying "done".
ATTEMPTS = [
    {"file": "test_checkout.py", "diff": "+    @mark.skip(reason='flaky')",
     "asserts_before": 4, "asserts_after": 4, "tests": {"test_total": True}},
    {"file": "test_checkout.py", "diff": "+    assert order",
     "asserts_before": 4, "asserts_after": 2, "tests": {"test_total": True}},
    {"file": "checkout.py", "diff": "+    total = round(subtotal - discount, 2)",
     "asserts_before": 4, "asserts_after": 4, "tests": {"test_total": True, "test_refund": True}},
]

def run_with_harness(attempts, sensors, max_turns=5, edits_before_nudge=2):
    edits = {}
    for turn, change in enumerate(attempts[:max_turns], start=1):
        name = change["file"]
        edits[name] = edits.get(name, 0) + 1
        feedback = []
        for sensor in sensors:
            message = sensor(change)
            if message:
                feedback.append(message)
        if feedback and edits[name] >= edits_before_nudge:
            feedback.append(f"{name} edited {edits[name]} times. Step back and re-check where the bug is.")
        if not feedback:
            print(f"turn {turn}: agent says done -> accepted, all sensors pass")
            return "done"
        print(f"turn {turn}: agent says done -> blocked")
        for message in feedback:
            print("   ", message)
    print("budget exhausted -> stop and hand over to a person")
    return "budget_exhausted"

result = run_with_harness(ATTEMPTS, SENSORS)
print("result:", result)
```

The first attempt silences the flaky test and the second weakens it; both are blocked with a reason. Only the third, which fixes the rounding in the code under test, is accepted. The point is the division of labour: the model proposes, and deterministic code decides whether the work counts as finished. A real harness would read the diff from version control and run the test command instead of using scripted values, and would record every blocked attempt in the trace, as described in [Evaluating and observing agents](/learn/agentic?topic=agent-observability).

## Harnesses for long-running work

Tasks that take hours span several context windows, and each new session starts with no memory of the last one. Anthropic's engineering team described three recurring failures when an agent builds a whole application this way: trying to do everything at once and running out of context half-way, a later session seeing progress and declaring the project finished, and marking features complete after unit tests or a `curl` call without checking them end to end.

Their fix is a harness with two roles that share the same tools and differ only in their first prompt. An **initializer** session turns the specification into a structured feature list, a progress log, a script that starts the application and a first commit. Every later **coding** session follows a fixed routine: read the progress log, the git history and the feature list, pick the highest-priority unfinished feature, start the application and run a quick end-to-end check of what already exists, then implement the feature, test it as a user would, commit, and update the log. The feature list is kept in JSON rather than Markdown because the model was less likely to rewrite it, and the coding agent may change only the `passes` field:

```json
[
  {
    "category": "checkout",
    "description": "A signed-in user applies a discount code and sees the new total",
    "steps": [
      "Sign in as the seeded test user",
      "Add two items to the cart",
      "Apply the code SAVE10",
      "Check that the total drops by 10% and the code is shown"
    ],
    "passes": false
  }
]
```

| Failure | What the harness adds |
|---|---|
| Declares the project done too early | A feature list with a pass flag per feature; one feature per session |
| Leaves broken or undocumented state | Git commits and a progress log; a smoke check at the start of every session |
| Marks features done without real testing | End-to-end checks through browser automation before a feature may pass |
| Wastes time working out how to run the app | A start script written once by the initializer |

A later Anthropic experiment added a separate **evaluator** agent that clicked through the running application with Playwright and graded it against agreed criteria. The finding is familiar to every tester: agents reliably grade their own work too generously, and tuning a separate, sceptical evaluator was far more tractable than making the builder critical of itself. This is the independence of testing from development, rebuilt inside a harness, and the evaluator needs what any tester needs: explicit acceptance criteria, access to the running system and the authority to say no.

## Make the codebase legible to the agent

An agent can use only what it can reach from its context. OpenAI's team, which built a product of about a million lines with no hand-written code, treated the repository as the system of record and made the running application observable to the agent:

- **A short map, not a manual.** Their `AGENTS.md` stayed at about a hundred lines and pointed to a structured `docs/` folder with architecture notes, plans and specifications, because one huge instructions file crowded out the task, made every rule look equally important and went stale.
- **Knowledge in the repository.** Decisions that live in chat threads or people's heads are invisible to agents, so they were written into versioned files.
- **A running system per change.** The application could start once per git worktree, the agent could drive it through the Chrome DevTools Protocol, and each worktree had temporary logs, metrics and traces the agent could query, which made requirements such as startup time checkable by the agent itself.
- **Invariants enforced mechanically.** Dependency direction between layers, structured logging, naming rules and file-size limits were checked by custom linters and structural tests, most of them written by the agents. The rules fixed invariants, not implementations.
- **Continuous clean-up.** Agents copy the patterns they find, including the bad ones, so background agent tasks scanned for drift, updated quality grades and opened small refactoring pull requests, and a recurring task compared documentation with the code.

Böckeler calls the underlying property **harnessability**: some codebases are easier to harness than others. Strong typing enables type-checking sensors, clear module boundaries enable architecture rules, and a well-known framework removes decisions the agent would otherwise make. For test projects the same idea becomes a checklist:

| Property | Why it matters to an agent |
|---|---|
| One documented command for "done" | The agent and CI agree on what finished means |
| Fast, focused test commands | The agent can check each step without running everything |
| Seeded, resettable test data | Reruns give the same result, so failures mean something |
| Stable selectors and test IDs | UI tests break for real changes, not for markup churn |
| Readable logs and error messages | The agent can diagnose failures without guessing |
| An isolated environment per change | Parallel agents do not trample each other's data |

Legacy systems are the hard case: they need the harness most and offer the fewest footholds for one, so start there with characterisation tests and the cheapest sensors before giving an agent wider tasks.

## Keep quality left

Run each check as early as its cost allows, so the agent hears about a problem while it still has the context to fix it:

| When | Typical controls | Notes |
|---|---|---|
| Inside the agent loop | Formatter and linter on each edit, type check, focused tests, the check before finishing | Must be fast, or the agent waits on every step |
| Before integration | The full fast suite, structural checks, an AI review against a checklist | The pull request is the natural boundary |
| After integration | End-to-end and contract suites, mutation testing, broader architecture review | Expensive checks that catch what fast ones miss |
| Continuously | Drift and dead-code detection, dependency scanning, documentation-versus-code checks | Runs outside any single change and opens its own small fixes |
| In production | SLOs, sampled LLM judges on real traffic, error budgets | Feeds new regression cases back into the harness |

## Testing the harness

A harness is software, and it fails like software: a sensor can be blind, two guides can contradict each other, and a change that fixes one task can break five others. Treat it accordingly:

- **Keep the motivating failure.** Every guide or sensor exists because of a failure; keep that failure as a regression case and rerun the set whenever the harness changes.
- **Prove that sensors fire.** A sensor that never fires means either good code or a blind sensor. Seed a known violation now and then, the way mutation testing seeds bugs into code, and check that the sensor catches it.
- **Measure on a fixed task set.** Run the same tasks before and after a harness change, with the model fixed, several times each because agents are not deterministic, and compare success rate, cost per successful task and steps, as in [Evaluating agents and tool use](/learn/llm?topic=agent-testing).
- **Watch for contradictions.** As instructions grow, rules start to conflict with each other or with sensor messages. Review the instructions file like code, and delete rules that no longer earn their place.

## Strip the harness down when models improve

Every part of a harness encodes an assumption about what the model cannot do on its own, and those assumptions age. Anthropic's guidance is to test them on each new model: a context-reset mechanism became unnecessary with Opus 4.5, and in the application-builder experiment the sprint structure could be dropped with Opus 4.6 while the planner stayed, the evaluator becoming worth its cost only for tasks beyond what the model handled reliably alone. The guiding rule is the one from [How an AI agent works](/learn/agentic?topic=how-agents-work): start with the simplest design that works and add complexity only when measurements show it helps.

The reverse also happens. Coding products are post-trained with their own harness in the loop, so a model can perform worse when tools it was trained with are swapped for different ones, and LangChain reports that the best harness for a task is not necessarily the one the model was trained with. When you change model or harness, run an ablation on your task set: remove one component at a time and keep only what still pays for itself.

## Case study: the harness of this site

GimmeJob is built mostly with coding agents, and its user harness maps onto the model above:

| Control | Kind | What it does |
|---|---|---|
| `AGENTS.md`, with `CLAUDE.md` pointing to it | Guide, inferential | Scope rules, product invariants, test design rules and the release process in one file |
| `npm run verify` | Sensor, computational | Linting, type checks, content validators, the D1 migration contract, the build, tests with coverage and the Cloudflare artifact check |
| Content tests for this course | Sensor, computational | Every chapter must be bilingual with the same code in both languages, list prerequisites, cite registered sources and contain a Python example that runs in the page |
| A balance test for mock exams | Sensor, computational | Answer letters must be balanced, and the correct option may be the longest in fewer than half the questions |
| Draft pull request, CI and SonarQube | Gate | A change merges only after the required checks pass |
| Check of the live site after deployment | Sensor | The deployed page is opened and checked, because a green pipeline is not the same as a working page |

The mock-exam test is the steering loop in miniature. A correct option that is usually the longest is a known item-writing flaw that gives answers away; instead of relying on an instruction to avoid it, a test makes it impossible to merge. More examples of agents being caught by the project's own checks are in [the coding agents chapter](/learn/agentic?topic=coding-agents-for-qa).

## Common mistakes

- **Blaming the model for a harness problem.** When an agent runs the wrong command or misses a convention, ask what was missing from its environment before waiting for a better model.
- **One giant instructions file.** A thousand-line `AGENTS.md` crowds out the task and goes stale; keep a short map that points to deeper documents.
- **Rules without enforcement.** Anything that must always hold belongs in a hook, a test or a gate, not only in prose.
- **Sensor messages written for humans only.** `Error 17` gives the agent nothing to act on; say what is wrong and how to fix it.
- **Letting the agent grade itself.** Self-evaluation is lenient; use deterministic checks or a separate evaluator with explicit criteria.
- **Untested harness changes.** A new instruction or hook needs a before-and-after run on a fixed task set, like any change.
- **Never removing scaffolding.** Workarounds for old model limits cost tokens and time; re-test them when the model changes.

## Summary

An agent is a model plus a harness, and the harness can move results as much as the model: benchmark scores belong to the combination. If you use a coding agent, your leverage is the user harness: guides that steer the agent before it acts and sensors that check its work afterwards, computational wherever possible and inferential where judgment is needed. Turn every recurring mistake into a harness change, choosing the lightest control that reliably holds, and write sensor messages the agent can act on. For long tasks, give the agent structured progress files, one feature at a time, end-to-end checks and an independent evaluator. Make the codebase legible, run checks as early as their cost allows, test the harness like software, and remove parts of it when a better model no longer needs them.
