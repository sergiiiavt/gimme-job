"""Needle-in-a-haystack test generation, scoring and reporting for long-context features.

Chapter: How LLMs generate text (context window behaviour)
https://gimme-job.com/learn/llm?topic=llm-foundations

Replace the `answer` callable with a real model call to run the test against a model.
"""

import random
from collections import defaultdict
from collections.abc import Callable

FILLER = [
    "Orders are packed in recycled boxes.",
    "Customer service is available on weekdays.",
    "Gift cards never expire.",
    "Standard delivery takes three to five working days.",
    "Shoe sizes follow the EU standard.",
    "Prices include VAT.",
]
QUESTION = "What is the discount code for loyal customers?"


def build_case(depth: float, total_sentences: int, rng: random.Random) -> dict:
    """Long context with one 'needle' fact at a relative depth (0.0 = start, 1.0 = end)."""
    if not 0.0 <= depth <= 1.0:
        raise ValueError("depth must be between 0 and 1")
    code = f"STR-{rng.randint(1000, 9999)}"
    sentences = [rng.choice(FILLER) for _ in range(total_sentences)]
    position = round(depth * total_sentences)
    sentences.insert(position, f"The discount code for loyal customers is {code}.")
    return {"context": " ".join(sentences), "question": QUESTION, "expected": code,
            "depth": depth, "length": total_sentences, "position": position}


def build_suite(lengths: list[int], depths: list[float], repetitions: int, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    return [build_case(depth, length, rng) for length in lengths for depth in depths for _ in range(repetitions)]


def score(answer: str, expected: str) -> bool:
    return expected in answer


def accuracy_by_cell(cases: list[dict], answer: Callable[[dict], str]) -> dict[tuple[int, float], float]:
    """Run every case through `answer` and report accuracy per (length, depth) cell."""
    results: dict[tuple[int, float], list[bool]] = defaultdict(list)
    for case in cases:
        results[(case["length"], case["depth"])].append(score(answer(case), case["expected"]))
    return {cell: sum(outcomes) / len(outcomes) for cell, outcomes in sorted(results.items())}
