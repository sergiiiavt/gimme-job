import json
from datetime import date
from pathlib import Path

from governance_evidence import Result, blocking, check, load, main, report
from make_benchmark_data import latest_results, risk_register

DATA = Path(__file__).parent / "data"
RISKS, RESULTS = load(DATA / "risk_register.json", DATA / "test_results.json")
RELEASE, TODAY = "2.4.0", date(2026, 10, 10)


def test_the_data_files_are_reproducible():
    assert json.loads((DATA / "risk_register.json").read_text(encoding="utf-8")) == risk_register()
    assert json.loads((DATA / "test_results.json").read_text(encoding="utf-8")) == latest_results()


def test_the_example_of_the_chapter():
    statuses, unlinked = check(RISKS, RESULTS, RELEASE, TODAY)
    problems = {status.risk["id"]: status.problems for status in statuses}
    assert problems == {
        "R1": [], "R2": ["red-team-leaks fails"], "R3": ["no test covers it"],
        "R4": ["load-test tested 2.1.0", "load-test is 130 days old"], "R5": []}
    assert unlinked == ["tone-check"]
    assert blocking(statuses) == ["R2", "R3"]


def test_fixing_the_high_risks_unblocks_the_release():
    risks = [dict(risk) for risk in RISKS]
    risks[2]["tests"] = ["cv-counterfactual-pairs"]
    results = RESULTS | {"red-team-leaks": Result("pass", RELEASE, TODAY),
                         "cv-counterfactual-pairs": Result("pass", RELEASE, TODAY)}
    statuses, _ = check(risks, results, RELEASE, TODAY)
    assert blocking(statuses) == []  # the stale load test is a medium risk: reported, not blocking


def test_evidence_ages_out_after_the_limit():
    risks = [{"id": "R", "severity": "high", "risk": "x", "tests": ["t"]}]
    on_limit = check(risks, {"t": Result("pass", RELEASE, date(2026, 7, 12))}, RELEASE, TODAY)[0]
    past_limit = check(risks, {"t": Result("pass", RELEASE, date(2026, 7, 11))}, RELEASE, TODAY)[0]
    assert on_limit[0].problems == [] and past_limit[0].problems == ["t is 91 days old"]


def test_a_test_that_never_ran_is_a_gap():
    statuses, _ = check([{"id": "R", "severity": "high", "risk": "x", "tests": ["new-suite"]}], {}, RELEASE, TODAY)
    assert statuses[0].problems == ["new-suite never ran"] and blocking(statuses) == ["R"]


def test_the_report_records_the_decision_and_every_risk():
    statuses, unlinked = check(RISKS, RESULTS, RELEASE, TODAY)
    text = report(statuses, unlinked, RELEASE, TODAY)
    assert "**Decision:** no-go, high risks without current evidence: R2, R3" in text
    assert "| R3 | high | CV scores differ by gender or origin | - | no test covers it |" in text
    assert "Tests that cover no risk: tone-check" in text


def test_the_command_line_blocks_and_writes_the_report(tmp_path, capsys):
    target = tmp_path / "evidence.md"
    code = main(["governance_evidence.py", str(DATA / "risk_register.json"), str(DATA / "test_results.json"),
                 "--release", RELEASE, "--date", "2026-10-10", "--report", str(target)])
    assert code == 1
    assert capsys.readouterr().out.splitlines()[-1] == "release 2.4.0: no-go, high risks without current evidence: R2, R3"
    assert target.read_text(encoding="utf-8").startswith("# Evidence report for release 2.4.0")
