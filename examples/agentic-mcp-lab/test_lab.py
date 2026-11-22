"""Build checks for the MCP lab: the server speaks revision 2026-07-28 over stdio, and the agent
uses it within its boundaries. Systematic MCP server testing (contract and property tests, fault
injection) is covered by the LLM testing course: https://gimme-job.com/learn/llm?topic=agent-testing
"""

from __future__ import annotations

import json
import subprocess
import sys
import unittest

import server
from agent import is_flaky, run_triage
from client import PROTOCOL_VERSION, McpError, StdioClient

META = {
    "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientCapabilities": {},
}


class DiscoveryAndVersions(unittest.TestCase):
    def test_discover_advertises_versions_capabilities_and_server_info(self):
        with StdioClient() as client:
            info = client.discover()
        self.assertIn(PROTOCOL_VERSION, info["supportedVersions"])
        self.assertEqual(info["capabilities"], {"tools": {}})
        self.assertEqual(info["resultType"], "complete")
        self.assertIsInstance(info["ttlMs"], int)
        self.assertIn(info["cacheScope"], {"public", "private"})
        self.assertEqual(info["_meta"]["io.modelcontextprotocol/serverInfo"]["name"], "flaky-triage-lab")

    def test_unsupported_version_lists_what_the_server_supports(self):
        with StdioClient(protocol_version="2024-11-05") as client:
            with self.assertRaises(McpError) as raised:
                client.request("tools/list")
        self.assertEqual(raised.exception.code, -32022)
        self.assertEqual(raised.exception.data, {"supported": [PROTOCOL_VERSION], "requested": "2024-11-05"})

    def test_every_request_must_carry_client_capabilities(self):
        response = server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list",
                                  "params": {"_meta": {"io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION}}})
        self.assertEqual(response["error"]["code"], -32602)

    def test_unknown_method_and_notifications(self):
        unknown = server.handle({"jsonrpc": "2.0", "id": 2, "method": "ping", "params": {"_meta": META}})
        self.assertEqual(unknown["error"]["code"], -32601)
        self.assertIsNone(server.handle({"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {"_meta": META}}))


class Tools(unittest.TestCase):
    def setUp(self):
        self.client = StdioClient()
        self.client.discover()

    def tearDown(self):
        self.client.close()

    def test_tools_have_descriptions_and_strict_schemas(self):
        tools = self.client.list_tools()
        self.assertEqual([tool["name"] for tool in tools], ["ci_list_failures", "ci_test_history", "ci_propose_quarantine"])
        for tool in tools:
            self.assertGreater(len(tool["description"]), 40, tool["name"])
            self.assertEqual(tool["inputSchema"]["type"], "object")
            self.assertIs(tool["inputSchema"]["additionalProperties"], False)

    def test_a_valid_call_returns_structured_content_and_the_same_json_as_text(self):
        outcome = self.client.call_tool("ci_test_history", {"test": "checkout::test_apply_coupon"})
        self.assertEqual(outcome["resultType"], "complete")
        self.assertFalse(outcome["isError"])
        self.assertEqual(outcome["structuredContent"]["failure_rate"], 0.3)
        self.assertEqual(json.loads(outcome["content"][0]["text"]), outcome["structuredContent"])

    def test_invalid_arguments_are_tool_errors_the_model_can_act_on(self):
        bad_format = self.client.call_tool("ci_list_failures", {"run_id": "512"})
        self.assertTrue(bad_format["isError"])
        self.assertIn("does not match ^run-[0-9]+$", bad_format["content"][0]["text"])
        unknown_argument = self.client.call_tool("ci_list_failures", {"run_id": "run-512", "limit": 5})
        self.assertIn("Unknown argument(s): limit", unknown_argument["content"][0]["text"])
        missing_run = self.client.call_tool("ci_list_failures", {"run_id": "run-1"})
        self.assertIn("Known runs: run-512", missing_run["content"][0]["text"])

    def test_an_unknown_tool_is_a_protocol_error(self):
        with self.assertRaises(McpError) as raised:
            self.client.call_tool("ci_delete_run", {"run_id": "run-512"})
        self.assertEqual(raised.exception.code, -32602)


class StdioTransport(unittest.TestCase):
    def test_stdout_carries_only_protocol_messages_and_logs_go_to_stderr(self):
        requests = "\n".join(json.dumps({"jsonrpc": "2.0", "id": index, "method": method, "params": {"_meta": META}})
                             for index, method in enumerate(["server/discover", "tools/list"], start=1))
        completed = subprocess.run([sys.executable, server.__file__], input=requests + "\n", capture_output=True,
                                   text=True, encoding="utf-8", timeout=20, check=True)
        lines = [line for line in completed.stdout.splitlines() if line.strip()]
        self.assertEqual([json.loads(line)["id"] for line in lines], [1, 2])
        self.assertIn("[flaky-triage-lab] ready", completed.stderr)
        self.assertIn("stdin closed, exiting", completed.stderr)

    def test_the_server_exits_when_the_client_closes_stdin(self):
        client = StdioClient()
        client.discover()
        self.assertEqual(client.close(timeout=10), 0)


class TriageAgent(unittest.TestCase):
    def test_flaky_means_it_passed_again_after_failing(self):
        self.assertTrue(is_flaky(["pass", "fail", "pass"]))
        self.assertFalse(is_flaky(["pass", "pass", "fail"]))
        self.assertFalse(is_flaky(["fail", "fail", "fail"]))

    def test_the_agent_proposes_quarantine_only_for_the_flaky_test(self):
        report = run_triage("run-512")
        self.assertEqual(report["stop_reason"], "done")
        self.assertEqual([proposal["test"] for proposal in report["proposals"]], ["checkout::test_apply_coupon"])
        self.assertTrue(all(proposal["status"] == "PENDING_APPROVAL" for proposal in report["proposals"]))
        self.assertEqual(report["investigate"], ["api::test_refund_rounding"])
        self.assertFalse(any(entry["is_error"] for entry in report["trace"]))

    def test_the_step_budget_stops_the_run(self):
        report = run_triage("run-512", max_steps=2)
        self.assertEqual(report["stop_reason"], "step budget exhausted")
        self.assertEqual(report["steps"], 2)


if __name__ == "__main__":
    unittest.main()
