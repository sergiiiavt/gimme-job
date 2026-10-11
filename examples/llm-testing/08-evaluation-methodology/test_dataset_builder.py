import json
import random
from collections import Counter
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from dataset_builder import build, main, remove_duplicates, scrub, split_of, stratified_sample

HERE = Path(__file__).parent
LOG_PATH = HERE / "data" / "production_log.jsonl"
LOG = [json.loads(line) for line in LOG_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]


@pytest.mark.parametrize("text, expected", [
    ("Refund A-1042 to olena.k@mail.example please", "Refund A-1042 to <email> please"),
    ("Call me at +380 67 123 45 67", "Call me at <phone>"),
    ("The card 4111 1111 1111 1111 was charged twice", "The card <card> was charged twice"),
    ("Order A-1042 arrived on 2026-10-01", "Order A-1042 arrived on 2026-10-01"),
])
def test_scrubbing_replaces_personal_data_and_keeps_order_numbers(text, expected):
    assert scrub(text) == expected


def test_no_personal_data_reaches_the_dataset():
    cases, _ = build(LOG, target=60, minimum=8)
    for case in cases:
        assert "@" not in case["input"] and "+380" not in case["input"], case["id"]


def test_exact_and_near_duplicates_are_removed():
    entries = [
        {"id": "1", "text": "Where is my parcel A-1042?"},
        {"id": "2", "text": "where is my parcel  A-1042"},          # same after normalization
        {"id": "3", "text": "Where is my parcel A-1042? Thanks!"},  # near duplicate
        {"id": "4", "text": "Where is my parcel A-5555?"},          # one word of six differs: similarity 0.71, kept
    ]
    kept, exact, near = remove_duplicates(entries)
    assert [entry["id"] for entry in kept] == ["1", "4"] and (exact, near) == (1, 1)


def test_rare_slices_get_their_minimum_and_common_ones_stay_proportional():
    population = [{"id": f"{intent}-{i}", "intent": intent}
                  for intent, size in [("returns", 600), ("delivery", 300), ("account", 20)] for i in range(size)]
    sample = stratified_sample(population, "intent", target=92, minimum=10, seed=1)
    counts = Counter(entry["intent"] for entry in sample)
    assert counts == {"returns": 60, "delivery": 30, "account": 10}


def test_a_slice_smaller_than_the_minimum_is_taken_whole():
    population = [{"id": "a", "intent": "account"}] + [{"id": str(i), "intent": "returns"} for i in range(50)]
    counts = Counter(entry["intent"] for entry in stratified_sample(population, "intent", 20, 5))
    assert counts["account"] == 1


@given(st.text(min_size=1, max_size=20), st.lists(st.text(min_size=1, max_size=20), max_size=30))
def test_split_depends_only_on_the_case_id(case_id, other_ids):
    """Adding cases or reordering the file never moves a case between dev and test."""
    before = split_of(case_id)
    shuffled = other_ids + [case_id]
    random.Random(0).shuffle(shuffled)
    assert {split_of(i) for i in shuffled if i == case_id} == {before}


def test_the_test_share_is_close_to_the_requested_share():
    shares = Counter(split_of(f"case-{i}") for i in range(5000))
    assert shares["test"] / 5000 == pytest.approx(0.3, abs=0.02)


def test_the_datasheet_describes_what_was_done(capsys):
    _, datasheet = build(LOG, target=60, minimum=8)
    assert datasheet["logged"] == len(LOG)
    assert datasheet["exact_duplicates_removed"] > 0 and datasheet["near_duplicates_removed"] > 0
    assert datasheet["by_intent"]["account"] == 8, "the rare slice gets its minimum"
    assert main(["dataset_builder.py", str(LOG_PATH)]) == 0
    assert "personal_data_replaced" in capsys.readouterr().out
