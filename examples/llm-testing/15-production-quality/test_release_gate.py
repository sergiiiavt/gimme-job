import json
import math
from pathlib import Path
from statistics import fmean

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError

from make_production_data import release_suite
from release_gate import Gate, decision, evaluate, fingerprint, load_cases, load_gate, main, paired_difference

HERE = Path(__file__).parent
SUITE = HERE / "data" / "release_suite.jsonl"
GATE_FILE = HERE / "gate.json"
ROWS = load_cases(SUITE)
GATE = load_gate(GATE_FILE)


def failed_checks(rows: list[dict], candidate: str, gate: Gate = GATE) -> list[str]:
    return [result.check.name for result in evaluate(rows, gate, "current", candidate) if not result.passed]


def changed(rows: list[dict], version: str, case_ids: set[str], change) -> list[dict]:
    """A copy of the rows in which `change` edits the results of `version` for the given cases."""
    copy = json.loads(json.dumps(rows))
    for row in copy:
        if row["id"] in case_ids:
            change(row["results"][version])
    return copy


def test_the_data_file_is_reproducible():
    assert release_suite() == ROWS


def test_the_cheaper_model_is_blocked_only_by_the_ukrainian_slice():
    results = {result.check.name: result for result in evaluate(ROWS, GATE, "current", "cheaper")}
    assert decision(list(results.values())) == "block"
    assert failed_checks(ROWS, "cheaper") == ["slice: Ukrainian pass rate"]
    cost = results["cost: per resolved conversation"]
    assert cost.candidate < cost.baseline / 3
    assert results["latency: p95 end-to-end"].candidate < results["latency: p95 end-to-end"].baseline


def test_the_tuned_candidate_ships():
    assert failed_checks(ROWS, "cheaper_tuned") == []


def test_the_baseline_passes_its_own_gate():
    # limits that the version in production fails would block every candidate
    assert failed_checks(ROWS, "current") == []


def test_one_failed_zero_tolerance_case_blocks_a_candidate_that_passes_everything_else():
    first = next(row["id"] for row in ROWS if row["zero_tolerance"])
    rows = changed(ROWS, "cheaper_tuned", {first}, lambda result: result.update(passed=False))
    assert failed_checks(rows, "cheaper_tuned") == ["zero-tolerance cases failed"]


def test_latency_is_gated_on_a_percentile_because_the_mean_hides_the_tail():
    slow_tool = {row["id"] for row in ROWS[::12]}  # one case in twelve waits 9 more seconds
    rows = changed(ROWS, "cheaper_tuned", slow_tool, lambda result: result.update(latency_s=result["latency_s"] + 9))
    assert failed_checks(rows, "cheaper_tuned") == ["latency: p95 end-to-end"]
    # a gate on the mean would let it through: it is still faster than the version in production
    assert fmean(row["results"]["cheaper_tuned"]["latency_s"] for row in rows) < fmean(
        row["results"]["current"]["latency_s"] for row in rows)


def test_cost_is_per_resolved_conversation_not_per_call():
    gate = Gate.model_validate({"decided": "test", "checks": [
        {"name": "cost", "kind": "cost", "metric": "cost_per_resolved", "max": 0.025}]})
    rows = [{"id": f"x{number}", "language": "en", "intent": "refund", "zero_tolerance": False, "results": {
        "current": {"passed": number % 10 < 9, "latency_s": 3.0, "ttft_s": 0.5, "cost_eur": 0.020},
        "budget": {"passed": number % 10 < 3, "latency_s": 2.0, "ttft_s": 0.4, "cost_eur": 0.008}}}
        for number in range(100)]
    [current] = evaluate(rows, gate, "current", "current")
    [budget] = evaluate(rows, gate, "current", "budget")
    # 0.008 per call is a third of what the current model costs, but it resolves only 30% of the conversations
    assert current.candidate == pytest.approx(0.020 / 0.9) and current.passed
    assert budget.candidate == pytest.approx(0.008 / 0.3) and not budget.passed


@pytest.mark.parametrize("check", [
    {"name": "typo", "kind": "latency", "metric": "latency_p95", "mx": 8.0},
    {"name": "no limit", "kind": "latency", "metric": "latency_p95"},
    {"name": "two limits", "kind": "latency", "metric": "latency_p95", "min": 1.0, "max": 8.0},
    {"name": "unknown metric", "kind": "latency", "metric": "latency_p99", "max": 8.0},
], ids=["misspelled field", "no limit", "two limits", "unknown metric"])
def test_a_broken_limit_is_an_error_and_not_a_check_that_always_passes(check):
    with pytest.raises(ValidationError):
        Gate.model_validate({"decided": "test", "checks": [check]})


def test_a_slice_without_cases_is_an_error():
    gate = Gate.model_validate({"decided": "test", "checks": [
        {"name": "German", "kind": "slice", "metric": "pass_rate", "where": {"language": "de"}, "min": 0.9}]})
    with pytest.raises(ValueError, match="no case matches"):
        evaluate(ROWS, gate, "current", "cheaper")


def test_paired_difference_by_hand():
    # 6 cases both pass, 1 only the baseline passes, 3 only the candidate passes
    pairs = [(True, True)] * 6 + [(True, False)] + [(False, True)] * 3
    rows = [{"results": {"a": {"passed": a}, "b": {"passed": b}}} for a, b in pairs]
    diff, low, high = paired_difference(rows, "a", "b")
    se = math.sqrt(1 + 3 - (3 - 1) ** 2 / 10) / 10
    assert diff == pytest.approx(0.2)
    assert (low, high) == pytest.approx((0.2 - 1.959964 * se, 0.2 + 1.959964 * se))


@given(st.lists(st.tuples(st.booleans(), st.booleans()), min_size=1, max_size=300))
def test_the_paired_interval_contains_the_estimate_and_mirrors_when_swapped(pairs):
    rows = [{"results": {"a": {"passed": a}, "b": {"passed": b}}} for a, b in pairs]
    diff, low, high = paired_difference(rows, "a", "b")
    back, back_low, back_high = paired_difference(rows, "b", "a")
    assert low <= diff <= high
    assert (back, back_low, back_high) == pytest.approx((-diff, -high, -low), abs=1e-12)


def test_the_command_line_exit_status_and_ci_summary(tmp_path, capsys):
    summary = tmp_path / "summary.md"
    assert main(["release_gate.py", str(SUITE), str(GATE_FILE), "--candidate", "cheaper", "--summary", str(summary)]) == 1
    assert main(["release_gate.py", str(SUITE), str(GATE_FILE), "--candidate", "cheaper_tuned",
                 "--summary", str(summary)]) == 0
    text = summary.read_text(encoding="utf-8")
    assert "## Release gate: BLOCK" in text and "## Release gate: SHIP" in text
    assert "| slice: Ukrainian pass rate | 300 | 92.0% | 84.0% | at least 88.0% | **fail** |" in text
    printed = capsys.readouterr().out
    assert fingerprint(SUITE) in printed and fingerprint(GATE_FILE) in printed


def test_the_fingerprint_ignores_line_endings_but_not_content(tmp_path):
    unix, windows, edited = tmp_path / "unix.jsonl", tmp_path / "windows.jsonl", tmp_path / "edited.jsonl"
    unix.write_bytes(b'{"x": 1}\n{"y": 2}\n')
    windows.write_bytes(b'{"x": 1}\r\n{"y": 2}\r\n')
    edited.write_bytes(b'{"x": 1}\n{"y": 3}\n')
    assert fingerprint(unix) == fingerprint(windows) != fingerprint(edited)
