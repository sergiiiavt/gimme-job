import json
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from make_benchmark_data import candidates
from model_selection import Candidate, choose, dominates, load, main, paired_difference, pareto_front

DATA = Path(__file__).parent / "data" / "candidates.json"
REQUIREMENTS, CANDIDATES = load(DATA)


def candidate(name: str, quality: float, cost: float, latency: float, cases: int = 100) -> Candidate:
    passed = tuple(index < round(quality * cases) for index in range(cases))
    return Candidate(name, passed, cost, latency, 128_000)


def test_the_data_file_is_reproducible():
    assert json.loads(DATA.read_text(encoding="utf-8")) == candidates()


def test_the_cheaper_model_within_the_margin_is_chosen():
    chosen, notes = choose(CANDIDATES, **REQUIREMENTS)
    assert chosen.name == "medium-b"
    assert notes == ["long-e: fails a hard requirement", "tiny-f: fails a hard requirement", "medium-c: dominated",
                     "medium-b: on the Pareto front, within 3 points of large-a",
                     "small-d: on the Pareto front, but may be more than 3 points worse than large-a"]


def test_a_tighter_margin_changes_the_decision():
    chosen, _ = choose(CANDIDATES, **(REQUIREMENTS | {"quality_margin": 0.005}))
    assert chosen.name == "large-a"


def test_nothing_meets_impossible_requirements():
    chosen, notes = choose(CANDIDATES, **(REQUIREMENTS | {"min_quality": 0.99}))
    assert chosen is None and len(notes) == len(CANDIDATES)


def test_dominance_by_hand():
    good, worse, other = candidate("good", 0.9, 0.01, 3.0), candidate("worse", 0.85, 0.02, 3.0), candidate("other", 0.95, 0.05, 3.0)
    assert dominates(good, worse) and not dominates(worse, good)
    assert not dominates(good, other) and not dominates(other, good)  # a real trade-off
    assert not dominates(good, good)


def test_the_paired_difference_mirrors_when_swapped():
    a, b = CANDIDATES[0], CANDIDATES[1]
    diff, low, high = paired_difference(a, b)
    assert paired_difference(b, a) == pytest.approx((-diff, -high, -low))


SPECS = st.lists(st.tuples(st.integers(50, 100), st.integers(1, 10), st.integers(1, 10)), min_size=1, max_size=8)


@given(SPECS)
def test_the_pareto_front_is_exactly_the_set_of_undominated_candidates(specs):
    pool = [candidate(f"m{index}", quality / 100, cost / 100, latency) for index, (quality, cost, latency) in enumerate(specs)]
    front = pareto_front(pool)
    assert front
    assert not any(dominates(a, b) for a in front for b in front)
    assert all(any(dominates(member, c) for member in front) for c in pool if c not in front)


def test_the_command_line_reports_the_choice(capsys):
    assert main(["model_selection.py", str(DATA)]) == 0
    assert capsys.readouterr().out.splitlines()[-1] == "choice: medium-b"
