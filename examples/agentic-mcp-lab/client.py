"""A minimal MCP client for the stdio transport (revision 2026-07-28).

It starts the server as a subprocess, sends one JSON-RPC request per line with the protocol
version and client capabilities in params._meta, probes the server with server/discover before
anything else, and shuts the server down by closing its stdin.
"""

from __future__ import annotations

import itertools
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

PROTOCOL_VERSION = "2026-07-28"
CLIENT_INFO = {"name": "flaky-triage-lab-client", "version": "1.0.0"}
SERVER_SCRIPT = Path(__file__).with_name("server.py")


class McpError(Exception):
    """A JSON-RPC error returned by the server (protocol-level, not a tool failure)."""

    def __init__(self, code: int, message: str, data: Any = None):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.data = data


class StdioClient:
    def __init__(self, command: list[str] | None = None, protocol_version: str = PROTOCOL_VERSION):
        self.protocol_version = protocol_version
        self._ids = itertools.count(1)
        self.process = subprocess.Popen(
            command or [sys.executable, str(SERVER_SCRIPT)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        self.server: dict[str, Any] | None = None

    def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        request_id = next(self._ids)
        meta = {
            "io.modelcontextprotocol/protocolVersion": self.protocol_version,
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
        }
        message = {"jsonrpc": "2.0", "id": request_id, "method": method, "params": {**(params or {}), "_meta": meta}}
        assert self.process.stdin and self.process.stdout
        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()
        line = self.process.stdout.readline()
        if not line:
            raise ConnectionError("The server closed stdout without answering.")
        response = json.loads(line)
        if response.get("id") != request_id:
            raise ConnectionError(f"Expected a response to request {request_id}, got {response!r}.")
        if "error" in response:
            error = response["error"]
            raise McpError(error["code"], error["message"], error.get("data"))
        return response["result"]

    def discover(self) -> dict[str, Any]:
        """Probe the server first, as the stdio transport recommends."""
        self.server = self.request("server/discover")
        if self.protocol_version not in self.server["supportedVersions"]:
            raise McpError(-32022, "Server does not support this client's protocol version", self.server["supportedVersions"])
        return self.server

    def list_tools(self) -> list[dict[str, Any]]:
        return self.request("tools/list")["tools"]

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self.request("tools/call", {"name": name, "arguments": arguments})

    def close(self, timeout: float = 5.0) -> int:
        """Close stdin and wait; terminate only if the server does not exit on its own."""
        if self.process.stdin and not self.process.stdin.closed:
            self.process.stdin.close()
        try:
            return self.process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            self.process.kill()
            return self.process.wait()
        finally:
            for stream in (self.process.stdout, self.process.stderr):
                if stream:
                    stream.close()

    def __enter__(self) -> "StdioClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


if __name__ == "__main__":
    with StdioClient() as client:
        info = client.discover()
        print("server:", info["_meta"]["io.modelcontextprotocol/serverInfo"])
        print("tools:", [tool["name"] for tool in client.list_tools()])
        print(json.dumps(client.call_tool("ci_list_failures", {"run_id": "run-512"})["structuredContent"], indent=2))
