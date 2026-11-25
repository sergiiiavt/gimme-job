"""A small MCP server over stdio, following the 2026-07-28 revision of the Model Context Protocol.

The server helps triage failing tests. It exposes two read tools and one write tool that only
creates a proposal: quarantining a test needs a person's approval, which this server never grants
on its own.

Wire format (2026-07-28):
- one JSON-RPC message per line on stdin and stdout; logs go to stderr only;
- no initialize handshake: every request carries the protocol version and client capabilities
  in params._meta, and server/discover advertises versions, capabilities and server info;
- every result carries resultType; list and discover results also carry ttlMs and cacheScope.

Run it by hand:  python server.py   (then type JSON lines, or use client.py)
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any

PROTOCOL_VERSION = "2026-07-28"
SUPPORTED_VERSIONS = [PROTOCOL_VERSION]
SERVER_INFO = {"name": "flaky-triage-lab", "version": "1.0.0"}
META_VERSION = "io.modelcontextprotocol/protocolVersion"
META_CAPABILITIES = "io.modelcontextprotocol/clientCapabilities"
META_SERVER_INFO = "io.modelcontextprotocol/serverInfo"

UNSUPPORTED_PROTOCOL_VERSION = -32022
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INVALID_REQUEST = -32600
PARSE_ERROR = -32700

# In-memory data standing in for a CI system.
RUNS = {
    "run-512": [
        {"test": "checkout::test_apply_coupon", "error": "TimeoutError: element #pay not visible after 5s"},
        {"test": "api::test_refund_rounding", "error": "AssertionError: 105.4 != 105.40"},
    ],
}
HISTORY = {
    "checkout::test_apply_coupon": ["pass", "fail", "pass", "pass", "fail", "pass", "pass", "fail", "pass", "pass"],
    "api::test_refund_rounding": ["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "fail"],
}
PROPOSALS: list[dict[str, Any]] = []

TOOLS = [
    {
        "name": "ci_list_failures",
        "title": "List failed tests of a CI run",
        "description": "Return the failed tests of one CI run with their first error line. Use it first, then ci_test_history for each test.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["run_id"],
            "properties": {"run_id": {"type": "string", "pattern": "^run-[0-9]+$", "description": "CI run id, e.g. run-512."}},
        },
    },
    {
        "name": "ci_test_history",
        "title": "Recent results of one test",
        "description": "Return the last results (oldest first) of one test and its failure rate. A test that both passes and fails on unchanged code is flaky.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["test"],
            "properties": {"test": {"type": "string", "minLength": 3, "description": "Full test id, e.g. checkout::test_apply_coupon."}},
        },
    },
    {
        "name": "ci_propose_quarantine",
        "title": "Propose quarantining a test",
        "description": "Create a quarantine proposal for a person to approve. Nothing is quarantined until a person approves it outside this server.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["test", "reason"],
            "properties": {
                "test": {"type": "string", "minLength": 3},
                "reason": {"type": "string", "minLength": 10, "maxLength": 300},
            },
        },
    },
]


def log(message: str) -> None:
    """Diagnostics go to stderr; stdout is reserved for protocol messages."""
    print(f"[flaky-triage-lab] {message}", file=sys.stderr, flush=True)


def result(request_id: Any, value: dict[str, Any]) -> dict[str, Any]:
    body = {"resultType": "complete", **value, "_meta": {META_SERVER_INFO: SERVER_INFO}}
    return {"jsonrpc": "2.0", "id": request_id, "result": body}


def error(request_id: Any, code: int, message: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        body["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": body}


def tool_result(data: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(data)}], "structuredContent": data, "isError": False}


def tool_error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "isError": True}


def check_arguments(tool: dict[str, Any], arguments: Any) -> str | None:
    """Return an actionable message for the first problem, or None when the arguments are valid."""
    if not isinstance(arguments, dict):
        return "arguments must be an object."
    schema = tool["inputSchema"]
    allowed = schema["properties"]
    unknown = sorted(set(arguments) - set(allowed))
    if unknown:
        return f"Unknown argument(s): {', '.join(unknown)}. Allowed: {', '.join(allowed)}."
    for name in schema["required"]:
        if name not in arguments:
            return f"'{name}' is required."
    for name, value in arguments.items():
        rule = allowed[name]
        if not isinstance(value, str):
            return f"'{name}' must be a string."
        if len(value) < rule.get("minLength", 0):
            return f"'{name}' must have at least {rule['minLength']} characters."
        if len(value) > rule.get("maxLength", 10_000):
            return f"'{name}' must have at most {rule['maxLength']} characters."
        if "pattern" in rule and not re.fullmatch(rule["pattern"], value):
            return f"'{name}' value {value!r} does not match {rule['pattern']}."
    return None


def call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "ci_list_failures":
        failures = RUNS.get(arguments["run_id"])
        if failures is None:
            return tool_error(f"No CI run {arguments['run_id']}. Known runs: {', '.join(RUNS)}.")
        return tool_result({"run_id": arguments["run_id"], "failures": failures})
    if name == "ci_test_history":
        results = HISTORY.get(arguments["test"])
        if results is None:
            return tool_error(f"No history for {arguments['test']}. Use a test id returned by ci_list_failures.")
        failure_rate = round(results.count("fail") / len(results), 2)
        return tool_result({"test": arguments["test"], "results": results, "failure_rate": failure_rate})
    proposal = {"id": f"proposal-{len(PROPOSALS) + 1}", "test": arguments["test"], "reason": arguments["reason"], "status": "PENDING_APPROVAL"}
    PROPOSALS.append(proposal)
    log(f"created {proposal['id']} for {proposal['test']}")
    return tool_result(proposal)


def handle(message: Any) -> dict[str, Any] | None:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
        return error(message.get("id") if isinstance(message, dict) else None, INVALID_REQUEST, "Invalid Request")
    if "id" not in message:
        return None  # notifications get no response
    request_id = message["id"]
    params = message.get("params", {})
    if not isinstance(params, dict):
        return error(request_id, INVALID_PARAMS, "params must be an object")
    meta = params.get("_meta", {})
    if not isinstance(meta, dict):
        return error(request_id, INVALID_PARAMS, "params._meta must be an object")
    requested = meta.get(META_VERSION)
    if requested not in SUPPORTED_VERSIONS:
        return error(request_id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version",
                     {"supported": SUPPORTED_VERSIONS, "requested": requested})
    if not isinstance(meta.get(META_CAPABILITIES), dict):
        return error(request_id, INVALID_PARAMS, f"params._meta must include {META_CAPABILITIES} (use {{}} for none).")

    method = message["method"]
    if method == "server/discover":
        return result(request_id, {
            "supportedVersions": SUPPORTED_VERSIONS,
            "capabilities": {"tools": {}},
            "instructions": "Triage failing CI tests. Read before you propose; proposals need a person's approval.",
            "ttlMs": 3_600_000,
            "cacheScope": "public",
        })
    if method == "tools/list":
        return result(request_id, {"tools": TOOLS, "ttlMs": 3_600_000, "cacheScope": "public"})
    if method == "tools/call":
        name = params.get("name")
        tool = next((candidate for candidate in TOOLS if candidate["name"] == name), None)
        if tool is None:
            return error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments", {})
        problem = check_arguments(tool, arguments)
        if problem:
            return result(request_id, tool_error(f"Invalid arguments for {name}: {problem}"))
        return result(request_id, call_tool(name, arguments))
    return error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")


def serve(stdin=sys.stdin, stdout=sys.stdout) -> None:
    log(f"ready, protocol {PROTOCOL_VERSION}")
    for line in stdin:
        if not line.strip():
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            response = error(None, PARSE_ERROR, "Parse error")
        else:
            response = handle(message)
        if response is not None:
            stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
            stdout.flush()
    log("stdin closed, exiting")


if __name__ == "__main__":
    sys.stdout.reconfigure(newline="\n")
    serve()
