import pytest

from support_env import TOOLS, SupportEnvironment


@pytest.mark.parametrize("name, arguments, message", [
    ("lookup_order", {"order_id": "1042"}, "order_id '1042' does not match the format"),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": "89.90", "reason": "return"}, "amount_eur must be a number, got str"),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9, "reason": "changed my mind"}, "reason must be one of"),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": 89.9}, "missing argument 'reason'"),
    ("issue_refund", {"order_id": "A-1042", "amount_eur": True, "reason": "return"}, "amount_eur must be a number, got bool"),
    ("send_email", {"text": ""}, "text must not be empty"),
    ("cancel_order", {"order_id": "A-1042"}, "unknown tool 'cancel_order'"),
])
def test_invalid_calls_return_actionable_errors_instead_of_raising(name, arguments, message):
    result = SupportEnvironment("olena").call(name, arguments)
    assert result.is_error and message in result.text


def test_every_tool_definition_is_complete_and_strict():
    for name, tool in TOOLS.items():
        schema = tool["input_schema"]
        assert tool["description"], name
        assert schema["additionalProperties"] is False, f"{name} must reject unknown arguments"
        assert set(schema["required"]) <= set(schema["properties"]), name


def test_a_customer_cannot_see_or_refund_another_customers_order():
    env = SupportEnvironment("olena")
    lookup = env.call("lookup_order", {"order_id": "A-2210"})
    missing = env.call("lookup_order", {"order_id": "A-9999"})
    assert lookup.is_error and lookup.text == missing.text.replace("A-9999", "A-2210"), "no hint that the order exists"
    assert env.call("issue_refund", {"order_id": "A-2210", "amount_eur": 45.5, "reason": "return"}).is_error
    assert env.refunds == []


def test_only_returned_orders_are_refunded_and_only_for_their_total():
    env = SupportEnvironment("taras")
    assert "only returned orders" in env.call("issue_refund", {"order_id": "A-2210", "amount_eur": 45.5, "reason": "return"}).text
    env = SupportEnvironment("olena")
    assert "must equal the order total" in env.call("issue_refund", {"order_id": "A-1042", "amount_eur": 99.0, "reason": "return"}).text


def test_large_refunds_need_an_approval_that_arguments_cannot_fake():
    env = SupportEnvironment("olena")
    refund = {"order_id": "A-1077", "amount_eur": 240.0, "reason": "return"}
    assert "need request_approval first" in env.call("issue_refund", refund).text
    assert "unexpected argument 'approved'" in env.call("issue_refund", {**refund, "approved": True}).text
    assert not env.call("request_approval", {"order_id": "A-1077"}).is_error
    assert not env.call("issue_refund", refund).is_error


def test_a_rejected_approval_keeps_the_gate_closed():
    env = SupportEnvironment("olena", approve=False)
    assert "rejected" in env.call("request_approval", {"order_id": "A-1077"}).text
    assert env.call("issue_refund", {"order_id": "A-1077", "amount_eur": 240.0, "reason": "return"}).is_error


def test_injected_faults_fail_a_set_number_of_times():
    env = SupportEnvironment("olena", faults={"lookup_order": 2})
    results = [env.call("lookup_order", {"order_id": "A-1042"}) for _ in range(3)]
    assert [result.is_error for result in results] == [True, True, False]
    assert "timed out" in results[0].text
