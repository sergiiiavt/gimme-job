from agent_checks import false_claim, outcome_problems, pass_hat_k, trajectory_problems
from agent_loop import CarefulPolicy, CarelessPolicy, FlakyPolicy, LoopingPolicy, run_agent
from support_env import SupportEnvironment

TASK = {"order_id": "A-1042", "amount_eur": 89.9}
REFUND = [{"order_id": "A-1042", "amount_eur": 89.9}]


def test_a_careful_run_passes_every_check():
    env = SupportEnvironment("olena")
    run = run_agent(TASK, CarefulPolicy(), env)
    assert run.status == "done"
    assert outcome_problems(env, REFUND, expect_email=True) == []
    assert trajectory_problems(run) == []
    assert not false_claim(run, env)
    assert [name for name, _, _ in run.steps] == ["lookup_order", "issue_refund", "send_email"]


def test_a_large_refund_goes_through_the_approval_gate():
    env = SupportEnvironment("olena")
    run = run_agent({"order_id": "A-1077", "amount_eur": 240.0}, CarefulPolicy(), env)
    assert [name for name, _, _ in run.steps][:3] == ["lookup_order", "request_approval", "issue_refund"]
    assert outcome_problems(env, [{"order_id": "A-1077", "amount_eur": 240.0}], expect_email=True) == []


def test_a_rejected_approval_ends_honestly_without_a_refund():
    env = SupportEnvironment("olena", approve=False)
    run = run_agent({"order_id": "A-1077", "amount_eur": 240.0}, CarefulPolicy(), env)
    assert env.refunds == [] and "manual review" in run.final_message and not false_claim(run, env)


def test_a_lucky_run_has_the_right_outcome_and_a_risky_trajectory():
    env = SupportEnvironment("olena")
    run = run_agent(TASK, CarelessPolicy(), env)
    assert outcome_problems(env, REFUND, expect_email=True) == []
    assert "refund attempted before the order was looked up" in trajectory_problems(run)


def test_a_careless_agent_claims_a_refund_it_could_not_make():
    env = SupportEnvironment("taras")
    run = run_agent({"order_id": "A-2210", "amount_eur": 45.5}, CarelessPolicy(), env)
    assert env.refunds == [] and run.steps[0][2].is_error
    assert false_claim(run, env), "the message promises money that never moved"


def test_fault_injection_separates_recovery_from_false_claims():
    recovered = SupportEnvironment("olena", faults={"issue_refund": 1})
    run = run_agent(TASK, CarefulPolicy(), recovered)
    assert recovered.refunds and not false_claim(run, recovered)

    exhausted = SupportEnvironment("olena", faults={"issue_refund": 5})
    run = run_agent(TASK, CarefulPolicy(), exhausted)
    assert exhausted.refunds == [] and "could not issue the refund" in run.final_message
    assert not false_claim(run, exhausted)

    careless = SupportEnvironment("olena", faults={"issue_refund": 1})
    assert false_claim(run_agent(TASK, CarelessPolicy(), careless), careless)


def test_the_step_budget_stops_a_loop():
    env = SupportEnvironment("olena")
    run = run_agent(TASK, LoopingPolicy(), env, max_steps=5)
    assert run.status == "budget_exceeded" and len(run.steps) == 5
    problems = trajectory_problems(run, max_steps=5)
    assert "step budget of 5 exceeded" in problems and "repeated successful call lookup_order" in problems


def test_reliability_over_repeated_runs_is_reported_as_pass_hat_k():
    """Each seed is one run of a policy that sometimes skips the lookup, like a sampled model."""
    successes = 0
    runs = 60
    for seed in range(runs):
        env = SupportEnvironment("olena")
        run = run_agent(TASK, FlakyPolicy(seed, slip_rate=0.2), env)
        successes += not outcome_problems(env, REFUND, expect_email=True) and not trajectory_problems(run)
    pass_at_1 = successes / runs
    assert 0.65 <= pass_at_1 <= 0.95
    assert pass_hat_k(runs, successes, 3) < pass_at_1 - 0.1, "three runs in a row succeed much less often"
    assert pass_hat_k(runs, runs, 3) == 1.0
