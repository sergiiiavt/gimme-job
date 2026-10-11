import json
import random
from pathlib import Path

from bm25 import BM25Index
from chunker import chunk_document
from faithfulness import abstention_outcomes, check, supported
from rag_pipeline import FakeGenerator, answer, main, run_questions

HERE = Path(__file__).parent
DOCUMENTS = json.loads((HERE / "data" / "documents.json").read_text(encoding="utf-8"))
QUESTIONS = [json.loads(line) for line in (HERE / "data" / "questions.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]


def build(documents=DOCUMENTS) -> BM25Index:
    return BM25Index([chunk for document in documents for chunk in chunk_document(document)])


INDEX = build()
CHUNKS = {chunk.id: chunk for chunk in INDEX.chunks}


# ---------------------------------------------------------------- answers and abstention

def test_the_newest_policy_wins_over_a_stale_version():
    result = answer("How long is the return window for unworn items?", INDEX, FakeGenerator())
    assert "30 days" in result.text and "14 days" not in result.text
    assert all("@2025-01" not in chunk_id for chunk_id in result.retrieved)


def test_questions_the_documents_do_not_answer_are_refused():
    for question in ("Do you ship to Antarctica?", "Can I pay with cryptocurrency?"):
        assert answer(question, INDEX, FakeGenerator()).abstained, question


def test_outcomes_over_the_labelled_questions():
    outcomes, reports = run_questions(INDEX, QUESTIONS)
    assert outcomes == {"correct answer": 9, "false abstention": 1, "correct abstention": 2}
    assert all(report.faithfulness == 1.0 and not report.uncited for report in reports)


def test_abstention_outcomes_from_the_chapter():
    results = ([(True, True, True)] * 70 + [(True, True, False)] * 8 + [(True, False, False)] * 7 +
               [(False, False, False)] * 9 + [(False, True, False)] * 6)
    assert abstention_outcomes(results)["answer to an unanswerable question"] == 6


# ---------------------------------------------------------------- faithfulness and citations

def test_an_invented_claim_is_caught():
    result = answer("When will my refund reach my payment method?", INDEX,
                    FakeGenerator(invent="You also receive a 10% discount code."))
    report = check(result, CHUNKS)
    assert report.uncited == ["You also receive a 10% discount code."]
    assert report.supported == report.claims - 1


def test_missing_citations_are_caught_in_code():
    report = check(answer("Is standard delivery free for my order?", INDEX, FakeGenerator(drop_citations=True)), CHUNKS)
    assert report.uncited and report.supported == 0


def test_a_citation_of_the_wrong_chunk_is_not_support():
    result = answer("Are delivery costs refunded if I return part of the order?", INDEX, FakeGenerator(cite_wrong_chunk=True))
    report = check(result, CHUNKS)
    assert "Delivery costs are refunded only when the whole order is returned." in report.unsupported_with_citation


def test_an_absolute_claim_contradicting_the_source_is_unsupported():
    source = ["Delivery costs are refunded only when the whole order is returned."]
    assert not supported("Delivery costs are always refunded.", source)
    assert supported("Delivery costs are refunded when the whole order is returned.", source)


# ---------------------------------------------------------------- metamorphic relations

def test_the_order_of_documents_in_the_index_does_not_change_answers():
    shuffled = list(DOCUMENTS)
    random.Random(5).shuffle(shuffled)
    other = build(shuffled)
    for question in QUESTIONS:
        first = answer(question["question"], INDEX, FakeGenerator(), tenant=question["tenant"])
        second = answer(question["question"], other, FakeGenerator(), tenant=question["tenant"])
        assert (first.retrieved, first.text) == (second.retrieved, second.text), question["question"]


def test_the_order_of_chunks_in_the_context_does_not_change_the_claims():
    context = [hit.chunk for hit in INDEX.search("Are delivery costs refunded if I return part of the order?")]
    forward = FakeGenerator().generate("Are delivery costs refunded if I return part of the order?", context)
    backward = FakeGenerator().generate("Are delivery costs refunded if I return part of the order?", context[::-1])
    assert {claim.text for claim in forward} == {claim.text for claim in backward}


def test_case_and_punctuation_do_not_change_retrieval():
    for question in QUESTIONS:
        variant = question["question"].upper().replace("?", " ?!")
        original = [hit.chunk.id for hit in INDEX.search(question["question"], tenant=question["tenant"])]
        assert [hit.chunk.id for hit in INDEX.search(variant, tenant=question["tenant"])] == original


def test_another_customer_cannot_get_an_answer_from_a_private_ticket():
    result = answer("What happened to order A-1042?", INDEX, FakeGenerator(), tenant="customer-taras")
    assert "ticket-olena#0" not in result.retrieved and "approved" not in result.text


def test_command_line(capsys):
    assert main(["rag_pipeline.py", str(HERE / "data" / "documents.json"), str(HERE / "data" / "questions.jsonl")]) == 0
    out = capsys.readouterr().out
    assert "false abstention                       1" in out
    assert "claims supported by their citations: 13/13, uncited claims: 0" in out
