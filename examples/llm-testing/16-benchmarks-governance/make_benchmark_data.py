"""Regenerates the synthetic data in data/ with fixed seeds.

Chapter: Benchmarks, human evaluation and governance
https://gimme-job.com/learn/llm?topic=pro-practice

Usage:
    python make_benchmark_data.py

- model_results.jsonl: 16 systems on a 60-item custom benchmark, simulated with a two-parameter item
  response model. Items 7 and 23 are trivial, item 41 is impossible, and items 15 and 52 have a wrong
  reference answer (stronger systems are less likely to match it).
- preference_votes.jsonl: 600 pairwise human votes, 10% of them ties, between five assistants with
  known strengths.
- candidates.json: six models evaluated on the same 400 cases, with cost, latency and context length.
- benchmark_items.jsonl and crawl_sample.jsonl: items of a private benchmark and crawled pages,
  some of which copy the items.
- risk_register.json and test_results.json: the example of the chapter.
"""

import json
import math
import random
from pathlib import Path

DATA = Path(__file__).parent / "data"


def model_results(seed: int = 16) -> list[dict]:
    rng = random.Random(seed)
    abilities = [-1.6 + 3.6 * number / 15 for number in range(16)]
    items = [(rng.uniform(0.8, 2.0), rng.uniform(-2.0, 2.0)) for _ in range(60)]  # discrimination, difficulty
    for trivial in (7, 23):
        items[trivial - 1] = (1.5, -9.0)
    items[41 - 1] = (1.5, 9.0)
    for wrong_key in (15, 52):
        items[wrong_key - 1] = (-1.5, 0.0)
    rows = []
    for number, ability in enumerate(reversed(abilities), 1):
        results = [int(rng.random() < 1 / (1 + math.exp(-a * (ability - b)))) for a, b in items]
        rows.append({"model": f"system-{number:02d}", "results": results})
    return rows


def preference_votes(seed: int = 16) -> list[dict]:
    rng = random.Random(seed)
    strength = {"assist-a": 1.2, "assist-b": 0.7, "assist-c": 0.6, "assist-d": 0.1, "assist-e": -0.4}
    names, votes = list(strength), []
    for _ in range(600):
        a, b = rng.sample(names, 2)
        if rng.random() < 0.1:
            winner = "tie"
        else:
            winner = "a" if rng.random() < 1 / (1 + math.exp(strength[b] - strength[a])) else "b"
        votes.append({"a": a, "b": b, "winner": winner})
    return votes


def candidates(seed: int = 16) -> dict:
    rng = random.Random(seed)
    ease = [rng.random() for _ in range(400)]
    specs = [  # name, threshold on ease, EUR per resolved conversation, p95 seconds, context tokens
        ("large-a", 0.065, 0.031, 5.2, 200_000),
        ("medium-b", 0.068, 0.012, 3.9, 128_000),
        ("medium-c", 0.100, 0.014, 4.4, 128_000),
        ("small-d", 0.115, 0.004, 2.1, 32_000),
        ("long-e", 0.055, 0.026, 7.5, 1_000_000),
        ("tiny-f", 0.220, 0.002, 1.4, 16_000),
    ]
    rows = [{"name": name, "passed": [int(e + rng.gauss(0, 0.02) > threshold) for e in ease],
             "cost_per_resolved": cost, "p95_latency": latency, "context_tokens": context}
            for name, threshold, cost, latency, context in specs]
    return {"requirements": {"min_quality": 0.85, "max_latency": 6.0, "min_context": 32_000, "quality_margin": 0.03},
            "candidates": rows}


ITEMS = [
    ("cv-01", "A candidate lists five years of Selenium but no API testing. Which two questions best check "
              "whether the experience covers test design rather than only scripting?"),
    ("cv-02", "Rewrite this bug report so that a developer can reproduce it: the checkout button sometimes "
              "does nothing on mobile when the cart has more than ten items."),
    ("cv-03", "Which risks would you test first for a feature that ranks job applications with a language "
              "model, and what evidence would show that the ranking does not depend on gender?"),
    ("cv-04", "Design boundary values for a field that accepts salaries from 10 000 to 250 000 euros per year "
              "in steps of one thousand."),
    ("cv-05", "What is a flaky test?"),
    ("cv-06", "Explain the difference between verification and validation for an assistant that drafts cover "
              "letters, with one test idea for each."),
]
CRAWL = [
    "Interview prep thread. Q: Design boundary values for a field that accepts salaries from 10 000 to 250 000 "
    "euros per year in steps of one thousand. My answer was 9 999, 10 000, 250 000 and 250 001, was I right?",
    "Blog: what is a flaky test? A flaky test passes and fails without any change to the code.",
    "Notes from a meetup about risk-based testing. Which risks would you test first for a feature that ranks job "
    "applications? Speakers argued for fairness checks before anything else.",
]


def risk_register() -> dict:
    return {"risks": [
        {"id": "R1", "severity": "high", "risk": "answers contradict the refund policy", "tests": ["policy-suite", "policy-judge"]},
        {"id": "R2", "severity": "high", "risk": "one customer sees another's data", "tests": ["tenancy-tests", "red-team-leaks"]},
        {"id": "R3", "severity": "high", "risk": "CV scores differ by gender or origin", "tests": []},
        {"id": "R4", "severity": "medium", "risk": "slow answers at peak load", "tests": ["load-test"]},
        {"id": "R5", "severity": "low", "risk": "answer in the wrong language", "tests": ["language-check"]},
    ]}


def latest_results() -> dict:
    def result(status: str, version: str, ran: str) -> dict:
        return {"status": status, "version": version, "ran": ran}
    return {"results": {
        "policy-suite": result("pass", "2.4.0", "2026-10-09"),
        "policy-judge": result("pass", "2.4.0", "2026-10-09"),
        "tenancy-tests": result("pass", "2.4.0", "2026-10-09"),
        "red-team-leaks": result("fail", "2.4.0", "2026-10-08"),
        "load-test": result("pass", "2.1.0", "2026-06-02"),
        "language-check": result("pass", "2.4.0", "2026-10-09"),
        "tone-check": result("pass", "2.4.0", "2026-10-09"),
    }}


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8", newline="\n")


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    DATA.mkdir(exist_ok=True)
    write_jsonl(DATA / "model_results.jsonl", model_results())
    write_jsonl(DATA / "preference_votes.jsonl", preference_votes())
    write_json(DATA / "candidates.json", candidates())
    write_jsonl(DATA / "benchmark_items.jsonl", [{"id": item, "question": text} for item, text in ITEMS])
    write_jsonl(DATA / "crawl_sample.jsonl", [{"text": text} for text in CRAWL])
    write_json(DATA / "risk_register.json", risk_register())
    write_json(DATA / "test_results.json", latest_results())
    print(f"wrote the data files in {DATA}")
