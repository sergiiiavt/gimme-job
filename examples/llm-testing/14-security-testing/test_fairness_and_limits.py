from consumption import UsageLimiter, estimate_tokens
from fairness import counterfactual_report, make_scorer, sample_cvs, sign_test

CVS = sample_cvs(60)


# ---------------------------------------------------------------- counterfactual fairness

def test_a_hidden_penalty_is_detected_by_paired_comparison():
    report = counterfactual_report(make_scorer(penalty_for_group_a=0.7, seed=2), CVS)
    assert report.mean_difference > 0.4
    assert report.p_value < 0.001
    assert report.decision_flips > 0, "the name alone changes shortlist decisions"


def test_a_scorer_without_the_penalty_passes():
    report = counterfactual_report(make_scorer(penalty_for_group_a=0.0, seed=2), CVS)
    assert report.p_value > 0.05 and abs(report.mean_difference) < 0.3


def test_the_sign_test_is_exact_and_symmetric():
    assert sign_test(10, 10) == sign_test(0, 10) == 2 / 2**10
    assert sign_test(5, 10) == 1.0 and sign_test(0, 0) == 1.0


# ---------------------------------------------------------------- unbounded consumption

class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_oversized_inputs_are_refused_before_any_model_call():
    limiter = UsageLimiter(FakeClock(), max_input_tokens=100)
    decision = limiter.check("olena", "word " * 500)
    assert not decision.allowed and "above the limit" in decision.reason


def test_the_budget_runs_out_and_refills_over_time():
    clock = FakeClock()
    limiter = UsageLimiter(clock, max_output_tokens=800, budget_tokens=2_000, refill_per_second=10)
    assert limiter.check("olena", "Where is my parcel?").allowed
    assert limiter.check("olena", "And my refund?").allowed
    blocked = limiter.check("olena", "One more question")
    assert not blocked.allowed and "budget exhausted" in blocked.reason
    assert limiter.check("taras", "Hello").allowed, "budgets are per user"
    clock.now += 100  # 1,000 tokens refilled
    assert limiter.check("olena", "One more question").allowed


def test_every_allowed_request_carries_the_output_cap():
    assert UsageLimiter(FakeClock(), max_output_tokens=300).check("olena", "Hi").max_output_tokens == 300


def test_the_token_estimate_never_undercounts_words():
    assert estimate_tokens("a b c d e f g h") >= 8
