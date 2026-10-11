# Evaluating agents and tool use

An **agent** is a model in a loop: it reads the task and what has happened so far, chooses an action such as a tool call, observes the result, and repeats until it decides that the task is done. Tools let a model look up an order, issue a refund or send an e-mail; the loop lets it combine them into multi-step work.

Agents are harder to test than single answers. Many different action sequences can complete a task, actions change the state of real systems, one early mistake compounds over later steps, and the same task can succeed on one run and fail on the next. This chapter covers how tool calling works, what goes wrong, and how to test tool definitions, individual calls, outcomes, trajectories, failure handling, reliability, safety and MCP servers.

**Prerequisites:** [LLM application anatomy and APIs](/learn/llm?topic=llm-application-anatomy), [Testing LLM code without the model](/learn/llm?topic=testing-without-the-model), [Statistics for evaluation](/learn/llm?topic=eval-statistics).

## How tool calling and agents work

```diagram
Application sends: task + conversation + tool definitions (name, description, JSON Schema of arguments)
        ↓
Model replies with a tool call: {"name": "lookup_order", "arguments": {"order_id": "A-1042"}}
        ↓
Application validates the call, checks permissions, executes the tool
        ↓
Application sends the tool result back to the model
        ↓
Model calls another tool, or writes the final answer          (repeat until done or out of budget)
```

The model never executes anything itself. It proposes calls; the application decides whether to run them. This boundary is where most tests live: the application validates every call against the tool's schema, enforces permissions and budgets, executes the tool, and returns the result, including errors, in a form the model can act on.

The **Model Context Protocol** (MCP) standardizes the tool side of this loop: a server lists its tools (`tools/list`, with a JSON Schema per tool) and executes them (`tools/call`), so the same tools can be used by different clients and models.

## What goes wrong

| Failure | Example | How to detect it |
|---|---|---|
| Wrong tool | Searches the FAQ instead of looking up the order | Expected tool per scenario; trajectory checks |
| Wrong or invented arguments | `order_id: "1042"`, or an order number the user never gave | Schema validation; argument checks against the task |
| Ignored tool error | Claims success after the refund call failed | Fault injection; compare the claim with the final state |
| Invented tool result | States a delivery date the tool never returned | Compare statements with logged tool outputs |
| Loops and waste | Calls the same lookup again and again | Repeated-call detection; step and cost budgets |
| Unsafe action | Refunds without checking the order status, or deletes data | Forbidden tools; required preconditions; approval gates |
| Gives up or over-asks | Asks for the order number the customer already gave | Counts of clarifying questions; simulated users |
| Prompt injection through tools | A tool result contains instructions that the agent follows | Adversarial tool results ([Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming)) |

## Testing tool definitions and calls

A tool definition is an interface contract for a model. Its name and description decide when the model uses it, and its schema decides which calls are valid. Validate every call before executing it, and phrase validation errors so that the model can correct the call:

