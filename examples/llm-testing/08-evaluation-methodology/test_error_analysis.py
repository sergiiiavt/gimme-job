import json
from pathlib import Path

from error_analysis import analyse, main, read_jsonl

HERE = Path(__file__).parent
ANNOTATIONS = HERE / "data" / "annotations.jsonl"
TAXONOMY_PATH = HERE / "data" / "taxonomy.json"
TAXONOMY = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))


def test_priority_is_frequency_times_severity_not_frequency_alone():
    result = analyse(read_jsonl(ANNOTATIONS), TAXONOMY)
    ranking = [stats.category for stats in result.categories]
    assert ranking[0] == "invented policy", "rarer than missing citations but more harmful"
    most_frequent = max(result.categories, key=lambda stats: stats.traces)
    assert most_frequent.category == "missing citation" and ranking.index("missing citation") == 1


def test_saturation_is_reported_as_the_tail_without_new_categories():
    result = analyse(read_jsonl(ANNOTATIONS), TAXONOMY)
    assert result.first_seen == [2, 3, 5, 8, 13]
    assert result.traces_since_new_category == 27


def test_every_note_must_be_coded_into_a_known_category():
    rows = [
        {"trace": "t1", "note": "Invents a 60-day window.", "category": "invented policy"},
        {"trace": "t2", "note": "Rude tone.", "category": None},
        {"trace": "t3", "note": "Slow answer.", "category": "latency"},
        {"trace": "t4", "note": "", "category": None},
    ]
    problems = analyse(rows, TAXONOMY).problems
    assert problems == ["t2: a note without a category, finish the axial coding",
                        "t3: unknown category 'latency', add it to the taxonomy or recode"]


def test_every_category_of_the_taxonomy_has_a_severity_and_a_description():
    for name, entry in TAXONOMY.items():
        assert entry["severity"] in (1, 2, 3) and entry["description"], name


def test_command_line(capsys):
    assert main(["error_analysis.py", str(ANNOTATIONS), str(TAXONOMY_PATH)]) == 0
    out = capsys.readouterr().out
    assert out.startswith("19 of 40 traces have a problem")
    assert "invented policy             5        3       15" in out
