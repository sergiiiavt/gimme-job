"""A small RAG pipeline: retrieve, prefer the newest version of each document, assemble cited context,
generate, and abstain when nothing relevant was found.

Chapter: Evaluating RAG systems
https://gimme-job.com/learn/llm?topic=rag-testing

The generator is a deterministic fake that builds the answer from context sentences that share words
with the question and cites their chunks. It stands in for a model so that retrieval, context assembly,
citation checks and metamorphic relations can be tested offline; faults can be injected on purpose.

Usage:
    python rag_pipeline.py data/documents.json data/questions.jsonl
"""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

from bm25 import BM25Index, Hit, terms
from chunker import Chunk
from faithfulness import abstention_outcomes, check
from retrieval_eval import load_index


@dataclass(frozen=True)
class Claim:
    text: str
    cited: tuple[str, ...]


@dataclass(frozen=True)
class Answer:
    claims: tuple[Claim, ...]
    retrieved: tuple[str, ...]
    abstained: bool = False

    @property
    def text(self) -> str:
        return "I could not find this in our policies." if self.abstained else " ".join(claim.text for claim in self.claims)


def newest_versions(hits: list[Hit]) -> list[Hit]:
    """Keep chunks of the newest version of each document family (the part of the ID before '@')."""
    newest: dict[str, str] = {}
    for hit in hits:
        family = hit.chunk.document.split("@")[0]
        newest[family] = max(newest.get(family, ""), hit.chunk.valid_from)
    return [hit for hit in hits if hit.chunk.valid_from == newest[hit.chunk.document.split("@")[0]]]


@dataclass
class FakeGenerator:
    """Answers with up to two context sentences that share at least two content words with the question.
    Faults for testing the checks: invent a claim, drop citations, or cite the wrong chunk."""

    invent: str = ""
    drop_citations: bool = False
    cite_wrong_chunk: bool = False
    seen_contexts: list[list[str]] = field(default_factory=list)

    def generate(self, question: str, context: list[Chunk]) -> list[Claim]:
        self.seen_contexts.append([chunk.id for chunk in context])
        question_terms = set(terms(question))
        claims = []
        for position, chunk in enumerate(context):
            for sentence in chunk.sentences:
                if len(question_terms & set(terms(sentence))) >= 2 and all(c.text != sentence for c in claims):
                    cited = context[(position + 1) % len(context)].id if self.cite_wrong_chunk and len(context) > 1 else chunk.id
                    claims.append(Claim(sentence, () if self.drop_citations else (cited,)))
        claims = claims[:2]
        if self.invent and claims:
            claims.append(Claim(self.invent, ()))
        return claims


def answer(question: str, index: BM25Index, generator: FakeGenerator, k: int = 3, tenant: str = "public",
           min_score: float = 1.5) -> Answer:
    hits = newest_versions(index.search(question, k=10, tenant=tenant))[:k]
    retrieved = tuple(hit.chunk.id for hit in hits)
    if not hits or hits[0].score < min_score:
        return Answer((), retrieved, abstained=True)
    claims = generator.generate(question, [hit.chunk for hit in hits])
    if not claims:
        return Answer((), retrieved, abstained=True)
    return Answer(tuple(claims), retrieved)


def run_questions(index: BM25Index, questions: list[dict], generator: FakeGenerator | None = None):
    """Answer every question and classify the outcome against its labels."""
    chunks_by_id = {chunk.id: chunk for chunk in index.chunks}
    generator = generator or FakeGenerator()
    results, reports = [], []
    for question in questions:
        result = answer(question["question"], index, generator, tenant=question.get("tenant", "public"))
        answerable = bool(question["relevant"])
        correct = answerable and not result.abstained and question["answer_sentence"] in result.text
        results.append((answerable, not result.abstained, correct))
        if not result.abstained:
            reports.append(check(result, chunks_by_id))
    return abstention_outcomes(results), reports


def main(argv: list[str]) -> int:
    index = load_index(Path(argv[1]))
    questions = [json.loads(line) for line in Path(argv[2]).read_text(encoding="utf-8").splitlines() if line.strip()]
    outcomes, reports = run_questions(index, questions)
    for outcome in ("correct answer", "wrong answer", "false abstention", "correct abstention", "answer to an unanswerable question"):
        print(f"{outcome:<36} {outcomes[outcome]:>3}")
    claims = sum(report.claims for report in reports)
    print(f"claims supported by their citations: {sum(report.supported for report in reports)}/{claims}, "
          f"uncited claims: {sum(len(report.uncited) for report in reports)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
