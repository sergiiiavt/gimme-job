"""Validate the fact scorer against human labels before trusting its results.

Chapter: Code-based scorers and metrics (fact-based scoring, testing and validating scorers)
https://gimme-job.com/learn/llm?topic=code-based-scorers

Usage:
    python validate_scorer.py data/labelled_answers.jsonl
    python validate_scorer.py data/labelled_answers.jsonl --naive
Each JSONL line holds {"id": ..., "case": <case id>, "answer": ..., "human": true|false, "note": ...}.
--naive runs the first version of the scorer, which did not accept numbers taken from the question.
"""

import sys
from dataclasses import dataclass
from pathlib import Path

from fact_scorer import check_facts
from harness import load_cases, read_jsonl


@dataclass(frozen=True)
class Agreement:
    total: int
    agreed: int
    false_passes: dict[str, str]    # accepted by the scorer, rejected by humans: broken answers slip through
    false_failures: dict[str, str]  # rejected by the scorer, accepted by humans: false regressions


def agreement(cases: dict[str, dict], labelled: list[dict], allow_echoed_numbers: bool = True) -> Agreement:
    false_passes, false_failures = {}, {}
    for item in labelled:
        case = cases[item["case"]]
        result = check_facts(item["answer"], case["question"], case["must_state"], case["must_not_state"],
                             case["sources"], allow_echoed_numbers)
        if result.passed and not item["human"]:
            false_passes[item["id"]] = "scorer found nothing wrong"
        elif not result.passed and item["human"]:
            false_failures[item["id"]] = "; ".join(result.failures)
    disagreements = len(false_passes) + len(false_failures)
    return Agreement(len(labelled), len(labelled) - disagreements, false_passes, false_failures)


def main(argv: list[str]) -> int:
    naive = "--naive" in argv
    paths = [arg for arg in argv[1:] if not arg.startswith("--")]
    cases = {case["id"]: case for case in load_cases()}
    result = agreement(cases, read_jsonl(Path(paths[0])), allow_echoed_numbers=not naive)

    variant = "numbers from sources only" if naive else "numbers from sources and the question"
    print(f"fact scorer ({variant}): agrees with human labels on {result.agreed}/{result.total} answers")
    for title, items in [("false passes (accepts what humans reject)", result.false_passes),
                         ("false failures (rejects what humans accept)", result.false_failures)]:
        print(f"  {title}: {', '.join(items) or 'none'}")
        for answer_id, reason in items.items():
            print(f"    {answer_id}: {reason}")
    return 0 if result.agreed == result.total else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
