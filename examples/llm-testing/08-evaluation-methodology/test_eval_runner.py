import json
from pathlib import Path

import pytest

from eval_runner import FakeSupportModel, Run, main, run, scorecard

HERE = Path(__file__).parent
GOLDEN = HERE / "data" / "golden.jsonl"
CASES = [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_an_unchanged_average_hides_fixes_and_regressions():
    system = FakeSupportModel()
    card = scorecard(run(CASES, system, "v2"), run(CASES, system, "v3"))
    assert card.baseline_rate == card.candidate_rate
    assert card.fixed == ["g07", "g08", "g09"]
    assert card.broken == ["g10", "g11", "g12"]
    assert card.slices["lang=uk"] == (7, 4, 9) and card.slices["lang=en"] == (6, 9, 9)


def test_the_cache_makes_a_repeated_run_free_and_identical(tmp_path):
    system = FakeSupportModel()
    first = run(CASES, system, "v2", cache_dir=tmp_path)
    calls_after_first_run = system.calls
    second = run(CASES, system, "v2", cache_dir=tmp_path)
    assert system.calls == calls_after_first_run, "every output came from the cache"
    assert second.manifest["cache_hits"] == len(CASES)
    assert second.results == first.results


def test_the_cache_key_includes_the_prompt_version(tmp_path):
    system = FakeSupportModel()
    run(CASES, system, "v2", cache_dir=tmp_path)
    run(CASES, system, "v3", cache_dir=tmp_path)
    assert system.calls == 2 * len(CASES), "a new prompt version must not reuse old outputs"


def test_the_manifest_records_what_was_measured_and_how():
    manifest = run(CASES, FakeSupportModel(), "v3").manifest
    assert set(manifest) == {"dataset_version", "cases", "model_id", "prompt_version", "scorer_version", "cache_hits"}
    changed = [dict(case) for case in CASES]
    changed[0]["expected_facts"] = ["thirty days"]
    assert run(changed, FakeSupportModel(), "v3").manifest["dataset_version"] != manifest["dataset_version"]


def test_runs_on_different_datasets_cannot_be_compared():
    system = FakeSupportModel()
    with pytest.raises(ValueError, match="dataset_version"):
        scorecard(run(CASES, system, "v2"), run(CASES[:5], system, "v3"))


def test_stored_outputs_can_be_rescored_without_calling_the_model():
    original = run(CASES, FakeSupportModel(), "v3")
    rescored = Run(manifest=dict(original.manifest))
    for case in CASES:
        stored = original.results[case["id"]]
        rescored.results[case["id"]] = {**stored, "passed": "3-5" in stored["output"]}
    assert sum(result["passed"] for result in rescored.results.values()) == 6


def test_command_line(capsys, tmp_path):
    assert main(["eval_runner.py", str(GOLDEN), "--cache", str(tmp_path)]) == 0
    out = capsys.readouterr().out
    assert "pass rate: v2 72%, v3 72%" in out
    assert "lang=uk            7/9 -> 4/9" in out
