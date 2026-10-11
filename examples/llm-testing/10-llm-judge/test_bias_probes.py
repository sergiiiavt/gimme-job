import json
from pathlib import Path

import pytest

from bias_probes import judge_both_orders, main, position_report, verbosity_flip_rate
from simulated_judge import SimulatedJudge

HERE = Path(__file__).parent
PAIRS = [json.loads(line) for line in (HERE / "data" / "pairwise.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
LABELS = [json.loads(line) for line in (HERE / "data" / "labels_dev.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]


def pairs_where_b_is_better(count: int) -> list[dict]:
    return [{"id": f"pair-{i}", "a": f"answer A {i}", "b": f"answer B {i}", "better": "B" if i % 3 else "A"} for i in range(count)]


def test_chapter_example():
    report = position_report([(row["a_first"], row["b_first"]) for row in PAIRS])
    assert (report.consistent, report.wins_b, report.wins_a, report.ties) == (30, 18, 12, 20)
    assert report.one_order_win_rate_b == 0.48 and report.win_rate_b == 0.56
    assert report.shown_first_won == 0.58


def test_an_unbiased_judge_is_consistent_in_both_orders():
    report = position_report(judge_both_orders(SimulatedJudge(), pairs_where_b_is_better(300)))
    assert report.consistent == report.pairs and report.shown_first_won == pytest.approx(0.5, abs=0.01)


def test_a_position_biased_judge_is_caught_by_swapping_the_order():
    report = position_report(judge_both_orders(SimulatedJudge(position_bias=0.4), pairs_where_b_is_better(300)))
    assert report.consistent / report.pairs < 0.75
    assert report.shown_first_won > 0.6


def test_counting_inconsistent_pairs_as_ties_moves_the_estimate_toward_the_truth():
    pairs = pairs_where_b_is_better(600)
    true_rate = sum(pair["better"] == "B" for pair in pairs) / len(pairs)
    report = position_report(judge_both_orders(SimulatedJudge(position_bias=0.4), pairs))
    assert abs(report.win_rate_b - true_rate) < abs(report.one_order_win_rate_b - true_rate)


def test_verbosity_probe_flags_a_judge_swayed_by_length():
    failing = [row for row in LABELS if row["human"] == "F"]
    assert verbosity_flip_rate(SimulatedJudge(), failing) == 0.0
    assert verbosity_flip_rate(SimulatedJudge(verbosity_bias=0.8), failing) > 0.4


def test_command_line(capsys):
    assert main(["bias_probes.py", str(HERE / "data" / "pairwise.jsonl")]) == 0
    assert "both orders: B wins 18, A wins 12, ties 20, B win rate 56%" in capsys.readouterr().out
