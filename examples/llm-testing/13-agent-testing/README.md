# Evaluating agents and tool use

Chapter: [Evaluating agents and tool use](https://gimme-job.com/learn/llm?topic=agent-testing)

A support agent that refunds returned orders, tested the way agents should be: tool calls validated and authorized at the boundary, outcomes and trajectories checked separately, faults injected, claims compared with the real state, reliability measured over repeated runs, and the tools served over an MCP-style protocol with contract tests.

| File | Content |
|---|---|
| `support_env.py` | Orders, refunds, an outbox and approvals behind four tools with JSON Schemas; argument validation with actionable errors, per-customer scoping, an approval gate above 100 EUR, and injectable timeouts |
| `agent_loop.py` | The agent loop with a step budget, and scripted policies that stand in for a model: careful, careless, looping, and flaky (seeded) |
| `agent_checks.py` | Outcome checks against the final state, trajectory rules (lookup before refund, no forbidden tools, no repeated successful calls, budget), false-claim detection and pass^k |
| `mcp_server.py` | `initialize`, `tools/list` and `tools/call` over JSON-RPC 2.0, following the 2025-11-25 specification of the Model Context Protocol |
| `test_*.py` | Tool contracts, agent runs, reliability, and protocol contract tests including property-based tests with Hypothesis |

## What the tests show

- Every invalid call returns an error the model can act on ("order_id '1042' does not match the format ^A-\d{4}$") instead of raising, and every tool definition rejects unknown arguments.
- A customer gets the same answer for another customer's order as for an order that does not exist, so the tool leaks nothing.
- Refunds above 100 EUR need an approval that an extra argument cannot fake, and a rejected approval keeps the gate closed.
- The careful policy passes the outcome, trajectory and honesty checks; the careless one reaches the right state on the happy path but refunds before checking the order, and with an injected fault it promises money that never moved.
- A timeout that happens once is recovered; one that keeps happening ends in an honest message and no refund.
- The step budget stops a policy that keeps calling the same tool.
- Over 60 seeded runs, a policy that sometimes skips the lookup succeeds in 82% of runs, but three runs in a row succeed only about 54% of the time (pass^3), and five in a row about 35%.
- The MCP server lists every tool with a schema and accepts a valid call for each; an unknown tool is a protocol error (-32602), invalid input and business errors are results with `isError: true`, and arbitrary arguments always get a well-formed answer.

```bash
uv run --project examples/llm-testing pytest examples/llm-testing/13-agent-testing
```
