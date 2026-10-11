"""A deterministic environment for a support agent: orders, refunds, an outbox and approvals, exposed as
tools with JSON Schemas, argument validation, per-customer scoping and an approval gate.

Chapter: Evaluating agents and tool use (testing tool definitions and calls; a deterministic test environment)
https://gimme-job.com/learn/llm?topic=agent-testing
"""

import copy
import re
from dataclasses import dataclass

APPROVAL_LIMIT_EUR = 100.0

TOOLS = {
    "lookup_order": {
        "description": "Look up one of the customer's orders by its number, for example A-1042.",
        "input_schema": {"type": "object", "required": ["order_id"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"}}},
    },
    "issue_refund": {
        "description": "Refund a returned order to the original payment method. Refunds above 100 EUR need an approval first.",
        "input_schema": {"type": "object", "required": ["order_id", "amount_eur", "reason"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"},
                                        "amount_eur": {"type": "number", "minimum": 0.01},
                                        "reason": {"type": "string", "enum": ["return", "damaged", "late"]}}},
    },
    "request_approval": {
        "description": "Ask a team lead to approve a refund above 100 EUR. Returns whether it was approved.",
        "input_schema": {"type": "object", "required": ["order_id"], "additionalProperties": False,
                         "properties": {"order_id": {"type": "string", "pattern": r"^A-\d{4}$"}}},
    },
    "send_email": {
        "description": "Send a short message to the customer of the conversation.",
        "input_schema": {"type": "object", "required": ["text"], "additionalProperties": False,
                         "properties": {"text": {"type": "string", "minLength": 1}}},
    },
}
TYPES = {"string": str, "number": (int, float)}

START_ORDERS = {
    "A-1042": {"customer": "olena", "total": 89.9, "status": "returned"},
    "A-1077": {"customer": "olena", "total": 240.0, "status": "returned"},
    "A-2210": {"customer": "taras", "total": 45.5, "status": "delivered"},
}


@dataclass(frozen=True)
class ToolResult:
    is_error: bool
    text: str
    data: dict | None = None


def validate_arguments(name: str, arguments: dict) -> list[str]:
    """Problems with a call to a known tool, phrased so that a model can correct the call."""
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
        elif "minLength" in spec and len(value) < spec["minLength"]:
            problems.append(f"{field} must not be empty")
    return problems


class SupportEnvironment:
    """State plus tools for one customer conversation. `faults` maps a tool name to the number of times it
    fails with a timeout before it starts to work; `approve` decides approval requests."""

    def __init__(self, customer: str, faults: dict[str, int] | None = None, approve: bool = True) -> None:
        self.customer = customer
        self.orders = copy.deepcopy(START_ORDERS)
        self.refunds: list[dict] = []
        self.outbox: list[str] = []
        self.approved: set[str] = set()
        self.faults = dict(faults or {})
        self.approve = approve
        self.calls: list[tuple[str, dict]] = []

    def snapshot(self) -> dict:
        return {"orders": copy.deepcopy(self.orders), "refunds": list(self.refunds), "outbox": list(self.outbox)}

    def call(self, name: str, arguments: dict) -> ToolResult:
        """Validate, authorize and execute one tool call. Every problem is returned as an error result
        the model can act on; nothing raises."""
        self.calls.append((name, dict(arguments)))
        if name not in TOOLS:
            return ToolResult(True, f"unknown tool {name!r}; available: {sorted(TOOLS)}")
        problems = validate_arguments(name, arguments)
        if problems:
            return ToolResult(True, "; ".join(problems))
        if self.faults.get(name, 0) > 0:
            self.faults[name] -= 1
            return ToolResult(True, f"{name} timed out, try again")
        return getattr(self, f"_{name}")(**arguments)

    def _own_order(self, order_id: str) -> dict | None:
        order = self.orders.get(order_id)
        return order if order and order["customer"] == self.customer else None

    def _lookup_order(self, order_id: str) -> ToolResult:
        order = self._own_order(order_id)
        if order is None:  # the same answer for missing orders and other customers' orders
            return ToolResult(True, f"no order {order_id} for this customer")
        return ToolResult(False, f"order {order_id}: {order['status']}, {order['total']} EUR", {"order_id": order_id, **order})

    def _issue_refund(self, order_id: str, amount_eur: float, reason: str) -> ToolResult:
        order = self._own_order(order_id)
        if order is None:
            return ToolResult(True, f"no order {order_id} for this customer")
        if order["status"] != "returned":
            return ToolResult(True, f"order {order_id} is {order['status']}; only returned orders can be refunded")
        if amount_eur != order["total"]:
            return ToolResult(True, f"refund must equal the order total of {order['total']} EUR")
        if amount_eur > APPROVAL_LIMIT_EUR and order_id not in self.approved:
            return ToolResult(True, f"refunds above {APPROVAL_LIMIT_EUR:.0f} EUR need request_approval first")
        self.refunds.append({"order_id": order_id, "amount_eur": amount_eur, "reason": reason})
        order["status"] = "refunded"
        return ToolResult(False, f"refund of {amount_eur} EUR for {order_id} created")

    def _request_approval(self, order_id: str) -> ToolResult:
        if self._own_order(order_id) is None:
            return ToolResult(True, f"no order {order_id} for this customer")
        if self.approve:
            self.approved.add(order_id)
            return ToolResult(False, f"refund for {order_id} approved")
        return ToolResult(False, f"refund for {order_id} rejected by the team lead")

    def _send_email(self, text: str) -> ToolResult:
        self.outbox.append(text)
        return ToolResult(False, "message sent")
