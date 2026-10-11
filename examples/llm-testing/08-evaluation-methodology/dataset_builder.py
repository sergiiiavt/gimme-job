"""Build an evaluation dataset from a production log: scrub personal data, remove duplicates and
near-duplicates, sample by slice with a minimum per slice, and split by hash.

Chapter: Evaluation methodology and datasets (building an evaluation dataset)
https://gimme-job.com/learn/llm?topic=evaluation-fundamentals

Usage:
    python dataset_builder.py data/production_log.jsonl --target 60 --minimum 8 --out dataset.jsonl
Each log line holds {"id": ..., "intent": ..., "lang": ..., "text": ...}.
"""

import argparse
import hashlib
import json
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

PERSONAL_DATA = [
    ("<email>", re.compile(r"(?<![\w.+-])[\w.+-]++@[\w-]++(?:\.[\w-]++)+")),
    ("<card>", re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")),
    ("<phone>", re.compile(r"\+\d[\d ()-]{8,}\d")),
]
WORD = re.compile(r"\w+")


def scrub(text: str) -> str:
    """Replace personal data with placeholders before the text is stored anywhere."""
    for placeholder, pattern in PERSONAL_DATA:
        text = pattern.sub(placeholder, text)
    return text


def normalized(text: str) -> str:
    return " ".join(WORD.findall(text.lower()))


def shingles(text: str, size: int = 1) -> set[tuple[str, ...]]:
    """Word n-grams of the text. Single words suit short messages, where one added word would break
    most longer shingles; long documents need longer shingles (and MinHash to compare many of them)."""
    words = WORD.findall(text.lower())
    return {tuple(words[i:i + size]) for i in range(max(len(words) - size + 1, 1))}


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a or b else 1.0


def remove_duplicates(entries: list[dict], threshold: float = 0.8) -> tuple[list[dict], int, int]:
    """Keep the first of every group of exact duplicates and of near-duplicates (word-shingle Jaccard
    similarity at or above the threshold). Returns the kept entries and how many of each kind were removed."""
    kept, kept_shingles, seen_exact = [], [], set()
    exact = near = 0
    for entry in entries:
        key = normalized(entry["text"])
        if key in seen_exact:
            exact += 1
            continue
        current = shingles(entry["text"])
        if any(jaccard(current, other) >= threshold for other in kept_shingles):
            near += 1
            continue
        seen_exact.add(key)
        kept_shingles.append(current)
        kept.append(entry)
    return kept, exact, near


def stratified_sample(entries: list[dict], key: str, target: int, minimum: int, seed: int = 0) -> list[dict]:
    """Proportional to the population, but at least `minimum` per slice (or the whole slice if smaller)."""
    rng = random.Random(seed)
    by_slice = defaultdict(list)
    for entry in entries:
        by_slice[entry[key]].append(entry)
    sample = []
    for name in sorted(by_slice):
        members = by_slice[name]
        size = min(len(members), max(round(target * len(members) / len(entries)), minimum))
        sample += rng.sample(members, size)
    return sample


def split_of(case_id: str, test_share: float = 0.3) -> str:
    """The same case always lands in the same split, whatever else is added to the dataset."""
    bucket = int(hashlib.sha256(case_id.encode()).hexdigest(), 16) % 1000
    return "test" if bucket < test_share * 1000 else "dev"


def build(log: list[dict], target: int, minimum: int, seed: int = 0) -> tuple[list[dict], dict]:
    scrubbed = [{**entry, "text": scrub(entry["text"])} for entry in log]
    unique, exact, near = remove_duplicates(scrubbed)
    sample = stratified_sample(unique, "intent", target, minimum, seed)
    cases = [{"id": entry["id"], "input": entry["text"], "tags": {"intent": entry["intent"], "lang": entry["lang"]},
              "split": split_of(entry["id"]), "source": "production log"} for entry in sample]
    datasheet = {
        "logged": len(log),
        "exact_duplicates_removed": exact,
        "near_duplicates_removed": near,
        "personal_data_replaced": sum(entry["text"] != original["text"] for entry, original in zip(scrubbed, log)),
        "cases": len(cases),
        "by_intent": dict(sorted(Counter(case["tags"]["intent"] for case in cases).items())),
        "by_lang": dict(sorted(Counter(case["tags"]["lang"] for case in cases).items())),
        "by_split": dict(sorted(Counter(case["split"] for case in cases).items())),
    }
    return cases, datasheet


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Build an evaluation dataset from a production log.")
    parser.add_argument("log", type=Path)
    parser.add_argument("--target", type=int, default=60)
    parser.add_argument("--minimum", type=int, default=8)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv[1:])

    log = [json.loads(line) for line in args.log.read_text(encoding="utf-8").splitlines() if line.strip()]
    cases, datasheet = build(log, args.target, args.minimum, args.seed)
    for key, value in datasheet.items():
        print(f"{key:<26} {value}")
    if args.out:
        args.out.write_text("".join(json.dumps(case, ensure_ascii=False) + "\n" for case in cases), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
