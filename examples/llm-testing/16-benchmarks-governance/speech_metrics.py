"""Word and character error rates for speech recognition and OCR, with normalization and slices.

Chapter: Benchmarks, human evaluation and governance (beyond text: multimodal and voice)
https://gimme-job.com/learn/llm?topic=pro-practice

WER = (S + D + I) / N: substitutions, deletions and insertions needed to turn the reference into the
recognized text, divided by the number of reference words. Libraries such as jiwer compute the same.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Errors:
    substitutions: int
    deletions: int
    insertions: int
    reference_length: int

    @property
    def total(self) -> int:
        return self.substitutions + self.deletions + self.insertions

    @property
    def rate(self) -> float:
        if not self.reference_length:
            raise ValueError("an error rate needs a non-empty reference")
        return self.total / self.reference_length


def normalize(text: str) -> str:
    """Lowercase, drop punctuation and collapse whitespace, so formatting is not counted as an error."""
    return " ".join(re.sub(r"[^\w\s']", " ", text.lower()).split())


def align(reference: Sequence[str], hypothesis: Sequence[str]) -> Errors:
    """Minimum edit alignment; among equally short alignments, prefer substitutions."""
    rows, cols = len(reference) + 1, len(hypothesis) + 1
    cost = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        cost[i][0] = i
    for j in range(cols):
        cost[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            same = reference[i - 1] == hypothesis[j - 1]
            cost[i][j] = min(cost[i - 1][j - 1] + (0 if same else 1), cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    i, j, subs, dels, ins = len(reference), len(hypothesis), 0, 0, 0
    while i or j:
        if i and j and cost[i][j] == cost[i - 1][j - 1] + (reference[i - 1] != hypothesis[j - 1]):
            subs += reference[i - 1] != hypothesis[j - 1]
            i, j = i - 1, j - 1
        elif i and cost[i][j] == cost[i - 1][j] + 1:
            dels, i = dels + 1, i - 1
        else:
            ins, j = ins + 1, j - 1
    return Errors(subs, dels, ins, len(reference))


def word_errors(reference: str, hypothesis: str) -> Errors:
    return align(normalize(reference).split(), normalize(hypothesis).split())


def character_errors(reference: str, hypothesis: str) -> Errors:
    return align(list(normalize(reference)), list(normalize(hypothesis)))


def rate_by_slice(records: list[dict]) -> dict[str, float]:
    """Pooled WER per slice: all errors of the slice over all its reference words. Averaging per-utterance
    rates instead would let one short utterance count as much as a long one."""
    totals: dict[str, list[int]] = {}
    for record in records:
        errors = word_errors(record["reference"], record["recognized"])
        bucket = totals.setdefault(record["slice"], [0, 0])
        bucket[0] += errors.total
        bucket[1] += errors.reference_length
    return {name: errors / words for name, (errors, words) in totals.items()}