```python
import re

# Tool definitions as the model sees them: a name, a description and a JSON Schema for the arguments
TOOLS = {
    "lookup_order": {
        "description": "Look up an order by its number, for example A-1042.",
        "input_schema": {"type": "object", "required": ["order_id"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"}}},
    },
    "issue_refund": {
        "description": "Refund a delivered order to the original payment method.",
        "input_schema": {"type": "object", "required": ["order_id", "amount_eur", "reason"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"},
                                        "amount_eur": {"type": "number", "minimum": 0.01},
                                        "reason": {"type": "string", "enum": ["return", "damaged", "late"]}}},
    },
}
TYPES = {"string": str, "number": (int, float), "object": dict}


def validate_call(name: str, arguments: dict) -> list[str]:
    """Problems with a tool call, phrased so that the model can correct the call."""
    if name not in TOOLS:
        return [f"unknown tool {name!r}; available: {sorted(TOOLS)}"]
    schema = TOOLS[name]["input_schema"]
    problems = [f"missing argument {field!r}" for field in schema["required"] if field not in arguments]
    for field, value in arguments.items():
        spec = schema["properties"].get(field)
        if spec is None:
            problems.append(f"unexpected argument {field!r}")
        elif not isinstance(value, TYPES[spec["type"]]) or isinstance(value, bool):
            problems.append(f"{field} must be a {spec['type']}, got {type(value).__name__}")
        elif "enum" in spec and value not in spec["enum"]:
            problems.append(f"{field} must be one of {spec['enum']}, got {value!r}")
        elif "pattern" in spec and not re.fullmatch(spec["pattern"], value):
            problems.append(f"{field} {value!r} does not match the format {spec['pattern']}")
        elif "minimum" in spec and value < spec["minimum"]:
            problems.append(f"{field} must be at least {spec['minimum']}")
    return problems


calls = [
    ("lookup_order", {"order_id": "A-1042"}),
    ("lookup_order", {"order_id": "1042"}),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": "89.90", "reason": "return"}),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9, "reason": "changed my mind"}),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}),
    ("cancel_order", {"order_id": "A-1042"}),
]
for name, arguments in calls:
    problems = validate_call(name, arguments)
    print(f"{name}({arguments}) -> {'ok' if not problems else '; '.join(problems)}")
```

Output:

```text
lookup_order({'order_id': 'A-1042'}) -> ok
lookup_order({'order_id': '1042'}) -> order_id '1042' does not match the format ^A-\d{4}$
issue_refund({'order_id': 'A-1042', 'amount_eur': '89.90', 'reason': 'return'}) -> amount_eur must be a number, got str
issue_refund({'order_id': 'A-1042', 'amount_eur': 89.9, 'reason': 'changed my mind'}) -> reason must be one of ['return', 'damaged', 'late'], got 'changed my mind'
issue_refund({'order_id': 'A-1042', 'amount_eur': 89.9}) -> missing argument 'reason'
cancel_order({'order_id': 'A-1042'}) -> unknown tool 'cancel_order'; available: ['issue_refund', 'lookup_order']
```

What to test around tools:

- **Every tool executor rejects invalid arguments,** even when the provider promises schema-conformant calls: the executor is also called by code, by other clients and by tests.
- **Error messages are actionable.** "order_id '1042' does not match ^A-\d{4}$" lets the model retry correctly; "invalid input" does not. MCP makes the same distinction: an unknown tool is a protocol error, while invalid input and business errors are returned as tool results marked `isError`, so that the model can recover.
- **Tool selection** is tested with scenarios: for each kind of request, which tool should be called first, and which must not be called at all.
- **Descriptions are part of the prompt.** Changing a tool's description changes behaviour, so tool definitions are versioned and evaluated like prompts ([Prompts as testable artifacts](/learn/llm?topic=prompts-as-artifacts)).

## Outcome and trajectory evaluation

An agent run can be evaluated by where it ended and by how it got there:

| Approach | What is checked | Strength | Weakness |
|---|---|---|---|
| Outcome | The state of the environment after the run: records, refunds, sent messages, the final answer | Accepts every valid path | Misses risky or wasteful paths that happened to end well |
| Trajectory | The sequence of tool calls and their arguments | Catches unsafe order, loops and waste | Brittle if it demands one exact path |

Use both, and keep trajectory checks to **rules** (preconditions, forbidden tools, budgets, no repeats) instead of one golden path:

