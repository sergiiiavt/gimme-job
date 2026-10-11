"""Claim-level faithfulness and citation checks for RAG answers, and abstention metrics.

Chapter: Evaluating RAG systems (faithfulness and citations; questions without an answer)
https://gimme-job.com/learn/llm?topic=rag-testing

The support decision below is a code-level stand-in; in production a judge validated against human
labels makes it. The citation checks are deterministic and stay in code.
"""

import re
from collections import Counter
from dataclasses import dataclass

from bm25 import terms

ABSOLUTE = re.compile(r"\b(always|never|all|any|every)\b", re.IGNORECASE)
LIMITING = re.compile(r"\b(only|except|unless|not)\b", re.IGNORECASE)
NUMBER = re.compile(r"\d+(?:[.,]\d+)?%?")


def supported(claim: str, sources: list[str], min_overlap: float = 0.6) -> bool:
    """All numbers occur in the sources, most content words do, and an absolute claim does not contradict
    a limitation in the sources."""
    text = " ".join(sources)
    claim_terms = set(terms(claim))
    if not claim_terms or not sources:
        return False
    numbers_ok = all(number in NUMBER.findall(text) for number in NUMBER.findall(claim))
    overlap = len(claim_terms & set(terms(text))) / len(claim_terms)
    contradicts = bool(ABSOLUTE.search(claim)) and bool(LIMITING.search(text))
    return numbers_ok and overlap >= min_overlap and not contradicts


@dataclass(frozen=True)
class FaithfulnessReport:
    claims: int
    supported: int
    uncited: list[str]               # claims without any citation
    citations_outside_context: list[str]
    unsupported_with_citation: list[str]

    @property
    def faithfulness(self) -> float:
        return self.supported / self.claims if self.claims else 1.0


def check(answer, chunks_by_id: dict) -> FaithfulnessReport:
    retrieved = set(answer.retrieved)
    uncited, outside, unsupported_cited = [], [], []
    supported_count = 0
    for claim in answer.claims:
        if not claim.cited:
            uncited.append(claim.text)
        outside += [chunk_id for chunk_id in claim.cited if chunk_id not in retrieved]
        sources = [chunks_by_id[chunk_id].text for chunk_id in claim.cited if chunk_id in chunks_by_id]
        if supported(claim.text, sources):
            supported_count += 1
        elif claim.cited:
            unsupported_cited.append(claim.text)
    return FaithfulnessReport(len(answer.claims), supported_count, uncited, outside, unsupported_cited)


def abstention_outcomes(results: list[tuple[bool, bool, bool]]) -> Counter:
    """results: (answerable, answered, correct) per question."""
    outcomes = Counter()
    for answerable, answered, correct in results:
        if answerable and answered:
            outcomes["correct answer" if correct else "wrong answer"] += 1
        elif answerable:
            outcomes["false abstention"] += 1
        elif answered:
            outcomes["answer to an unanswerable question"] += 1
        else:
            outcomes["correct abstention"] += 1
    return outcomes
