"""Validate an evaluation dataset before trusting results computed on it.

Chapter: Evaluation methodology and datasets (building a dataset; splits, overfitting and contamination)
https://gimme-job.com/learn/llm?topic=evaluation-fundamentals

Usage:
    python dataset_validator.py data/golden.jsonl --prompt-examples data/prompt_examples.json
Exit status 1 when the dataset has problems.

Checks: required fields and types, duplicate IDs, duplicate inputs, near-duplicate inputs across the
development and test splits (leakage), test inputs that also appear as few-shot examples in the prompt,
and slices with too few cases to say anything.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from dataset_builder import jaccard, normalized, shingles

REQUIRED = {"id": str, "input": str, "expected_facts": list, "tags": dict, "split": str, "source": str}
REQUIRED_TAGS = ("lang", "intent")
SPLITS = {"dev", "test"}


def validate(cases: list[dict], prompt_examples: list[str] = (), minimum_per_slice: int = 3,
             leakage_threshold: float = 0.8) -> list[str]:
    problems = []
    for case in cases:
        name = case.get("id", "<no id>")
        for field, kind in REQUIRED.items():
            if not isinstance(case.get(field), kind):
                problems.append(f"{name}: field {field!r} must be a {kind.__name__}")
        if isinstance(case.get("tags"), dict):
            missing = [tag for tag in REQUIRED_TAGS if tag not in case["tags"]]
            if missing:
                problems.append(f"{name}: missing tags {missing}")
        if case.get("split") not in SPLITS:
            problems.append(f"{name}: split must be one of {sorted(SPLITS)}")
    well_formed = [case for case in cases if all(isinstance(case.get(f), k) for f, k in REQUIRED.items())]

    for case_id, count in Counter(case["id"] for case in well_formed).items():
        if count > 1:
            problems.append(f"{case_id}: the ID is used {count} times")
    by_input = {}
    for case in well_formed:
        key = normalized(case["input"])
        if key in by_input:
            problems.append(f"{case['id']}: same input as {by_input[key]}")
        else:
            by_input[key] = case["id"]

    def profile(split: str) -> list[tuple[str, str, set]]:
        return [(case["id"], normalized(case["input"]), shingles(case["input"])) for case in well_formed if case["split"] == split]

    dev, test = profile("dev"), profile("test")
    for test_id, test_text, test_shingles in test:
        for dev_id, dev_text, dev_shingles in dev:
            # identical inputs are already reported above; this finds reworded copies
            if test_text != dev_text and jaccard(test_shingles, dev_shingles) >= leakage_threshold:
                problems.append(f"{test_id}: test input nearly repeats development case {dev_id}")

    examples = [shingles(example) for example in prompt_examples]
    for test_id, _, test_shingles in test:
        if any(jaccard(test_shingles, example) >= leakage_threshold for example in examples):
            problems.append(f"{test_id}: test input appears as a few-shot example in the prompt")

    for tag in REQUIRED_TAGS:
        counts = Counter(case["tags"].get(tag) for case in well_formed if isinstance(case.get("tags"), dict))
        for value, count in sorted(counts.items(), key=lambda item: str(item[0])):
            if count < minimum_per_slice:
                problems.append(f"slice {tag}={value}: only {count} case(s), at least {minimum_per_slice} needed")
    return problems


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Validate an evaluation dataset.")
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--prompt-examples", type=Path)
    parser.add_argument("--minimum-per-slice", type=int, default=3)
    args = parser.parse_args(argv[1:])

    cases = [json.loads(line) for line in args.dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    examples = json.loads(args.prompt_examples.read_text(encoding="utf-8")) if args.prompt_examples else []
    problems = validate(cases, examples, args.minimum_per_slice)
    print(f"{len(cases)} cases, {len(problems)} problem(s)")
    for problem in problems:
        print("PROBLEM", problem)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
