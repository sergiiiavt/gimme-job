"""A minimal in-memory server for the Model Context Protocol tool methods, over JSON-RPC 2.0.

Chapter: Evaluating agents and tool use (testing MCP servers)
https://gimme-job.com/learn/llm?topic=agent-testing

Implements initialize, tools/list and tools/call following the 2025-11-25 specification: an unknown tool
is a protocol error (-32602), while invalid arguments and business errors are tool results with
isError: true, so that a model can correct itself. A real server would sit behind the stdio or HTTP
transport of an MCP SDK; the handler logic and its contract tests are the same.
"""

import json

from support_env import TOOLS, SupportEnvironment

PROTOCOL_VERSION = "2025-11-25"
PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS = -32700, -32600, -32601, -32602


class SupportMcpServer:
    def __init__(self, env: SupportEnvironment) -> None:
        self.env = env

    def handle(self, raw: str) -> str | None:
        """One JSON-RPC message in, one response out (None for notifications)."""
        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            return self._error(None, PARSE_ERROR, "parse error")
        if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
            return self._error(message.get("id") if isinstance(message, dict) else None, INVALID_REQUEST, "invalid request")
        if "id" not in message:
            return None  # notifications such as notifications/initialized get no response
        method, params, request_id = message["method"], message.get("params") or {}, message["id"]
        if method == "initialize":
            return self._result(request_id, {"protocolVersion": PROTOCOL_VERSION, "capabilities": {"tools": {"listChanged": False}},
                                             "serverInfo": {"name": "support-tools", "version": "1.0.0"}})
        if method == "tools/list":
            return self._result(request_id, {"tools": [
                {"name": name, "description": tool["description"], "inputSchema": tool["input_schema"]}
                for name, tool in TOOLS.items()]})
        if method == "tools/call":
            name = params.get("name")
            if name not in TOOLS:
                return self._error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
            arguments = params.get("arguments") or {}
            if not isinstance(arguments, dict):
                return self._error(request_id, INVALID_PARAMS, "arguments must be an object")
            result = self.env.call(name, arguments)
            payload = {"content": [{"type": "text", "text": result.text}], "isError": result.is_error}
            if result.data is not None:
                payload["structuredContent"] = result.data
            return self._result(request_id, payload)
        return self._error(request_id, METHOD_NOT_FOUND, f"method not found: {method}")

    @staticmethod
    def _result(request_id, result: dict) -> str:
        return json.dumps({"jsonrpc": "2.0", "id": request_id, "result": result})

    @staticmethod
    def _error(request_id, code: int, message: str) -> str:
        return json.dumps({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})
