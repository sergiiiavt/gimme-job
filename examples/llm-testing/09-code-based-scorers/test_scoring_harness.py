import json
import time
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from harness import Run, compare, load_cases, load_outputs, main, pass_rates, run, scorer_version
from scorers import citations, language, links, parse_answer, personal_data, score_answer

HERE = Path(__file__).parent
DATA = HERE / "data"
CASES = load_cases()
CASE = {case["id"]: case for case in CASES}
V1 = load_outputs(DATA / "outputs_v1.jsonl")
V2 = load_outputs(DATA / "outputs_v2.jsonl")


def answer(text: str, cited=("policy-returns",)) -> dict:
    return {"answer": text, "citations": list(cited)}


# ---------------------------------------------------------------- the answer contract

@pytest.mark.parametrize("raw, problem", [
    ('{"answer": "Returns: 30 days from delivery.", "citations": ["policy-returns"]}', None),
    ("Answer: 30 days", "not JSON"),
    ('["30 days"]', "expected a JSON object"),
    ('{"answer": "30 days"}', "expected the fields answer and citations"),
    ('{"answer": "30 days", "citations": [], "confidence": 0.9}', "expected the fields answer and citations"),
    ('{"answer": "  ", "citations": []}', "non-empty string"),
    ('{"answer": "30 days", "citations": "policy-returns"}', "list of strings"),
    ('{"answer": "30 days", "citations": [7]}', "list of strings"),
    ("[" * 100_000, "RecursionError"),
], ids=["valid", "prose", "array", "missing-field", "extra-field", "blank-answer", "citations-string",
        "citations-number", "deeply-nested"])
def test_answer_contract(raw, problem):
    data, score = parse_answer(raw)
    if problem is None:
        assert score.passed and data is not None
    else:
        assert not score.passed and data is None and problem in score.reason


def test_a_broken_output_is_one_failure_not_seven():
    scores = score_answer(CASE["c01"], "Answer: 30 days")
    assert [score.scorer for score in scores] == ["contract"]


# ---------------------------------------------------------------- reference-free scorers, adversarial examples

@pytest.mark.parametrize("case_id, text, passes", [
    ("c09", "Повернення протягом 30 днів від доставки: https://shop.example/returns", True),
    ("c09", "Возврат возможен в течение 30 дней, если товар не был в употреблении.", False),
    ("c09", "Returns are accepted within 30 days of delivery.", False),
    ("c01", "Returns are accepted within 30 days of delivery.", True),
    ("c01", "Повернення протягом 30 днів від доставки.", False),
    ("c01", "30 / 40", False),
])
def test_language(case_id, text, passes):
    assert language(CASE[case_id], answer(text)).passed is passes


def test_known_limit_a_short_russian_sentence_passes_as_ukrainian():
    """Pinned on purpose: without ы, э, ъ or ё the letter heuristic cannot tell the languages apart."""
    assert language(CASE["c09"], answer("Да, можно вернуть.")).passed


@pytest.mark.parametrize("cited, passes", [
    (["policy-returns"], True),
    ([], False),
    (["policy-returns", "policy-promotions"], False),
])
def test_citations_must_point_to_retrieved_documents(cited, passes):
    assert citations(CASE["c01"], answer("Returns: 30 days from delivery.", cited)).passed is passes


@pytest.mark.parametrize("text, passes", [
    ("Start at https://shop.example/returns.", True),
    ("Start at https://shop-example.com/returns.", False),
    ("Start at https://shop.example.evil.test/returns.", False),
    ("Start at " + "https://shop.example/returns.".replace("https", "http"), False),  # the same link without TLS
    ("Start at https://[shop.example/returns", False),  # not a valid URL: rejected, not a crash
])
def test_links_must_stay_on_the_allow_list(text, passes):
    assert links(CASE["c08"], answer(text)).passed is passes


@pytest.mark.parametrize("text, passes", [
    ("Write to support@shop.example about order A-1042.", True),
    ("Olena (olena.k@example.com) had the same question.", False),
    ("The card 4111 1111 1111 1111 was charged.", False),
    ("Order number 1234 5678 9012 3456 is not a card number.", True),  # fails the Luhn check
    ("Call the customer at +380 67 123 45 67.", False),
])
def test_personal_data(text, passes):
    assert personal_data(CASE["c01"], answer(text)).passed is passes


# ---------------------------------------------------------------- robustness

