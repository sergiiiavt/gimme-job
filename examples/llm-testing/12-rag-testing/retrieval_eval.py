"""Retrieval metrics against relevance labels, and an evaluation of the BM25 retriever on labelled questions.

Chapter: Evaluating RAG systems (retrieval metrics; building retrieval labels)
https://gimme-job.com/learn/llm?topic=rag-testing

Usage:
    python retrieval_eval.py data/documents.json data/questions.jsonl
"""

import json
import math
import sys
from pathlib import Path

from bm25 import BM25Index
from chunker import chunk_document


def hit_at_k(relevant: set[str], ranked: list[str], k: int) -> float:
    return float(any(chunk in relevant for chunk in ranked[:k]))


def recall_at_k(relevant: set[str], ranked: list[str], k: int) -> float:
    return len(relevant & set(ranked[:k])) / len(relevant)


def precision_at_k(relevant: set[str], ranked: list[str], k: int) -> float:
    return sum(chunk in relevant for chunk in ranked[:k]) / k


def reciprocal_rank(relevant: set[str], ranked: list[str]) -> float:
    return next((1 / rank for rank, chunk in enumerate(ranked, 1) if chunk in relevant), 0.0)


def ndcg_at_k(relevant: set[str], ranked: list[str], k: int) -> float:
    gain = sum(1 / math.log2(rank + 1) for rank, chunk in enumerate(ranked[:k], 1) if chunk in relevant)
    ideal = sum(1 / math.log2(rank + 1) for rank in range(1, min(len(relevant), k) + 1))
    return gain / ideal


def evaluate(index: BM25Index, questions: list[dict], k: int = 3) -> tuple[dict[str, float], list[str]]:
    """Average metrics over answerable questions, and the questions whose relevant chunks were all missed."""
    rows, missed = [], []
    for question in questions:
        if not question["relevant"]:
            continue
        relevant = set(question["relevant"])
        ranked = [hit.chunk.id for hit in index.search(question["question"], k=10, tenant=question.get("tenant", "public"))]
        rows.append({
            f"hit@{k}": hit_at_k(relevant, ranked, k), f"recall@{k}": recall_at_k(relevant, ranked, k),
            f"precision@{k}": precision_at_k(relevant, ranked, k), "MRR": reciprocal_rank(relevant, ranked),
            f"nDCG@{k}": ndcg_at_k(relevant, ranked, k),
        })
        if not hit_at_k(relevant, ranked, k):
            missed.append(question["question"])
    return {key: sum(row[key] for row in rows) / len(rows) for key in rows[0]}, missed


def load_index(documents_path: Path) -> BM25Index:
    documents = json.loads(Path(documents_path).read_text(encoding="utf-8"))
    return BM25Index([chunk for document in documents for chunk in chunk_document(document)])


def main(argv: list[str]) -> int:
    index = load_index(Path(argv[1]))
    questions = [json.loads(line) for line in Path(argv[2]).read_text(encoding="utf-8").splitlines() if line.strip()]
    averages, missed = evaluate(index, questions)
    print(f"{len(index.chunks)} chunks, {sum(bool(q['relevant']) for q in questions)} answerable questions")
    print("  ".join(f"{key} {value:.2f}" for key, value in averages.items()))
    for question in missed:
        print(f"MISSED: {question}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
