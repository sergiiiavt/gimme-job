import json
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from bm25 import BM25Index
from chunker import Chunk
from retrieval_eval import (evaluate, hit_at_k, load_index, main, ndcg_at_k, precision_at_k, recall_at_k,
                            reciprocal_rank)

HERE = Path(__file__).parent
DOCUMENTS = HERE / "data" / "documents.json"
QUESTIONS = [json.loads(line) for line in (HERE / "data" / "questions.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
INDEX = load_index(DOCUMENTS)


def chunk(chunk_id: str, text: str, tenant: str = "public") -> Chunk:
    return Chunk(chunk_id, chunk_id, "", (text,), tenant)


# ---------------------------------------------------------------- BM25

def test_the_chunk_with_the_query_terms_ranks_first():
    index = BM25Index([chunk("a", "refunds take five business days"), chunk("b", "delivery takes three days")])
    assert index.search("when do refunds arrive")[0].chunk.id == "a"


def test_rare_terms_weigh_more_than_common_ones():
    index = BM25Index([chunk(str(i), "delivery " + ("express" if i == 0 else "standard")) for i in range(6)])
    assert index.idf["express"] > index.idf["delivery"]


def test_a_shorter_chunk_with_the_same_match_ranks_higher():
    index = BM25Index([chunk("long", "refund " + "filler " * 30), chunk("short", "refund policy")])
    assert [hit.chunk.id for hit in index.search("refund")] == ["short", "long"]


def test_a_query_of_stop_words_finds_nothing():
    assert INDEX.search("what is the") == []


def test_tenants_never_see_each_others_tickets():
    taras = [hit.chunk.tenant for hit in INDEX.search("What happened to order A-1042?", k=10, tenant="customer-taras")]
    public = [hit.chunk.tenant for hit in INDEX.search("order A-1042 refund approved", k=10)]
    assert "customer-olena" not in taras and "customer-olena" not in public
    olena = [hit.chunk.id for hit in INDEX.search("What happened to order A-1042?", tenant="customer-olena")]
    assert olena[0] == "ticket-olena#0"


# ---------------------------------------------------------------- metrics

def test_metrics_of_a_perfect_ranking():
    relevant = {"a", "b"}
    ranked = ["a", "b", "c"]
    assert (hit_at_k(relevant, ranked, 3), recall_at_k(relevant, ranked, 3), reciprocal_rank(relevant, ranked),
            ndcg_at_k(relevant, ranked, 3)) == (1.0, 1.0, 1.0, 1.0)
    assert precision_at_k(relevant, ranked, 3) == pytest.approx(2 / 3)


@given(st.sets(st.sampled_from("abcdefgh"), min_size=1, max_size=4),
       st.lists(st.sampled_from("abcdefgh"), min_size=1, max_size=8, unique=True), st.integers(min_value=1, max_value=8))
def test_metrics_stay_between_zero_and_one(relevant, ranked, k):
    for value in (hit_at_k(relevant, ranked, k), recall_at_k(relevant, ranked, k), precision_at_k(relevant, ranked, k),
                  reciprocal_rank(relevant, ranked), ndcg_at_k(relevant, ranked, k)):
        assert 0.0 <= value <= 1.0 + 1e-12
    assert recall_at_k(relevant, ranked, k) <= recall_at_k(relevant, ranked, k + 1)


def test_relevance_labels_point_to_chunks_that_exist():
    ids = {item.id for item in INDEX.chunks}
    for question in QUESTIONS:
        assert set(question["relevant"]) <= ids, question["question"]


def test_lexical_retrieval_misses_a_question_worded_differently_from_the_policy():
    averages, missed = evaluate(INDEX, QUESTIONS)
    assert missed == ["Can I send back sneakers I already wore?"], "no shared words with 'unworn items can be returned'"
    assert averages["recall@3"] == pytest.approx(0.9)


def test_command_line(capsys):
    assert main(["retrieval_eval.py", str(DOCUMENTS), str(HERE / "data" / "questions.jsonl")]) == 0
    out = capsys.readouterr().out
    assert "hit@3 0.90  recall@3 0.90" in out and "MISSED: Can I send back sneakers I already wore?" in out
