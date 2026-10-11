import math
import random
from pathlib import Path

import pytest

from make_benchmark_data import preference_votes
from pairwise_ranking import (bootstrap_intervals, bradley_terry, elo, expected_wins, load_votes, main, ranks,
                              win_probability)

DATA = Path(__file__).parent / "data" / "preference_votes.jsonl"
VOTES = load_votes(DATA)


def simulated_votes(strength: dict[str, float], count: int, seed: int) -> list[tuple[str, str, float]]:
    rng = random.Random(seed)
    names, votes = list(strength), []
    for _ in range(count):
        a, b = rng.sample(names, 2)
        votes.append((a, b, 1.0 if rng.random() < win_probability(strength[a], strength[b]) else 0.0))
    return votes


def test_the_data_file_is_reproducible():
    assert load_votes(DATA) == [(row["a"], row["b"], {"a": 1.0, "b": 0.0, "tie": 0.5}[row["winner"]])
                                for row in preference_votes()]


def test_the_fitted_scores_reproduce_the_observed_wins():
    # at the maximum of the likelihood, every system is expected to win exactly as often as it did
    scores = bradley_terry(VOTES)
    observed: dict[str, float] = {name: 0.0 for name in scores}
    for a, b, score in VOTES:
        observed[a] += score
        observed[b] += 1 - score
    assert expected_wins(VOTES, scores) == pytest.approx(observed, abs=1e-6)


def test_bradley_terry_ignores_the_order_of_votes_and_elo_does_not():
    shuffled = VOTES[:]
    random.Random(3).shuffle(shuffled)
    assert bradley_terry(shuffled) == pytest.approx(bradley_terry(VOTES), abs=1e-6)
    forward, backward = elo(VOTES), elo(VOTES[::-1])
    assert max(abs(forward[name] - backward[name]) for name in forward) > 100


def test_many_votes_recover_the_true_strengths():
    truth = {"a": 1200.0, "b": 1100.0, "c": 1050.0, "d": 950.0}
    scores = bradley_terry(simulated_votes(truth, 6000, seed=4))
    assert sorted(scores, key=scores.get, reverse=True) == ["a", "b", "c", "d"]
    for name in truth:  # the scale is anchored at the mean, so compare differences to "d"
        assert scores[name] - scores["d"] == pytest.approx(truth[name] - truth["d"], abs=30)


def test_ties_pull_systems_together():
    only_ties = [("a", "b", 0.5)] * 10 + [("b", "c", 0.5)] * 10
    scores = bradley_terry(only_ties)
    assert scores["a"] == pytest.approx(scores["b"]) == pytest.approx(scores["c"])


def test_a_system_that_never_lost_has_no_finite_score():
    with pytest.raises(ValueError, match="won all or none"):
        bradley_terry([("a", "b", 1.0), ("a", "c", 1.0), ("b", "c", 1.0), ("c", "b", 1.0)])


def test_the_elo_scale_and_win_probabilities_agree():
    assert win_probability(1400, 1000) == pytest.approx(10 / 11)
    assert win_probability(1000, 1000) == 0.5
    worth_a, worth_b = 10 ** ((1173 - 1000) / 400), 10 ** ((1000 - 1000) / 400)
    assert win_probability(1173, 1000) == pytest.approx(worth_a / (worth_a + worth_b))


def test_intervals_contain_the_estimate_and_narrow_with_more_votes():
    truth = {"a": 1100.0, "b": 1000.0, "c": 950.0}
    few, many = simulated_votes(truth, 150, seed=5), simulated_votes(truth, 2400, seed=5)
    few_scores, few_intervals = bradley_terry(few), bootstrap_intervals(few, resamples=200, seed=1)
    many_intervals = bootstrap_intervals(many, resamples=200, seed=1)
    for name in truth:
        low, high = few_intervals[name]
        assert low <= few_scores[name] <= high
        assert many_intervals[name][1] - many_intervals[name][0] < 0.5 * (high - low)


def test_overlapping_intervals_share_a_rank():
    intervals = {"a": (1060, 1140), "b": (1020, 1090), "c": (1000, 1066), "d": (915, 990), "e": (820, 900)}
    assert ranks(intervals) == {"a": 1, "b": 1, "c": 1, "d": 4, "e": 5}


def test_the_command_line_shows_both_rankings(capsys):
    assert main(["pairwise_ranking.py", str(DATA), "--resamples", "50"]) == 0
    lines = capsys.readouterr().out.splitlines()
    assert lines[0] == "600 votes" and lines[2].split()[:2] == ["1", "assist-a"]
    assert math.isclose(float(lines[2].split()[2]), bradley_terry(VOTES)["assist-a"], abs_tol=1)
