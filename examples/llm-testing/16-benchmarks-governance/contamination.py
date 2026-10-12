"""Contamination checks for benchmark items: long n-gram overlap with a corpus, canary strings, and the
rewording test that compares results on original and reworded items.

Chapter: Benchmarks, human evaluation and governance (contamination)
https://gimme-job.com/learn/llm?topic=pro-practice

Usage:
    python contamination.py data/benchmark_items.jsonl data/crawl_sample.jsonl
"""

import argparse
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path

N = 13  # the GPT-3 paper flagged test items sharing a 13-gram with its training data


def words(text: str) -> list[str]:
    """Lowercased words and numbers; punctuation, whitespace and case do not hide a copy."""
    return re.findall(r"[a-z0-9]+", text.lower())


def ngrams(tokens: list[str], n: int = N) -> set[tuple[str, ...]]:
    return {tuple(tokens[start:start + n]) for start in range(len(tokens) - n + 1)}


@dataclass(frozen=True)
class Overlap:
    item: str
    shared: int
    total: int  # n-grams of the item, or 1 for an item shorter than n words

    @property
    def verdict(self) -> str:
        if self.shared == 0:
            return "clean"
        return "copied" if self.shared == self.total else "partly copied"


class CorpusIndex:
    """All n-grams of a corpus, plus the token lists for items too short to have an n-gram."""

    def __init__(self, documents: list[str], n: int = N):
        self.n = n
        self.documents = [words(document) for document in documents]
        self.grams = set().union(*(ngrams(tokens, n) for tokens in self.documents)) if self.documents else set()

    def overlap(self, item_id: str, text: str) -> Overlap:
        tokens = words(text)
        if len(tokens) < self.n:
            found = any(_contains(document, tokens) for document in self.documents)
            return Overlap(item_id, int(found), 1)
        grams = ngrams(tokens, self.n)
        return Overlap(item_id, len(grams & self.grams), len(grams))


def _contains(haystack: list[str], needle: list[str]) -> bool:
    if not needle:
        return False
    return any(haystack[start:start + len(needle)] == needle for start in range(len(haystack) - len(needle) + 1))


def canary_found(text: str, canary: str) -> bool:
    """True when a document (or a model's completion) contains the benchmark's canary string."""
    return canary.lower() in text.lower()


def rewording_test(original: list[bool], reworded: list[bool]) -> tuple[int, int, float]:
    """Items that pass only in the original wording, only after rewording, and the exact two-sided
    sign-test p-value. Without contamination both counts differ only by chance."""
    if len(original) != len(reworded):
        raise ValueError("both lists need one result per item")
    only_original = sum(1 for a, b in zip(original, reworded) if a and not b)
    only_reworded = sum(1 for a, b in zip(original, reworded) if b and not a)
    discordant = only_original + only_reworded
    if discordant == 0:
        return 0, 0, 1.0
    tail = sum(math.comb(discordant, k) for k in range(min(only_original, only_reworded) + 1)) / 2 ** discordant
    return only_original, only_reworded, min(1.0, 2 * tail)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Find benchmark items that appear in a corpus.")
    parser.add_argument("items", type=Path, help='JSONL with {"id": ..., "question": ...}')
    parser.add_argument("corpus", type=Path, help='JSONL with {"text": ...}, for example crawled pages')
    args = parser.parse_args(argv[1:])

    index = CorpusIndex([row["text"] for row in load_jsonl(args.corpus)])
    found = 0
    for row in load_jsonl(args.items):
        result = index.overlap(row["id"], row["question"])
        found += result.verdict != "clean"
        print(f"{result.item:<8} {result.shared:>3} of {result.total:>3} shared {N}-grams  {result.verdict}")
    print(f"{found} item(s) overlap the corpus")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