```python
import copy

# Task: "My boots from order A-1042 do not fit, I sent them back. Please refund me."
START = {
    "orders": {"A-1042": {"customer": "olena", "total": 89.9, "status": "returned"},
               "A-2210": {"customer": "taras", "total": 45.5, "status": "delivered"}},
    "refunds": [],
    "emails": [],
}
EXPECTED_REFUND = {"order_id": "A-1042", "amount_eur": 89.9}
FORBIDDEN_TOOLS = {"delete_order", "change_address"}
MAX_STEPS = 6


def run(trajectory):
    """Replay recorded tool calls against a copy of the environment and return the final state."""
    state = copy.deepcopy(START)
    for name, args in trajectory:
        if name == "issue_refund":
            state["refunds"].append({"order_id": args["order_id"], "amount_eur": args["amount_eur"]})
            state["orders"][args["order_id"]]["status"] = "refunded"
        elif name == "send_email":
            state["emails"].append(args["to"])
    return state


def outcome_problems(state):
    problems = []
    if state["refunds"] != [EXPECTED_REFUND]:
        problems.append(f"refunds should be exactly {[EXPECTED_REFUND]}, got {state['refunds']}")
    if state["emails"] != ["olena"]:
        problems.append(f"one confirmation to olena expected, got {state['emails']}")
    if state["orders"]["A-2210"] != START["orders"]["A-2210"]:
        problems.append("an unrelated order was changed")
    return problems


def trajectory_problems(trajectory):
    names = [name for name, _ in trajectory]
    problems = [f"forbidden tool {name}" for name in names if name in FORBIDDEN_TOOLS]
    if "issue_refund" in names and "lookup_order" not in names[:names.index("issue_refund")]:
        problems.append("refund issued before the order status was checked")
    repeated = {(name, str(args)) for i, (name, args) in enumerate(trajectory) if (name, args) in trajectory[:i]}
    problems += [f"repeated call {name}" for name, _ in sorted(repeated)]
    if len(trajectory) > MAX_STEPS:
        problems.append(f"{len(trajectory)} steps, budget {MAX_STEPS}")
    return problems


good = [("lookup_order", {"order_id": "A-1042"}),
        ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}),
        ("send_email", {"to": "olena"})]
lucky = [("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}),
         ("lookup_order", {"order_id": "A-1042"}),
         ("lookup_order", {"order_id": "A-1042"}),
         ("send_email", {"to": "olena"})]
wrong = [("lookup_order", {"order_id": "A-1042"}),
         ("lookup_order", {"order_id": "A-2210"}),
         ("issue_refund", {"order_id": "A-2210", "amount_eur": 45.5}),
         ("send_email", {"to": "olena"})]

for label, trajectory in [("good", good), ("lucky", lucky), ("wrong", wrong)]:
    state = run(trajectory)
    print(f"{label}: outcome {outcome_problems(state) or 'ok'}")
    print(f"{' ' * len(label)}  trajectory {trajectory_problems(trajectory) or 'ok'}")
```

Output:

```text
good: outcome ok
      trajectory ok
lucky: outcome ok
       trajectory ['refund issued before the order status was checked', 'repeated call lookup_order']
wrong: outcome ["refunds should be exactly [{'order_id': 'A-1042', 'amount_eur': 89.9}], got [{'order_id': 'A-2210', 'amount_eur': 45.5}]", 'an unrelated order was changed']
       trajectory ok
```

The lucky run ends in the right state but refunded before checking that the boots had come back; the same habit refunds unreturned orders tomorrow. The wrong run follows every rule and refunds the wrong customer. Outcome checks catch the second, trajectory rules catch the first, and neither alone is enough.

## Fault injection and honest failure

Real tools time out, return errors and return surprising data. An agent must recover where it can and admit failure where it cannot. A tool that always works in tests never exercises that behaviour, so inject faults deliberately:

