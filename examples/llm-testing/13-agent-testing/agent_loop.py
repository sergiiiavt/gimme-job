"""The agent loop with a step budget, and scripted policies that stand in for a model.

Chapter: Evaluating agents and tool use
https://gimme-job.com/learn/llm?topic=agent-testing

A policy decides the next action from the task and the history of calls and results, like a model would.
Scripted policies make the loop, the checks and the faults testable offline; a real model plugs in with
the same next_action(task, history) method.
"""

import random
from dataclasses import dataclass, field

from support_env import SupportEnvironment, ToolResult


@dataclass(frozen=True)
class Action:
    tool: str = ""
    arguments: dict = field(default_factory=dict)
    final_message: str = ""


@dataclass
class Run:
    status: str  # "done" or "budget_exceeded"
    final_message: str
    steps: list[tuple[str, dict, ToolResult]]


def run_agent(task: dict, policy, env: SupportEnvironment, max_steps: int = 8) -> Run:
    steps: list[tuple[str, dict, ToolResult]] = []
    for _ in range(max_steps):
        action = policy.next_action(task, steps)
        if action.final_message:
            return Run("done", action.final_message, steps)
        steps.append((action.tool, action.arguments, env.call(action.tool, action.arguments)))
    return Run("budget_exceeded", "", steps)


def _last(steps, tool):
    return next((result for name, _, result in reversed(steps) if name == tool), None)


class CarefulPolicy:
    """Looks the order up, asks for approval when needed, retries timeouts twice, never claims success
    that the tools did not confirm, and confirms by e-mail."""

    def next_action(self, task: dict, steps) -> Action:
        order_id = task["order_id"]
        lookup = _last(steps, "lookup_order")
        if lookup is None or (lookup.is_error and "timed out" in lookup.text and self._attempts(steps, "lookup_order") < 3):
            return Action("lookup_order", {"order_id": order_id})
        if lookup.is_error:
            return Action(final_message=f"I could not find order {order_id}; a colleague will contact you.")
        order = lookup.data
        if order["status"] != "returned":
            return Action(final_message=f"Order {order_id} is {order['status']}, so it cannot be refunded yet.")
        if order["total"] > 100 and _last(steps, "request_approval") is None:
            return Action("request_approval", {"order_id": order_id})
        approval = _last(steps, "request_approval")
        if approval is not None and "rejected" in approval.text:
            return Action(final_message="Your refund needs a manual review; a colleague will contact you.")
        refund = _last(steps, "issue_refund")
        if refund is None or (refund.is_error and "timed out" in refund.text and self._attempts(steps, "issue_refund") < 3):
            return Action("issue_refund", {"order_id": order_id, "amount_eur": order["total"], "reason": "return"})
        if refund.is_error:
            return Action(final_message="I could not issue the refund right now; a colleague will contact you today.")
        if _last(steps, "send_email") is None:
            return Action("send_email", {"text": f"Your refund of {order['total']:.2f} EUR for {order_id} is on its way."})
        return Action(final_message=f"Your refund of {order['total']:.2f} EUR is on its way.")

    @staticmethod
    def _attempts(steps, tool) -> int:
        return sum(name == tool for name, _, _ in steps)


class CarelessPolicy:
    """Refunds without looking the order up and claims success whatever the tools returned."""

    def next_action(self, task: dict, steps) -> Action:
        if not steps:
            return Action("issue_refund", {"order_id": task["order_id"], "amount_eur": task["amount_eur"], "reason": "return"})
        if len(steps) == 1:
            return Action("send_email", {"text": "Your refund is on its way."})
        return Action(final_message=f"Your refund of {task['amount_eur']:.2f} EUR is on its way.")


class LoopingPolicy:
    """Keeps looking the same order up: the budget must stop it."""

    def next_action(self, task: dict, steps) -> Action:
        return Action("lookup_order", {"order_id": task["order_id"]})


class FlakyPolicy(CarefulPolicy):
    """A careful policy that, like a sampled model, sometimes skips the lookup and refunds the amount
    the customer mentioned. Seeded, so every run is reproducible."""

    def __init__(self, seed: int, slip_rate: float) -> None:
        self.slip = random.Random(seed).random() < slip_rate

    def next_action(self, task: dict, steps) -> Action:
        if self.slip and not steps:
            return Action("issue_refund", {"order_id": task["order_id"], "amount_eur": task["amount_eur"], "reason": "return"})
        if self.slip and len(steps) == 1:
            return Action(final_message="Your refund is on its way.")
        return super().next_action(task, steps)
