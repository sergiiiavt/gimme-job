from pathlib import Path

import pytest

from compare_versions import compare, decide, load, main

HERE = Path(__file__).parent
RESULTS = HERE / "data" / "results.jsonl"
ROWS = load(RESULTS)


def test_a_better_candidate_ships():
    result = compare(ROWS, "A", "B")
    assert result.decision.verdict == "ship"
    assert result.difference[1] > 0, "the whole interval is above zero"


def test_a_candidate_of_equal_quality_is_inconclusive_not_a_pass():
    result = compare(ROWS, "A", "C")
    _, low, high = result.difference
    assert low < -0.02 < 0 < high
    assert result.decision.verdict == "inconclusive"


def test_a_broken_zero_tolerance_case_blocks_despite_a_better_average():
    result = compare(ROWS, "A", "D")
    assert result.difference[1] > 0
    assert result.decision.verdict == "block" and result.hard_gate_failures == ["case-0451"]


def test_going_back_from_b_to_a_is_a_detected_regression():
    result = compare(ROWS, "B", "A")
    assert result.difference[2] < 0
    assert result.decision.verdict == "block" and "regression" in result.decision.reason


def test_slices_are_corrected_for_multiple_comparisons():
    slices = {item.name: item for item in compare(ROWS, "A", "B").slices}
    assert slices["feature=refunds"].p_value < 0.05 and not slices["feature=refunds"].significant
    assert slices["lang=en"].significant


@pytest.mark.parametrize("low, high, failures, verdict", [
    (0.010, 0.050, [], "ship"),
    (-0.015, 0.020, [], "ship"),
    (-0.030, 0.010, [], "inconclusive"),
    (-0.060, -0.010, [], "block"),
    (0.010, 0.050, ["case-0451"], "block"),
])
def test_decision_rule(low, high, failures, verdict):
    assert decide(low, high, margin=0.02, hard_gate_failures=failures).verdict == verdict


@pytest.mark.parametrize("candidate, status", [("B", 0), ("D", 1), ("C", 2)])
def test_command_line_exit_status(candidate, status, capsys):
    assert main(["compare_versions.py", str(RESULTS), "--candidate", candidate]) == status
    out = capsys.readouterr().out
    assert "A: 509/600 passed, 84.8% (95% CI 81.7% to 87.5%)" in out
    assert out.splitlines()[-1].startswith("decision: ")