```python
def refund_tool(failures: int):
    """A refund tool that fails with a timeout the first `failures` times it is called."""
    calls = {"count": 0, "refunds": []}

    def call(order_id: str, amount_eur: float) -> dict:
        calls["count"] += 1
        if calls["count"] <= failures:
            return {"isError": True, "text": "payment service timeout"}
        calls["refunds"].append((order_id, amount_eur))
        return {"isError": False, "text": f"refund {order_id} {amount_eur} EUR created"}

    return call, calls


def careful_agent(tool) -> str:
    """Retries a failed call twice, then hands over instead of claiming success."""
    for _ in range(3):
        if not tool("A-1042", 89.9)["isError"]:
            return "Your refund of 89.90 EUR is on its way."
    return "I could not issue the refund right now; a colleague will contact you today."


def careless_agent(tool) -> str:
    tool("A-1042", 89.9)  # the result is ignored
    return "Your refund of 89.90 EUR is on its way."


def claims_refund(message: str) -> bool:
    return "refund of" in message and "could not" not in message


for agent in [careful_agent, careless_agent]:
    for failures in [0, 1, 3]:
        tool, record = refund_tool(failures)
        message = agent(tool)
        refunded = len(record["refunds"]) == 1
        verdict = "consistent" if claims_refund(message) == refunded else "FALSE CLAIM"
        print(f"{agent.__name__:<15} failures={failures}  calls={record['count']}  refunded={refunded!s:<5}  {verdict}")
```

Output:

```text
careful_agent   failures=0  calls=1  refunded=True   consistent
careful_agent   failures=1  calls=2  refunded=True   consistent
careful_agent   failures=3  calls=3  refunded=False  consistent
careless_agent  failures=0  calls=1  refunded=True   consistent
careless_agent  failures=1  calls=1  refunded=False  FALSE CLAIM
careless_agent  failures=3  calls=1  refunded=False  FALSE CLAIM
```

Without fault injection both agents pass every test. With it, the careless agent tells a customer that money is on its way when nothing happened. Faults worth injecting: timeouts and rate limits, error results, empty and partial results, malformed results, slow responses that hit the step budget, and results that contradict the user's claim (the order was never delivered).

## A deterministic test environment

Agents act on state, so tests need an environment that is cheap to reset and safe to change:

- **Fake tools with real state:** an in-memory orders table, a refunds ledger and an outbox instead of production systems. Every test starts from a known snapshot.
- **Recorded or scripted model decisions** for tests of the loop itself ([Testing LLM code without the model](/learn/llm?topic=testing-without-the-model)), and a real model only in evaluation runs.
- **Budgets enforced by the loop:** maximum steps, tokens and cost per task; exceeding them ends the run with a clear status.
- **A full trace of every run:** model inputs and outputs, tool calls, arguments, results and timing, so that every failure can be replayed.
- **Sandboxes for agents that run code or browse:** containers without network access or with an allow-list, and resource limits ([Code-based scorers and metrics](/learn/llm?topic=code-based-scorers) discusses executing generated code).

## Simulated users and multi-turn tasks

Many agent tasks are conversations: the customer gives information in pieces, changes their mind, or asks something the agent cannot do. τ-bench made this measurable: a language model plays the user from a written persona and goal, the agent works with tools against a database, and success is judged by comparing the final database state with the expected one. The same design works for your product: write user scenarios with goals and the information each user knows, let a simulated user hold the conversation, and check the final state and the conversation rules (no repeated questions, confirmation before irreversible actions).

Simulated users are themselves models, so validate a sample of simulated conversations by reading them, and keep a set of scripted conversations for regression tests that must not vary.

## Reliability across repeated runs

The same task can succeed on one run and fail on the next. For agents the relevant number is usually **pass^k**, the chance that all k attempts at a task succeed, because a customer who uses the agent every day experiences every run ([Statistics for evaluation](/learn/llm?topic=eval-statistics)). Run every scenario several times, report pass^k next to the average success rate, and treat scenarios that sometimes fail as defects to investigate, not as flaky tests to retry.

## Safety: permissions and approvals

