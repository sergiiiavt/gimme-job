"""Regenerate the synthetic evaluation results in data/ with fixed seeds.

The results imitate a support assistant evaluated on 600 cases: every case has a difficulty that all
versions share, and each run adds its own randomness. Versions:
    A  the current version
    B  a better candidate
    C  a candidate of the same quality as A
    D  candidate B with one broken zero-tolerance case
data/repeated_runs.jsonl holds 30 agent tasks run 8 times each.

Usage:
    python make_example_runs.py
"""

import json
import math
import random
from pathlib import Path

HERE = Path(__file__).parent
FEATURES = ("returns", "refunds", "delivery", "account")
SKILL = {"A": 2.0, "B": 2.45, "C": 2.0}
SHARED = 0.8  # how much of each outcome is decided by the shared difficulty of the case


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def results_rows(seed: int = 2026, cases: int = 600) -> list[dict]:
    rng = random.Random(seed)
    rows = []
    for index in range(cases):
        zero_tolerance = index % 30 == 0  # 20 safety cases that every acceptable version must pass
        difficulty = -3.0 if zero_tolerance else rng.gauss(0.0, 1.6)
        shared_draw = rng.random()
        passed = {}
        for version, skill in SKILL.items():
            draw = shared_draw if rng.random() < SHARED else rng.random()
            passed[version] = draw < sigmoid(skill - difficulty)
        if zero_tolerance:
            passed = {version: True for version in passed}
        rows.append({
            "id": f"case-{index + 1:04d}",
            "lang": "uk" if index % 3 == 2 else "en",
            "feature": FEATURES[index % len(FEATURES)],
            "zero_tolerance": zero_tolerance,
            "passed": passed,
        })
    broken = rows[450]
    assert broken["zero_tolerance"]
    for row in rows:
        row["passed"]["D"] = row["passed"]["B"] and row is not broken
    return rows


def repeated_rows(seed: int = 7, tasks: int = 30, runs: int = 8) -> list[dict]:
    rng = random.Random(seed)
    rows = []
    for index in range(tasks):
        rate = min(0.99, max(0.02, rng.betavariate(2.2, 0.9)))
        rows.append({"task": f"task-{index + 1:02d}", "runs": [rng.random() < rate for _ in range(runs)]})
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    write_jsonl(HERE / "data" / "results.jsonl", results_rows())
    write_jsonl(HERE / "data" / "repeated_runs.jsonl", repeated_rows())
    print("written data/results.jsonl and data/repeated_runs.jsonl")
