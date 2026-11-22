# MCP lab: a flaky-test triage agent

Chapter: [Projects and MCP lab](https://gimme-job.com/learn/agentic?topic=agent-projects-lab)

A small, complete agent system you can read in one sitting: an MCP server over stdio that follows the **2026-07-28** revision of the Model Context Protocol, a client that talks to it, and a narrow agent that triages failing CI tests through it. It uses only the Python standard library and needs no API key: a scripted policy stands in for the model.

| File | Content |
|---|---|
| `server.py` | The MCP server: `server/discover`, `tools/list` and `tools/call`, the protocol version and client capabilities checked on every request, results with `resultType`, logs on stderr only. Two read tools and one write tool that only creates a proposal for a person to approve |
| `client.py` | A stdio client: starts the server as a subprocess, probes it with `server/discover`, sends one JSON-RPC message per line with `_meta`, and shuts the server down by closing its stdin |
| `agent.py` | The agent loop with a step budget and a trace: list the failures of a run, read each test's history, propose quarantine for flaky tests, and mark tests that only fail in the latest runs as likely regressions to investigate |
| `test_lab.py` | Build checks: discovery, version negotiation, tool schemas, tool errors versus protocol errors, the stdio rules, and the agent's decisions and budget |

## Run it

From the repository root (Python 3.12 or newer):

```bash
python examples/agentic-mcp-lab/agent.py
python examples/agentic-mcp-lab/client.py
python -m unittest discover -s examples/agentic-mcp-lab -v
```

The agent prints its trace, one quarantine proposal that needs approval, and one test to investigate:

```text
step 1: ci_list_failures {"run_id": "run-512"} error=False
step 2: ci_test_history {"test": "checkout::test_apply_coupon"} error=False
step 3: ci_test_history {"test": "api::test_refund_rounding"} error=False
step 4: ci_propose_quarantine {"test": "checkout::test_apply_coupon", ...} error=False
stop: done
needs approval: proposal-1 checkout::test_apply_coupon - Failed 3 of 10 recent runs on unchanged code.
investigate (likely regression, not flaky): api::test_refund_rounding
```

## What it demonstrates

- **Discovery instead of a handshake.** In revision 2026-07-28 there is no `initialize`; every request carries its protocol version and client capabilities in `params._meta`, and the client asks `server/discover` up front which versions the server supports. An unsupported version gets error `-32022` with `supported` and `requested`.
- **Tool errors versus protocol errors.** Invalid arguments come back as a normal result with `isError: true` and a message the model can act on; an unknown tool or method is a JSON-RPC error.
- **The stdio rules.** One message per line, nothing but protocol messages on stdout, logs on stderr, and a server that exits when its stdin closes.
- **A boundary in the server, not the prompt.** The only write tool creates a `PENDING_APPROVAL` proposal; nothing in this server can quarantine a test.
- **A rule worth stealing.** A test is treated as flaky only if it passed again after failing. A test that passed nine times and failed in the latest run is reported as a likely regression, because quarantining it would hide a real bug.

## Ways to extend it

- Replace `scripted_policy` with a real model: send the tool definitions from `tools/list` to a provider API and map its tool calls to `client.call_tool`.
- Add an approval step: a function that shows a person the proposal and only then calls a separate, permission-checked quarantine API.
- Record the trace with token counts and cost per step, as described in [Evaluating and observing agents](https://gimme-job.com/learn/agentic?topic=agent-observability).
- Test the server systematically with the techniques of [Testing MCP servers](https://gimme-job.com/learn/llm?topic=agent-testing&section=testing-mcp-servers).
