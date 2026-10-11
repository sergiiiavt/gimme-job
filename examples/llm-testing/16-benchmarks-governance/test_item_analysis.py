import json
from pathlib import Path

import pytest
from hypothesis import assume, given
from hypothesis import strategies as st

from item_analysis import analyse, interval_half_width, main
from make_benchmark_data import model_results

DATA = Path(__file__).parent / "data" / "model_results.jsonl"
ROWS = [json.loads(line) for line in DATA.read_text(encoding="utf-8").splitlines() if line.strip()]
ITEMS = {item.number: item for item in analyse([row["results"] for row in ROWS])}


def test_the_data_file_is_reproducible():
    assert model_results() == ROWS


def test_the_planted_items_are_found():
    assert {n: ITEMS[n].verdict for n in (7, 23, 41)} == {
        7: "everyone solves it: no information", 23: "everyone solves it: no information",
        41: "nobody solves it: too hard or broken"}
    suspicious = sorted(n for n, item in ITEMS.items() if item.verdict.startswith("stronger models fail"))
    assert suspicious == [15, 52]  # the items with a wrong reference answer, and only those


def test_a_good_item_is_solved_more_often_by_stronger_systems():
    good = [item for item in ITEMS.values() if item.verdict == "ok"]
    assert len(good) >= 45
    assert all(item.discrimination >= 0.2 for item in good)


MATRICES = st.integers(4, 12).flatmap(lambda models: st.lists(
    st.lists(st.integers(0, 1), min_size=models, max_size=models), min_size=3, max_size=10)).map(
    lambda columns: [list(row) for row in zip(*columns)])


@given(MATRICES, st.data())
def test_reversing_an_items_key_reverses_its_discrimination(matrix, data):
    column = data.draw(st.integers(0, len(matrix[0]) - 1))
    flipped = [row[:column] + [1 - row[column]] + row[column + 1:] for row in matrix]
    before, after = analyse(matrix)[column], analyse(flipped)[column]
    assume(before.discrimination is not None)
    assert after.discrimination == pytest.approx(-before.discrimination)
    assert after.difficulty == pytest.approx(1 - before.difficulty)


@given(MATRICES)
def test_difficulty_and_discrimination_stay_in_range(matrix):
    for item in analyse(matrix):
        assert 0 <= item.difficulty <= 1
        assert item.discrimination is None or -1 - 1e-9 <= item.discrimination <= 1 + 1e-9


def test_benchmark_noise_from_the_chapter():
    assert interval_half_width(198, 0.5) == pytest.approx(0.0696, abs=0.0001)
    assert interval_half_width(14_000, 0.85) == pytest.approx(0.0059, abs=0.0001)


def test_results_of_different_length_are_an_error():
    with pytest.raises(ValueError):
        analyse([[1, 0, 1], [1, 0]])


def test_the_command_line_lists_the_items_that_need_attention(capsys):
    assert main(["item_analysis.py", str(DATA)]) == 0
    printed = capsys.readouterr().out
    assert "15        50%          -0.73  stronger models fail more often" in printed
    assert "need attention" in printed