- **Least privilege:** give the agent only the tools a task needs, and scope each tool to the current user (the refund tool can refund only orders of the authenticated customer).
- **Approval gates for irreversible or expensive actions:** a refund above a limit, a deletion, an external message. Test that the gate cannot be bypassed by arguments, retries or other tools.
- **Treat tool results as untrusted input.** A product review, an e-mail or a web page returned by a tool can contain instructions; the agent must not follow them ([Security, red teaming and guardrails](/learn/llm?topic=security-red-teaming)).
- **Log every action** with the user, the arguments and the reason, so that an incident can be reconstructed.

## Testing MCP servers

An MCP server is an API whose client is a model, and it is tested like an API plus like a tool:

- **Protocol contract:** `initialize`, `tools/list` and `tools/call` behave as the specification says; an unknown tool returns a JSON-RPC error; invalid input returns a result with `isError: true` and a message that explains the problem.
- **Schemas:** every tool has a precise input schema, and an output schema where results are structured; results conform to them.
- **Behaviour:** each tool does what its description says, including edge cases, and fails safely.
- **Security:** inputs are validated, access is checked per user, calls are rate-limited, and outputs that will reach a model are sanitized. The specification also asks clients to confirm sensitive operations with the user.
- **Interactive checks** with the MCP Inspector, and automated contract tests that call the server in memory or over its transport.

## Benchmarks

Public agent benchmarks show how agent evaluation is designed in practice, and where models still fail:

| Benchmark | Tasks | Success measured by |
|---|---|---|
| τ-bench | Customer-service conversations with tools and a simulated user | Final database state, pass^k over repeated trials |
| SWE-bench | Resolving real GitHub issues in Python repositories | The repository's tests pass after the change |
| WebArena | Tasks on realistic self-hosted websites | Functional checks of the final state |
| GAIA | Questions that need browsing, tools and reasoning | Exact answers |
| AgentBench | Eight environments from operating systems to games | Environment-specific success |
| Berkeley Function Calling Leaderboard | Single and multiple function calls | Correct function and arguments |

Benchmarks rank models; they do not test your agent. Use them to learn evaluation designs and to choose candidate models, then evaluate on scenarios from your own product.

## Example project

The methods of this chapter are implemented and tested in [examples/llm-testing/13-agent-testing](https://github.com/sergiiiavt/gimme-job/tree/main/examples/llm-testing/13-agent-testing): a support-agent environment with orders, refunds and an outbox, tool definitions with argument validation, an agent loop with step budgets and an approval gate, scripted policies with injectable mistakes, outcome and trajectory checks, fault injection with false-claim detection, pass^k over seeded runs, and an in-memory MCP-style server with protocol contract tests. All tests run offline, without a model or API keys:

```bash
uv sync --project examples/llm-testing
uv run --project examples/llm-testing pytest examples/llm-testing/13-agent-testing
```

## Common mistakes

- **Executing tool calls without validating them** because the provider enforces schemas.
- **Error messages the model cannot act on,** or errors raised in a way that ends the run instead of informing the model.
- **Only outcome checks,** which accept risky paths that happened to end well, or only one golden trajectory, which rejects valid alternatives.
- **Tests with tools that never fail.**
- **Trusting the agent's final message** instead of the state of the environment.
- **One run per scenario** for a system that users run every day.
- **Approval gates that other tools or retries can bypass,** and tool results treated as trusted instructions.
- **MCP servers tested only by hand in an inspector.**

## Summary

- An agent is a model in a loop that proposes tool calls; the application validates, authorizes and executes them, and that boundary is where most tests live.
- Validate every call against its schema and return actionable errors; test tool selection with scenarios and version tool descriptions like prompts.
- Evaluate both the outcome (final state) and the trajectory (rules about order, forbidden tools, repeats and budgets).
- Inject faults and check that the agent recovers or admits failure, comparing its claims with the real state.
- Test in a deterministic environment with fake tools, budgets and full traces; use simulated users for multi-turn tasks.
- Report pass^k across repeated runs, enforce least privilege and approval gates, and treat tool results as untrusted.
- Test MCP servers for protocol behaviour, schemas, tool behaviour and security.
