"""Tool routing with authorization. Tool calls requested by a model are untrusted input.

Chapter: Testing LLM code without the model (testing tool routing and authorization)
https://gimme-job.com/learn/llm?topic=testing-without-the-model
"""

from collections.abc import Callable
from typing import Any

ORDERS = {
    "A-1042": {"owner": "u-17", "status": "shipped"},
    "A-2001": {"owner": "u-99", "status": "packed"},
}


class ToolError(Exception):
    """Returned to the model as a tool result; never shown raw to the user."""


def get_order_status(order_id: str, *, user_id: str) -> dict:
    order = ORDERS.get(order_id)
    if order is None or order["owner"] != user_id:          # one answer for missing and foreign orders
        raise ToolError("order not found")
    return {"order_id": order_id, "status": order["status"]}


TOOLS: dict[str, dict[str, Any]] = {
    "get_order_status": {"function": get_order_status, "required": {"order_id": str}},
}


def run_tool_call(call: dict, user_id: str, tools: dict[str, dict[str, Any]] | None = None) -> dict:
    """Validate a model-requested tool call and execute it for the CURRENT user only.
    The user identity always comes from the authenticated session, never from the model."""
    registry = TOOLS if tools is None else tools
    spec = registry.get(call.get("name", ""))
    if spec is None:
        return {"error": f"unknown tool {call.get('name')!r}"}
    arguments = call.get("arguments")
    if not isinstance(arguments, dict) or set(arguments) != set(spec["required"]):
        return {"error": "invalid arguments"}
    if not all(isinstance(arguments[key], kind) for key, kind in spec["required"].items()):
        return {"error": "invalid argument types"}
    function: Callable[..., dict] = spec["function"]
    try:
        return {"result": function(**arguments, user_id=user_id)}
    except ToolError as error:
        return {"error": str(error)}
