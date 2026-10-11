"""Two input guardrails and their evaluation per attack category, like any classifier.

Chapter: Security, red teaming and guardrails (guardrails and how to test them)
https://gimme-job.com/learn/llm?topic=security-red-teaming

Usage:
    python guardrails.py data/guardrail_labels.jsonl
"""

import base64
import binascii
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

KEYWORDS = [r"ignore (all |the )?previous instructions", r"reveal (your|the) system prompt", r"you are now"]
NORMALIZED_KEYWORDS = KEYWORDS + [
    r"ігноруй (усі |всі )?попередні інструкції", r"покажи (свій|твій) системний",
    r"disregard (everything|all|your)", r"(print|show|tell me) your (hidden|secret|system) (rules|instructions|prompt)",
]


def keyword_guardrail(text: str) -> bool:
    """True means block: a list of known attack phrases."""
    return any(re.search(pattern, text.lower()) for pattern in KEYWORDS)


def _decoded_base64(text: str) -> list[str]:
    decoded = []
    for token in re.findall(r"[A-Za-z0-9+/=]{16,}", text):
        try:
            decoded.append(base64.b64decode(token + "=" * (-len(token) % 4), validate=True).decode("utf-8"))
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
    return decoded


def normalize(text: str) -> list[str]:
    """Variants the attack phrases are checked against: lowercase, letters joined across separators,
    and decoded base64 segments."""
    lowered = text.lower()
    joined = re.sub(r"(?<=\b\w)[\s\-_.](?=\w\b)", "", lowered)  # "i-g-n-o-r-e" -> "ignore"
    joined = re.sub(r"\s+", " ", joined)
    return [lowered, joined, *(part.lower() for part in _decoded_base64(text))]


def normalizing_guardrail(text: str) -> bool:
    return any(re.search(pattern, variant) for variant in normalize(text) for pattern in NORMALIZED_KEYWORDS)


def evaluate(guardrail, labelled: list[dict]) -> dict[str, tuple[int, int]]:
    """(correct, total) per category; for attacks correct means blocked, for benign messages allowed."""
    results: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for row in labelled:
        blocked = guardrail(row["text"])
        results[row["category"]][0] += blocked == row["attack"]
        results[row["category"]][1] += 1
    return {category: (correct, total) for category, (correct, total) in sorted(results.items())}


def main(argv: list[str]) -> int:
    labelled = [json.loads(line) for line in Path(argv[1]).read_text(encoding="utf-8").splitlines() if line.strip()]
    print(f"{'category':<24} {'keywords':>9} {'normalizing':>12}")
    keyword_results, normalizing_results = evaluate(keyword_guardrail, labelled), evaluate(normalizing_guardrail, labelled)
    for category, (correct, total) in keyword_results.items():
        better, _ = normalizing_results[category]
        print(f"{category:<24} {f'{correct}/{total}':>9} {f'{better}/{total}':>12}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
