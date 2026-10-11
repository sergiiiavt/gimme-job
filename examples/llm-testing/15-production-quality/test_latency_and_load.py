import math
import random

import pytest
from hypothesis import given
from hypothesis import strategies as st

from latency_capacity import (check_objectives, in_flight, latency_summary, max_throughput_per_minute, percentile,
                              time_stream)
from load_simulation import SCENARIOS, ClientPolicy, ProviderLimits, main, simulate

# The mean service time of load_simulation.support_latency, worked out by hand: a lognormal with median 0.6 s
# and sigma 0.35 has mean 0.6 * e^(0.35^2 / 2); 150 to 400 tokens at 40 to 80 tokens per second take
# 275 * ln(2) / 40 seconds on average; one call in twenty waits 4 to 9 seconds for a tool.
MEAN_SERVICE_S = 0.6 * math.exp(0.35 ** 2 / 2) + 275 * math.log(2) / 40 + 0.05 * 6.5


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_the_average_hides_the_tail():
    rng = random.Random(8)
    ttft = [rng.lognormvariate(math.log(0.6), 0.35) + (rng.uniform(4, 9) if rng.random() < 0.05 else 0.0)
            for _ in range(5000)]
    summary = latency_summary(ttft)
    assert summary["mean"] < 1.1 and summary["p50"] < 0.7
    assert summary["p95"] > 4 and summary["p99"] > 7


@given(st.lists(st.floats(0, 100, allow_nan=False), min_size=2, max_size=200), st.integers(1, 99))
def test_a_percentile_lies_between_its_neighbouring_order_statistics(values, q):
    ordered, position = sorted(values), (len(values) - 1) * q / 100
    assert ordered[math.floor(position)] - 1e-9 <= percentile(values, q) <= ordered[math.ceil(position)] + 1e-9


@given(st.lists(st.floats(0, 100, allow_nan=False), min_size=2, max_size=200), st.integers(1, 98))
def test_percentiles_never_decrease(values, q):
    assert percentile(values, q) <= percentile(values, q + 1) + 1e-9


def test_objectives_are_met_by_the_mean_and_missed_by_the_tail():
    values = [0.5] * 94 + [3.0] * 6
    report = check_objectives(values, {"p50": 1.0, "p95": 2.0})
    assert sum(values) / len(values) < 1.0
    assert report == {"p50": (0.5, True), "p95": (3.0, False)}


def test_time_to_first_token_counts_the_first_text_and_not_empty_chunks():
    clock = FakeClock()

    def stream():
        for delay, chunk in [(0.2, ""), (0.3, ""), (0.7, "Your refund"), (0.4, " was sent today.")]:
            clock.now += delay
            yield chunk  # the first two are a role announcement and a keep-alive

    text, timing = time_stream(stream(), clock)
    assert text == "Your refund was sent today."
    assert timing.time_to_first_token == pytest.approx(1.2)
    assert (timing.total, timing.generation_time, timing.chunks) == pytest.approx((1.6, 0.4, 2))


def test_a_stream_without_text_is_an_error():
    with pytest.raises(ValueError, match="without any text"):
        time_stream(iter(["", ""]), FakeClock())


def test_littles_law_predicts_the_concurrency_of_the_simulation():
    result = simulate([(30, 600)], ProviderLimits(requests_per_minute=1500, max_concurrency=200), ClientPolicy(), seed=1)
    assert result.rate_limited == 0 and result.success_rate == 1.0
    assert result.mean_in_service == pytest.approx(in_flight(600 / 60, MEAN_SERVICE_S), rel=0.03)


@pytest.mark.parametrize("strategy", ["immediate", "retry_after", "backoff"])
def test_a_concurrency_limit_below_littles_law_caps_throughput_whatever_the_client_does(strategy):
    capacity = max_throughput_per_minute(64, MEAN_SERVICE_S)  # about 670 per minute
    result = simulate([(30, 900)], ProviderLimits(1500, 64), ClientPolicy(strategy=strategy), seed=1)
    assert result.success_rate == pytest.approx(capacity / 900, abs=0.02)


def test_backoff_with_jitter_rides_out_a_spike_and_pays_with_latency():
    limits = ProviderLimits(1500, 120)
    calm = simulate([(5, 600), (0.5, 600), (5, 600)], limits, ClientPolicy(), seed=3)
    spike = {strategy: simulate([(5, 600), (0.5, 2400), (5, 600)], limits, ClientPolicy(strategy=strategy), seed=3)
             for strategy in ("immediate", "retry_after", "backoff")}
    assert calm.success_rate == 1.0
    assert spike["backoff"].success_rate > max(spike["immediate"].success_rate, spike["retry_after"].success_rate) + 0.03
    assert spike["backoff"].p95 > 1.5 * calm.p95


@given(st.sampled_from(["retry_after", "backoff"]), st.integers(1, 10), st.integers(1, 30), st.integers(0, 10_000))
def test_clients_never_retry_before_retry_after(strategy, attempt, retry_after, seed):
    assert ClientPolicy(strategy=strategy).wait(random.Random(seed), attempt, retry_after) >= retry_after


def test_the_report_runs_every_scenario(capsys):
    assert main(["load_simulation.py"]) == 0
    printed = capsys.readouterr().out
    assert all(name in printed for name, *_ in SCENARIOS)
