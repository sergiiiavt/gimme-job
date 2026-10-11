import json
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from judge_validation import judge_quality, load, main
from simulated_judge import SimulatedJudge

HERE = Path(__file__).parent
DEV, TEST = load(HERE / "data" / "labels_dev.jsonl"), load(HERE / "data" / "labels_test.jsonl")


def verdicts(rows, key):
    return [row[key] for row in rows]


def test_chapter_numbers():
    v1 = judge_quality(verdicts(DEV, "human"), verdicts(DEV, "judge_v1"))
    v2_dev = judge_quality(verdicts(DEV, "human"), verdicts(DEV, "judge_v2"))
    v2_test = judge_quality(verdicts(TEST, "human"), verdicts(TEST, "judge_v2"))
    assert (round(v1.tnr, 2), round(v1.kappa, 2), v1.missed_failures) == (0.43, 0.55, 4)
    assert (round(v2_dev.tnr, 2), round(v2_dev.kappa, 2)) == (1.0, 0.92)
    assert (round(v2_test.tnr, 2), round(v2_test.kappa, 2), v2_test.missed_failures) == (0.83, 0.80, 1)


def test_the_development_score_is_optimistic():
    on_dev = judge_quality(verdicts(DEV, "human"), verdicts(DEV, "judge_v2"))
    on_test = judge_quality(verdicts(TEST, "human"), verdicts(TEST, "judge_v2"))
    assert on_test.kappa < on_dev.kappa


def test_accuracy_hides_a_judge_that_catches_nothing():
    human = ["P"] * 85 + ["F"] * 15
    always_pass = judge_quality(human, ["P"] * 100)
    assert always_pass.accuracy == 0.85 and always_pass.tnr == 0.0 and always_pass.kappa == 0.0


def test_few_labelled_failures_give_a_wide_interval_for_tnr():
    few = judge_quality(verdicts(TEST, "human"), verdicts(TEST, "judge_v2"))
    low, high = few.tnr_interval
    assert high - low > 0.4, "six failures cannot pin down the share of failures the judge catches"
    many = judge_quality(["P"] * 100 + ["F"] * 60, ["P"] * 100 + ["F"] * 50 + ["P"] * 10)
    assert many.tnr_interval[1] - many.tnr_interval[0] < 0.2


def test_validation_recovers_the_error_rates_of_a_simulated_judge():
    judge = SimulatedJudge(tpr=0.95, tnr=0.70)
    human = ["P"] * 3000 + ["F"] * 1000
    judged = [
        json.loads(judge.judge(f"case-{i}", "answer", truly_passes=label == "P"))["verdict"][0]
        for i, label in enumerate(human)
    ]
    quality = judge_quality(human, judged)
    assert quality.tpr == pytest.approx(0.95, abs=0.02) and quality.tnr == pytest.approx(0.70, abs=0.04)


def test_validation_needs_both_kinds_of_answers():
    with pytest.raises(ValueError):
        judge_quality(["P", "P"], ["P", "F"])


@given(st.lists(st.tuples(st.sampled_from("PF"), st.sampled_from("PF")), min_size=2, max_size=60))
def test_rates_and_intervals_stay_in_range(pairs):
    human, judge = [h for h, _ in pairs], [j for _, j in pairs]
    if "P" not in human or "F" not in human:
        return
    quality = judge_quality(human, judge)
    for value in (quality.tpr, quality.tnr, *quality.tpr_interval, *quality.tnr_interval):
        assert 0.0 <= value <= 1.0
    assert quality.tnr_interval[0] <= quality.tnr <= quality.tnr_interval[1]
    assert -1.0 <= quality.kappa <= 1.0


def test_command_line(capsys):
    assert main(["judge_validation.py", str(HERE / "data" / "labels_dev.jsonl"), str(HERE / "data" / "labels_test.jsonl")]) == 0
    assert "judge v2, test  TPR 0.97  TNR 0.83 (95% CI 0.44-0.97)" in capsys.readouterr().out
