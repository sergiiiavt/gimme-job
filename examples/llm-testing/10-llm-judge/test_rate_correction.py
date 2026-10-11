import json
from pathlib import Path

import pytest

from rate_correction import corrected_pass_rate, main, rogan_gladen
from simulated_judge import SimulatedJudge

HERE = Path(__file__).parent


def test_chapter_example():
    labelled = [("P", "P")] * 57 + [("P", "F")] * 3 + [("F", "F")] * 12 + [("F", "P")] * 8
    verdicts = ["P"] * 812 + ["F"] * 188
    point, low, high = corrected_pass_rate(labelled, verdicts, resamples=2000, seed=1)
    assert round(point, 3) == 0.749
    assert low < point < high


def test_a_perfect_judge_needs_no_correction():
    assert rogan_gladen(0.81, tpr=1.0, tnr=1.0) == pytest.approx(0.81)


def test_estimates_are_clipped_to_valid_rates():
    assert rogan_gladen(0.99, tpr=0.9, tnr=0.9) == 1.0
    assert rogan_gladen(0.02, tpr=0.9, tnr=0.9) == 0.0


def test_a_judge_no_better_than_chance_cannot_be_corrected():
    with pytest.raises(ValueError, match="no better than chance"):
        rogan_gladen(0.8, tpr=0.5, tnr=0.5)


def test_correction_recovers_the_true_rate_that_the_judge_distorts():
    """Simulate a lenient judge on answers with a known true pass rate of 70%."""
    judge = SimulatedJudge(tpr=0.95, tnr=0.55, seed="correction")
    truth = [i % 10 < 7 for i in range(20_000)]
    labelled_truth = [i % 10 < 7 for i in range(2_000)]

    def verdict(case_id, passes):
        return json.loads(judge.judge(case_id, "answer", passes))["verdict"][0]

    labelled = [("P" if passes else "F", verdict(f"label-{i}", passes)) for i, passes in enumerate(labelled_truth)]
    verdicts = [verdict(f"prod-{i}", passes) for i, passes in enumerate(truth)]
    observed = verdicts.count("P") / len(verdicts)
    point, low, high = corrected_pass_rate(labelled, verdicts, resamples=300, seed=2)
    assert observed == pytest.approx(0.70 * 0.95 + 0.30 * 0.45, abs=0.01), "the raw judge overstates the rate"
    assert point == pytest.approx(0.70, abs=0.02) and low <= 0.70 <= high


def test_the_interval_narrows_with_more_labelled_failures():
    verdicts = ["P"] * 812 + ["F"] * 188
    few = [("P", "P")] * 57 + [("P", "F")] * 3 + [("F", "F")] * 12 + [("F", "P")] * 8
    many = [("P", "P")] * 57 + [("P", "F")] * 3 + [("F", "F")] * 120 + [("F", "P")] * 80
    _, few_low, few_high = corrected_pass_rate(few, verdicts, resamples=600, seed=3)
    _, many_low, many_high = corrected_pass_rate(many, verdicts, resamples=600, seed=3)
    assert many_high - many_low < (few_high - few_low) / 1.5


def test_command_line(capsys):
    assert main(["rate_correction.py", str(HERE / "data" / "labels_test.jsonl"), str(HERE / "data" / "production_verdicts.jsonl")]) == 0
    out = capsys.readouterr().out
    assert "judge verdicts: 812/1000 pass (81.2%)" in out
    assert "corrected pass rate 80.3%" in out