@settings(max_examples=200)
@given(st.text(max_size=300))
def test_any_raw_output_gets_a_verdict_and_never_crashes(raw):
    scores = score_answer(CASE["c01"], raw)
    assert scores and all(isinstance(score.passed, bool) for score in scores)


@settings(max_examples=200)
@given(st.text(max_size=300), st.lists(st.text(max_size=20), max_size=3))
def test_content_scorers_never_crash_on_any_answer_text(text, cited):
    raw = json.dumps({"answer": text, "citations": cited})
    for case in (CASE["c03"], CASE["c10"]):
        assert all(isinstance(score.passed, bool) for score in score_answer(case, raw))


@pytest.mark.parametrize("text", ["a" * 200_000 + "@", "1" * 200_000, "word " * 40_000],
                         ids=["letters-then-at-sign", "digits", "repeated-word"])
def test_scoring_time_stays_linear_on_runaway_outputs(text):
    raw = json.dumps({"answer": text, "citations": ["policy-returns"]})
    start = time.perf_counter()
    score_answer(CASE["c01"], raw)
    assert time.perf_counter() - start < 5, "a quadratic regular expression would take minutes here"


# ---------------------------------------------------------------- the harness

def test_pass_rates_by_slice():
    baseline, candidate = pass_rates(run(CASES, V1)), pass_rates(run(CASES, V2))
    assert (baseline["all"], candidate["all"]) == ((9, 12), (10, 12))
    assert (baseline["lang=uk"], candidate["lang=uk"]) == ((4, 4), (2, 4))
    assert (baseline["lang=en"], candidate["lang=en"]) == ((5, 8), (8, 8))


def test_the_average_improves_while_the_ukrainian_slice_regresses():
    comparison = compare(run(CASES, V1), run(CASES, V2))
    before, after = comparison.rates["all"]
    assert after > before
    assert comparison.rates["lang=uk"] == (1.0, 0.5)
    assert comparison.regressions == ["c10", "c11"]
    assert comparison.fixes == ["c02", "c05", "c06"]


def test_every_failure_names_the_case_the_scorer_and_the_reason():
    failures = [(result.case_id, score.scorer, score.reason)
                for result in run(CASES, V2).results for score in result.scores if not score.passed]
    assert [(case_id, scorer) for case_id, scorer, _ in failures] == [("c10", "language"), ("c10", "facts"), ("c11", "facts")]
    assert failures[0][2] == "expected Ukrainian, found the Russian letters ['ы']"
    assert failures[2][2] == "forbidden: guarantees a delivery date"


def test_a_missing_output_is_a_failure_not_a_skip():
    result_run = run(CASES, {})
    assert pass_rates(result_run)["all"] == (0, 12)
    assert result_run.results[0].scores[0].reason == "no output recorded"


def test_runs_scored_by_different_scorer_versions_are_never_compared():
    old = run(CASES, V1, version="000000000000")
    with pytest.raises(ValueError, match="re-score the baseline"):
        compare(old, run(CASES, V2))


def test_scorer_version_ignores_line_endings_but_not_code(tmp_path):
    lf, crlf, changed = tmp_path / "lf.py", tmp_path / "crlf.py", tmp_path / "changed.py"
    lf.write_bytes(b"MAX_WORDS = 80\n")
    crlf.write_bytes(b"MAX_WORDS = 80\r\n")
    changed.write_bytes(b"MAX_WORDS = 120\n")
    assert scorer_version([lf]) == scorer_version([crlf]) != scorer_version([changed])


def test_a_saved_run_loads_back_unchanged(tmp_path):
    result_run = run(CASES, V2)
    path = tmp_path / "results.json"
    path.write_text(json.dumps(result_run.to_json()), encoding="utf-8")
    assert Run.from_json(json.loads(path.read_text(encoding="utf-8"))) == result_run


def test_command_line_report_and_comparison(capsys, tmp_path):
    saved = tmp_path / "results.json"
    argv = ["harness.py", str(DATA / "outputs_v2.jsonl"), "--baseline", str(DATA / "outputs_v1.jsonl"), "--save", str(saved)]
    assert main(argv) == 0
    out = capsys.readouterr().out
    assert "lang=uk               2/4   50%" in out
    assert "FAIL c11 facts: forbidden: guarantees a delivery date" in out
    assert "lang=uk                100%        50%  -50 pp" in out
    assert "regressions: c10, c11" in out and "fixed: c02, c05, c06" in out
    assert json.loads(saved.read_text(encoding="utf-8"))["scorer_version"] == scorer_version()
