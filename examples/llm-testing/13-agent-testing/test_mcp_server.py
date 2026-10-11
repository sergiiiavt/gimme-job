import json

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from mcp_server import INVALID_PARAMS, INVALID_REQUEST, METHOD_NOT_FOUND, PARSE_ERROR, SupportMcpServer
from support_env import SupportEnvironment

# A valid call for every tool: a new tool fails the contract test until it gets an example here.
EXAMPLES = {
    "lookup_order": {"order_id": "A-1042"},
    "issue_refund": {"order_id": "A-1042", "amount_eur": 89.9, "reason": "return"},
    "request_approval": {"order_id": "A-1077"},
    "send_email": {"text": "Your refund is on its way."},
}


def request(server, method, params=None, request_id=1):
    message = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        message["params"] = params
    return json.loads(server.handle(json.dumps(message)))


@pytest.fixture
def server():
    return SupportMcpServer(SupportEnvironment("olena"))


def test_initialize_announces_the_tools_capability(server):
    result = request(server, "initialize", {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "test"}})["result"]
    assert result["protocolVersion"] == "2025-11-25" and "tools" in result["capabilities"]


def test_every_listed_tool_has_a_schema_and_accepts_a_valid_call(server):
    tools = request(server, "tools/list")["result"]["tools"]
    assert {tool["name"] for tool in tools} == set(EXAMPLES)
    for tool in tools:
        assert tool["description"] and tool["inputSchema"]["type"] == "object"
        result = request(server, "tools/call", {"name": tool["name"], "arguments": EXAMPLES[tool["name"]]})["result"]
        assert result["isError"] is False, (tool["name"], result)
        assert result["content"][0]["type"] == "text"


def test_structured_results_come_with_their_text_form(server):
    result = request(server, "tools/call", {"name": "lookup_order", "arguments": {"order_id": "A-1042"}})["result"]
    assert result["structuredContent"]["status"] == "returned"
    assert "returned" in result["content"][0]["text"]


def test_an_unknown_tool_is_a_protocol_error(server):
    response = request(server, "tools/call", {"name": "cancel_order", "arguments": {}})
    assert response["error"] == {"code": INVALID_PARAMS, "message": "Unknown tool: cancel_order"}


def test_invalid_input_is_a_tool_result_the_model_can_act_on(server):
    result = request(server, "tools/call", {"name": "lookup_order", "arguments": {"order_id": "1042"}})["result"]
    assert result["isError"] is True and "does not match the format" in result["content"][0]["text"]


def test_business_errors_are_tool_results_too(server):
    result = request(server, "tools/call", {"name": "issue_refund",
                                            "arguments": {"order_id": "A-1077", "amount_eur": 240.0, "reason": "return"}})["result"]
    assert result["isError"] is True and "request_approval" in result["content"][0]["text"]


@pytest.mark.parametrize("raw, code", [
    ("{not json", PARSE_ERROR),
    (json.dumps({"id": 1, "method": "tools/list"}), INVALID_REQUEST),
    (json.dumps({"jsonrpc": "2.0", "id": 1, "method": "resources/list"}), METHOD_NOT_FOUND),
    (json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "lookup_order", "arguments": [1]}}), INVALID_PARAMS),
])
def test_protocol_errors(server, raw, code):
    assert json.loads(server.handle(raw))["error"]["code"] == code


def test_notifications_get_no_response(server):
    assert server.handle(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"})) is None


json_values = st.recursive(st.none() | st.booleans() | st.integers() | st.floats(allow_nan=False) | st.text(max_size=20),
                           lambda children: st.lists(children, max_size=4) | st.dictionaries(st.text(max_size=10), children, max_size=4),
                           max_leaves=10)


@settings(max_examples=150)
@given(st.sampled_from(sorted(EXAMPLES)), st.dictionaries(st.text(max_size=12), json_values, max_size=5))
def test_any_arguments_get_a_well_formed_answer_and_never_crash(name, arguments):
    server = SupportMcpServer(SupportEnvironment("olena"))
    response = request(server, "tools/call", {"name": name, "arguments": arguments})
    assert response["jsonrpc"] == "2.0" and response["id"] == 1
    assert ("result" in response) != ("error" in response)
    if "result" in response:
        assert isinstance(response["result"]["isError"], bool) and response["result"]["content"]
