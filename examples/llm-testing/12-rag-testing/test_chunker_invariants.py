from hypothesis import given, settings
from hypothesis import strategies as st

from chunker import chunk_document, sections, sentences

words = st.text(alphabet="abcdefghij", min_size=1, max_size=8)
sentence = st.lists(words, min_size=1, max_size=40).map(lambda parts: " ".join(parts).capitalize() + ".")
# Sentences are unique within a section, so that "shared by neighbours" can be checked by text;
# repeated sentences have their own test below.
section = st.tuples(st.text(alphabet="ABCDEFGH", min_size=1, max_size=6), st.lists(sentence, min_size=1, max_size=8, unique=True))
documents = st.lists(section, min_size=1, max_size=4, unique_by=lambda item: item[0]).map(
    lambda parts: "\n\n".join(f"# {title}\n" + " ".join(body) for title, body in parts))


@settings(max_examples=150)
@given(documents, st.integers(min_value=3, max_value=30), st.integers(min_value=0, max_value=2))
def test_chunking_invariants_hold_for_any_document(text, max_words, overlap):
    chunks = chunk_document({"id": "doc", "text": text}, max_words=max_words, overlap=overlap)
    by_section = {title: sentences(body) for title, body in sections(text)}

    # no sentence is lost
    for title, parts in by_section.items():
        for part in parts:
            assert any(part in chunk.sentences and chunk.section == title for chunk in chunks), part
    for chunk in chunks:
        # chunks never cross a section boundary
        assert all(part in by_section[chunk.section] for part in chunk.sentences)
        # size limit, except a single sentence that is longer than the limit on its own
        assert len(chunk.text.split()) <= max_words or len(chunk.sentences) == 1
    # unique IDs, and neighbours share at most `overlap` sentences
    assert len({chunk.id for chunk in chunks}) == len(chunks)
    for first, second in zip(chunks, chunks[1:]):
        if first.section == second.section:
            assert len(set(first.sentences) & set(second.sentences)) <= overlap


def test_a_sentence_longer_than_the_limit_is_kept_whole():
    long_sentence = " ".join(["word"] * 50) + "."
    chunks = chunk_document({"id": "doc", "text": f"# Terms\n{long_sentence} Short one."}, max_words=20)
    assert chunks[0].sentences == (long_sentence,)
    assert chunks[-1].sentences[-1] == "Short one."


def test_a_repeated_sentence_is_kept_every_time_it_occurs():
    chunks = chunk_document({"id": "doc", "text": "# A\nThanks a lot. Thanks a lot."}, max_words=3, overlap=0)
    assert [chunk.sentences for chunk in chunks] == [("Thanks a lot.",), ("Thanks a lot.",)]


def test_text_before_the_first_heading_is_not_lost():
    chunks = chunk_document({"id": "doc", "text": "Intro sentence.\n# Returns\nReturns are accepted."})
    assert [chunk.section for chunk in chunks] == ["", "Returns"]


def test_metadata_travels_with_every_chunk():
    chunks = chunk_document({"id": "ticket-1", "tenant": "customer-1", "valid_from": "2026-10-01", "text": "# T\nA. B."})
    assert all(chunk.tenant == "customer-1" and chunk.valid_from == "2026-10-01" and chunk.document == "ticket-1"
               for chunk in chunks)


def test_an_empty_document_has_no_chunks():
    assert chunk_document({"id": "doc", "text": ""}) == []
