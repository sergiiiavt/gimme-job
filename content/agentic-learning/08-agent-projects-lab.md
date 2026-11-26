# Projects and MCP lab

The runnable lab combines a narrow task, MCP tools, a bounded loop, a proposal boundary and checks of the observed result.

This chapter covers example project scopes and agent design controls, and a runnable lab: an MCP server, a client and a triage agent built for the 2026-07-28 revision of the Model Context Protocol. Systematic testing of what you build is covered in [Testing MCP servers](/learn/llm?topic=agent-testing&section=testing-mcp-servers).

**Prerequisites:** [Model Context Protocol](/learn/agentic?topic=model-context-protocol), [Human approval and action boundaries](/learn/agentic?topic=human-approval), [Evaluating and observing agents](/learn/agentic?topic=agent-observability).

## Example project scopes

These QA examples have different tasks, tool sets, action boundaries and observable outcomes:

| Project | Tools | Boundary | How you know it worked |
|---|---|---|---|
| Flaky-test triage (the lab below) | List failures, read test history, propose quarantine | Quarantine only as a proposal | Flaky tests proposed, real regressions flagged, nothing applied |
| Failed CI log explainer | Read job log, read the diff | Read-only | The explanation points at a line you can verify |
| API contract drift checker | Read the OpenAPI document, call the test environment | Issue drafts need approval | Seeded contract changes are all detected |
| Test cases from a requirement | Read the requirement, write a draft file | A reviewer approves the draft | Every acceptance criterion has a case |
| Vacancy matcher | Search vacancies, analyse one vacancy | Read-only, no applications sent | Matches agree with a labelled set |
| Release regression checklist | Read merged pull requests | Read-only | The checklist covers every changed area |

Avoid projects whose success you cannot check ("make our QA smarter") and projects whose first version needs access to production or money.

## Agent design controls

An agent design includes several distinct concerns:

- **A one-sentence scope** that says what the agent does and what it must never do.
- **Tools with names, descriptions and strict schemas**, classified as read, write or external communication.
- **Permissions and approvals in code**: the agent's credentials, and which actions need a person.
- **Limits**: a step budget, a time limit and a cost limit enforced by the loop.
- **A trace** with every step and a stop reason.
- **An evaluation set**: cases with checks on the outcome and the trajectory.
- **A README** that explains how to run it and what it demonstrates.

## The MCP lab

