"""Regenerates the synthetic data in data/ with fixed seeds.

Chapter: Production quality
https://gimme-job.com/learn/llm?topic=production-quality

Usage:
    python make_production_data.py

data/release_suite.jsonl: 1,000 support cases (70% English, 30% Ukrainian, 25 zero-tolerance cases) with
the results of three versions. Every case has a difficulty that all versions share, so the versions
are compared on the same cases, as in a real evaluation:
- current: the large model in production.
- cheaper: a smaller model, slightly better in English, faster and much cheaper, but clearly worse
  in Ukrainian.
- cheaper_tuned: the smaller model with Ukrainian examples added to the prompt, which costs more
  input tokens.
data/daily_checks.jsonl: 24 days of online monitoring with 200 judged conversations a day, an
incident on days 11 and 12, and from day 15 more Ukrainian and other traffic with a slightly lower
pass rate.
"""

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).parent / "data"
INTENTS = ["order_status", "refund", "delivery", "product_question"]


@dataclass(frozen=True)
class Version:
    threshold: dict[str, float]  # a case passes when its ease (plus noise) is above this
    ttft_median_s: float
    tokens_per_second: float
    verbosity: float
    extra_input_tokens: dict[str, int]
    price_in: float  # EUR per million tokens
    price_out: float
    retry_share: float  # answers that fail validation and are generated again


VERSIONS = {
    "current": Version({"en": 0.08, "uk": 0.09}, 0.80, 90, 1.00, {}, 3.00, 15.00, 0.01),
    "cheaper": Version({"en": 0.04, "uk": 0.16}, 0.45, 160, 1.15, {}, 0.80, 4.00, 0.01),
    "cheaper_tuned": Version({"en": 0.04, "uk": 0.10}, 0.45, 160, 1.15, {"uk": 900}, 0.80, 4.00, 0.01),
}


def _run(rng: random.Random, version: Version, case: dict) -> dict:
    passed = case["ease"] + rng.gauss(0, 0.03) > version.threshold[case["language"]]
    attempts = 2 if rng.random() < version.retry_share else 1
    ttft = latency = cost = 0.0
    for attempt in range(attempts):
        first = rng.lognormvariate(math.log(version.ttft_median_s), 0.35)
        tool = rng.uniform(3, 7) if case["slow_tool"] and attempt == 0 else 0.0
        output_tokens = case["answer_tokens"] * version.verbosity
        input_tokens = case["input_tokens"] + version.extra_input_tokens.get(case["language"], 0)
        latency += tool + first + output_tokens / version.tokens_per_second
        cost += (input_tokens * version.price_in + output_tokens * version.price_out) / 1_000_000
        if attempt == attempts - 1:
            ttft = latency - output_tokens / version.tokens_per_second
    return {"passed": passed, "latency_s": round(latency, 3), "ttft_s": round(ttft, 3), "cost_eur": round(cost, 6)}


def release_suite(seed: int = 15) -> list[dict]:
    rng = random.Random(seed)
    cases = []
    for number in range(1, 1001):
        zero_tolerance = number % 40 == 0
        cases.append({
            "id": f"c{number:04d}",
            "language": "uk" if number % 10 < 3 else "en",
            "intent": rng.choice(INTENTS),
            "zero_tolerance": zero_tolerance,
            "ease": rng.uniform(0.5, 1) if zero_tolerance else rng.random(),
            "slow_tool": rng.random() < 0.03,
            "answer_tokens": rng.uniform(150, 450),
            "input_tokens": rng.uniform(4000, 9000),
        })
    rows = []
    for case in cases:
        results = {name: _run(rng, version, case) for name, version in VERSIONS.items()}
        rows.append({key: case[key] for key in ("id", "language", "intent", "zero_tolerance")} | {"results": results})
    return rows


def daily_checks(seed: int = 2) -> list[dict]:
    rng = random.Random(seed)
    days = []
    for day in range(1, 25):
        if day in (11, 12):
            rate = 0.80  # an incident: the retrieval index lost a document collection
        else:
            rate = 0.89 if day < 15 else 0.875  # more Ukrainian traffic, where the assistant is a little weaker
        shares = {"en": 0.72, "uk": 0.25, "other": 0.03} if day < 15 else {"en": 0.55, "uk": 0.38, "other": 0.07}
        conversations = rng.randint(2800, 3200)
        languages = dict.fromkeys(shares, 0)
        for _ in range(conversations):
            languages[rng.choices(list(shares), weights=list(shares.values()))[0]] += 1
        passed = sum(1 for _ in range(200) if rng.random() < rate)
        days.append({"day": day, "judged": 200, "passed": passed, "languages": languages})
    return days


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(exist_ok=True)
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    write_jsonl(DATA / "release_suite.jsonl", release_suite())
    write_jsonl(DATA / "daily_checks.jsonl", daily_checks())
    print(f"wrote {DATA / 'release_suite.jsonl'} and {DATA / 'daily_checks.jsonl'}")
