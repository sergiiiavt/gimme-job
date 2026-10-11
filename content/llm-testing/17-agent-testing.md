An agent runs a loop of model decisions and tool calls until it decides the task is done. It can take many steps, recover from errors, and change things in the real world. Testing an agent means checking **where it ended up**, **how it got there**, and **how reliably** it does so.

For agent design concepts (tools, state, approvals and MCP), see [AI agents & MCP](/learn/agentic).

## 1. What makes agents harder to test

- **Long trajectories.** A small mistake in step 2 compounds through steps 3–15.
- **Many valid paths.** Two different tool sequences can both be correct.
- **Side effects.** Tools send emails, write files, move money and change records.
- **Environment state.** The result depends on the state of databases, files and external APIs.
- **Cost and latency.** Each run can take dozens of model calls.
- **Low reliability compounds.** An agent that succeeds 80% of the time per task can fail most users who use it daily.

## 2. Outcome vs trajectory evaluation

| Approach | What you check | Strength | Weakness |
|---|---|---|---|
| Outcome (final state) | The environment after the run: database rows, files, sent messages, final answer | Robust to many valid paths | Misses dangerous or wasteful paths that happen to end well |
| Trajectory | The sequence of tool calls and arguments | Catches unsafe actions, loops and waste | Brittle if you demand one exact path |

Use both. Check the **outcome** for correctness, and check the **trajectory** for constraints:

- forbidden tools were never called;
- required checks happened before an action (for example, the identity check before a refund);
- no step was repeated more than N times;
- total steps, tokens and cost are within budget.

## 3. Tool-call correctness

For each tool call, evaluate:

- **selection:** the right tool, or correctly no tool;
- **argument validity:** arguments match the schema;
- **argument correctness:** the values are right (correct order ID, correct date and timezone);
- **necessity:** no redundant calls;
- **error handling:** after a tool error, the agent retries sensibly, tries an alternative, or reports the failure honestly;
- **faithful use of results:** the agent does not invent tool results or ignore inconvenient ones.

Single-step tool-selection tests are cheap and deterministic to score. Build many of them before running expensive end-to-end scenarios.

## 4. Sandboxed, deterministic environments

Agent evals need an environment you control:

- **fake tools** backed by seeded in-memory data;
- **reset** of all state between runs;
- **recorded responses** for external APIs;
- **a clock you control** for date-sensitive tasks;
- **no real side effects:** a fake email outbox, a test database, no production credentials.

```python
def test_refund_requires_identity_check(agent, env):
    env.seed(orders=[{"id": "A-1042", "owner": "u1", "total": 49.0}])
    result = agent.run("Refund my order A-1042", user_id="u1")

    calls = [step.tool for step in result.trajectory]
    assert "verify_identity" in calls
    assert calls.index("verify_identity") < calls.index("issue_refund")
    assert env.refunds == [{"order_id": "A-1042", "amount": 49.0}]
    assert len(result.trajectory) <= 8
```

## 5. Multi-turn and simulated users

Real conversations have many turns. To test them at scale, use a **user simulator**: a second model that plays a user with a persona and a goal.

```text
Persona: impatient customer, writes short messages, sometimes gives the wrong order ID first.
Goal: get a refund for order A-1042.
Stop when: the refund is confirmed, or after 10 turns.
```

Then grade the whole conversation: was the goal reached, were policies followed, was the tone appropriate? Validate the simulator itself: it must stay in character and must not solve the task for the agent.

## 6. Reliability: pass^k

Agent quality is about reliability, not best-case success. Run each scenario k times:

- **pass@k:** at least one success. Good for exploration, misleading for users.
- **pass^k:** all k runs succeed. This shows how consistently the agent behaves.

The τ-bench paper showed that strong agents with good single-run success rates still had much lower pass^k on customer-service tasks. Report both, and set release thresholds on pass^k for critical tasks.

## 7. Agent failure modes

| Failure | Detection |
|---|---|
| Infinite loop or repeated tool calls | Step limit, repeated-call detector in trajectory checks |
| Gives up early or claims success falsely | Compare the claimed outcome with the actual environment state |
| Hallucinated tool results | Compare the agent's statements with the logged tool outputs |
| Wrong argument values | Argument-level assertions on recorded calls |
| Ignores tool errors | Inject tool failures and check the response |
| Cost blowup | Token and step budgets per scenario |
| Unsafe or unapproved action | Forbidden-tool assertions; approval gate tests |
| Over-asking | Counts of clarifying questions when information was already given |

## 8. Fault injection

Make tools fail on purpose:

- timeouts and 500 errors;
- empty results;
- malformed responses;
- partial success (2 of 3 items updated);
- slow responses that hit time limits;
- **tool output containing instructions** (indirect prompt injection, see [Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming)).

The agent should retry with limits, report the failure honestly, and never claim success.

## 9. Testing MCP servers

When an agent uses MCP servers, test each server as an API contract:

- tool names, descriptions and input schemas are accurate and stable;
- invalid inputs return clear errors, not crashes;
- authorization is enforced by the server, not by trusting the model;
- destructive tools are clearly marked and require confirmation in the client;
- tool descriptions do not contain instructions that could hijack the model.

## 10. Benchmarks worth studying

- **τ-bench:** tool-agent-user interaction in customer-service domains, with pass^k reliability.
- **SWE-bench:** resolving real GitHub issues in Python repositories, verified by tests.
- **GAIA:** general assistant tasks that need tools and multi-step reasoning.

You will rarely run them yourself. Study their design: how they build environments, define success and score reliability.

## 11. QA quick reference

- Check the final state for correctness and the trajectory for constraints.
- Build many cheap single-step tool-selection tests before end-to-end scenarios.
- Seed and reset a sandboxed environment; never touch production side effects.
- Use simulated users for multi-turn coverage; validate the simulator.
- Report pass^k, steps, tokens and cost per scenario.
- Inject tool failures and check for honest reporting.

## Sources

- [Yao et al. — τ-bench: A Benchmark for Tool-Agent-User Interaction](https://arxiv.org/abs/2406.12045)
- [τ-bench on GitHub](https://github.com/sierra-research/tau-bench)
- [SWE-bench](https://www.swebench.com/)
- [Mialon et al. — GAIA: a benchmark for General AI Assistants](https://arxiv.org/abs/2311.12983)
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Model Context Protocol](https://modelcontextprotocol.io/)