The lab in [examples/agentic-mcp-lab](https://github.com/sergiiiavt/gimme-job/tree/main/examples/agentic-mcp-lab) is a complete small system in plain Python with no dependencies and no API key. A scripted policy stands in for the model, so every run is reproducible.

```diagram
agent.py   the loop: policy proposes a tool call → client runs it → result goes back; step budget; trace
   ↓
client.py  starts server.py as a subprocess, probes it with server/discover, one JSON-RPC message per line
   ↓  stdin / stdout (protocol messages only)        stderr (logs)
server.py  MCP server: server/discover, tools/list, tools/call; checks protocol version and capabilities on every request
```

| File | What it does |
|---|---|
| `server.py` | Exposes `ci_list_failures` and `ci_test_history` (read) and `ci_propose_quarantine`, which only creates a `PENDING_APPROVAL` proposal |
| `client.py` | Starts the server, sends requests with `_meta`, raises protocol errors, and shuts the server down by closing its stdin |
| `agent.py` | Triages one CI run: lists failures, reads each test's history, proposes quarantine for flaky tests, and flags likely regressions |
| `test_lab.py` | Checks discovery, version handling, tool schemas, tool errors versus protocol errors, the stdio rules and the agent's decisions |

Run it from the repository root with Python 3.12 or newer:

```bash
python examples/agentic-mcp-lab/agent.py
python -m unittest discover -s examples/agentic-mcp-lab -v
```

The agent's output shows the trace, one proposal that waits for a person, and one test to investigate:

```text
step 1: ci_list_failures {"run_id": "run-512"} error=False
step 2: ci_test_history {"test": "checkout::test_apply_coupon"} error=False
step 3: ci_test_history {"test": "api::test_refund_rounding"} error=False
step 4: ci_propose_quarantine {"test": "checkout::test_apply_coupon", ...} error=False
stop: done
needs approval: proposal-1 checkout::test_apply_coupon - Failed 3 of 10 recent runs on unchanged code.
investigate (likely regression, not flaky): api::test_refund_rounding
```

## What the lab shows about the protocol

The lab follows the 2026-07-28 revision, which differs from older tutorials in a few places that are easy to get wrong:

- **Discovery instead of a handshake.** There is no `initialize`. The client probes the server with `server/discover`, which returns `supportedVersions`, `capabilities` and, in `_meta`, the server's name and version.
- **Version and capabilities on every request.** Each request carries `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in `params._meta`. A version the server does not support gets error `-32022`, with `supported` and `requested` in the error data.
- **Every result has a `resultType`.** List and discovery results also carry `ttlMs` and `cacheScope`, which tell the client how long it may cache them.
- **The stdio rules.** One message per line, nothing but protocol messages on stdout, logs on stderr, and a server that exits when its stdin closes.

A small checker catches the most common mistakes in a server's responses. Here it compares a response written for an older revision with one that follows 2026-07-28:

```python
REQUIRED = {
    "server/discover": ["resultType", "supportedVersions", "capabilities", "ttlMs", "cacheScope"],
    "tools/list": ["resultType", "tools", "ttlMs", "cacheScope"],
    "tools/call": ["resultType", "content"],
}
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

def check_response(method, response):
    problems = []
    if "error" in response:
        error = response["error"]
        if error.get("code") == -32022 and set(error.get("data", {})) != {"supported", "requested"}:
            problems.append("version error must report supported and requested versions")
        return problems
    body = response.get("result", {})
    for field in REQUIRED[method]:
        if field not in body:
            problems.append(f"{method}: missing {field}")
    for tool in body.get("tools", []):
        if tool.get("inputSchema", {}).get("type") != "object":
            problems.append(f"tool {tool.get('name')}: inputSchema.type must be object")
    if SERVER_INFO_KEY not in body.get("_meta", {}):
        problems.append(f"{method}: _meta should carry serverInfo")
    return problems

older = {"result": {"tools": [{"name": "ci_list_failures", "inputSchema": {"properties": {}}}]}}
current = {"result": {"resultType": "complete", "ttlMs": 3600000, "cacheScope": "public",
                      "tools": [{"name": "ci_list_failures", "inputSchema": {"type": "object"}}],
                      "_meta": {SERVER_INFO_KEY: {"name": "flaky-triage-lab", "version": "1.0.0"}}}}
version_error = {"error": {"code": -32022, "message": "Unsupported protocol version", "data": {"supported": ["2026-07-28"]}}}

for label, method, response in [("older", "tools/list", older), ("current", "tools/list", current), ("error", "tools/list", version_error)]:
    print(label, check_response(method, response) or "OK")
```

## A rule worth stealing: flaky or regression

The lab's agent does not quarantine every test that sometimes fails. It treats a test as flaky only if it passed again after failing on unchanged code. A test that passed nine times and failed in the latest run is reported as a likely regression instead, because quarantining it would hide a real bug behind a label that says "flaky".

This is the kind of rule that belongs in code, where it can be tested, rather than in a prompt. A model can still help, for example by reading the failure messages and suggesting a cause, but the decision about what may be hidden from the build stays deterministic and reviewable.

## Common mistakes

- **Starting with a general assistant.** Broad agents are hard to evaluate and easy to misuse; start with one task.
- **No checkable outcome.** If you cannot tell whether a run was right without trusting the agent, you cannot improve it.
- **Copying an old protocol tutorial.** Check which MCP revision your client and server speak; handshake-based examples do not match 2026-07-28.
- **Logging to stdout from a stdio server.** The client reads it as broken protocol messages.
- **Writing actions without a proposal step.** Keep consequential actions behind an approval from the first version.
- **Putting decisions in prompts.** Rules such as "do not quarantine regressions" belong in tested code.

## Summary

The lab demonstrates a bounded agent loop, a trace, deterministic decisions and a write tool that only proposes. Its MCP 2026-07-28 implementation uses discovery instead of a handshake, version and capabilities on every request, `resultType` on every result and separate stdio protocol/log streams.
