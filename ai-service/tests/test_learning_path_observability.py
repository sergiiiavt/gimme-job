from __future__ import annotations

import unittest
from dataclasses import replace
from unittest.mock import AsyncMock, patch

from gimmejob_ai.learning_path import LearningAdvisorGraph
from gimmejob_ai.retrieval import RetrievalDiagnostics, RetrievalHit, RetrievalResult


class _CountingRetriever:
    def __init__(self) -> None:
        self.calls = 0

    async def search(self, query: str, language: str, limit: int = 8) -> RetrievalResult:
        self.calls += 1
        return RetrievalResult(
            strategy="vectorize",
            embedding_model="@cf/baai/bge-m3",
            hits=(
                RetrievalHit(
                    id="q:python",
                    ref_id="parallelism",
                    kind="question",
                    title="Python parallelism",
                    text="Processes can execute CPU work in parallel.",
                    score=0.9,
                    source_path="python-interview/parallelism",
                    route="/interview/python",
                ),
            ),
        )


class _BrokenUpdateObservation:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def update(self, **_kwargs) -> None:
        raise ValueError("observation update failed")


class _BrokenStartLangfuse:
    def start_as_current_observation(self, **_kwargs):
        raise ValueError("observation start failed")


class _BrokenUpdateLangfuse:
    def start_as_current_observation(self, **_kwargs):
        return _BrokenUpdateObservation()


class _FailingRetriever:
    async def search(self, query: str, language: str, limit: int = 8) -> RetrievalResult:
        raise RuntimeError("canonical RAG unavailable")


class LearningAdvisorObservabilityTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _advisor(retriever):
        advisor = LearningAdvisorGraph.__new__(LearningAdvisorGraph)
        advisor.retriever = retriever
        return advisor

    @staticmethod
    def _state() -> dict[str, object]:
        return {
            "query": "Python parallelism",
            "language": "en",
            "workflow_steps": [],
        }

    async def test_shared_hybrid_trace_identifies_the_actual_retrieval_provider(self) -> None:
        retriever = _CountingRetriever()
        base = await retriever.search("Python parallelism", "en")
        diagnostics = RetrievalDiagnostics(
            selected_kinds=("learning", "question"), requested_limit=8, corpus_document_count=6267,
            semantic_available=True, semantic_attempted=True, embedding_input_chars=18,
            embedding_dimension=512, embedding_duration_ms=0, vector_top_k=None, vector_query_duration_ms=0,
            raw_vector_match_count=0, kind_filtered_match_count=0, score_threshold=0.45,
            threshold_passed_match_count=0, fallback_reason="none", lexical_tokens=(), removed_stop_words=(),
            lexical_candidate_count=6267, lexical_scored_count=1, lexical_duration_ms=0, result_diagnostics=(),
        )
        retriever.search = AsyncMock(return_value=replace(base, strategy="hybrid", embedding_model="text-embedding-3-small", diagnostics=diagnostics))
        advisor = self._advisor(retriever)
        with patch("gimmejob_ai.learning_path.langfuse_configured", return_value=False):
            result = await advisor._retrieve_canonical_rag(self._state())
        self.assertEqual(result["retrieval_strategy"], "hybrid")
        decisions = result["workflow_steps"][-1].decisions
        self.assertTrue(any(item.label == "Shared public search" for item in decisions))
        self.assertTrue(any("Typesense" in item.detail for item in decisions))
        self.assertFalse(any(item.label == "Vectorize candidate search" for item in decisions))

    async def test_observation_update_failure_does_not_repeat_retrieval(self) -> None:
        retriever = _CountingRetriever()
        advisor = self._advisor(retriever)

        with (
            patch("gimmejob_ai.learning_path.langfuse_configured", return_value=True),
            patch("gimmejob_ai.learning_path.get_client", return_value=_BrokenUpdateLangfuse()),
        ):
            result = await advisor._retrieve_canonical_rag(self._state())

        self.assertEqual(retriever.calls, 1)
        self.assertEqual(result["retrieval_mode"], "repository")
        self.assertEqual(result["retrieval_result_count"], 1)

    async def test_observation_start_failure_falls_back_to_one_untraced_retrieval(self) -> None:
        retriever = _CountingRetriever()
        advisor = self._advisor(retriever)

        with (
            patch("gimmejob_ai.learning_path.langfuse_configured", return_value=True),
            patch("gimmejob_ai.learning_path.get_client", return_value=_BrokenStartLangfuse()),
        ):
            result = await advisor._retrieve_canonical_rag(self._state())

        self.assertEqual(retriever.calls, 1)
        self.assertEqual(result["retrieval_strategy"], "vectorize")

    async def test_retrieval_error_is_not_swallowed_by_langfuse_fallback(self) -> None:
        advisor = self._advisor(_FailingRetriever())

        with (
            patch("gimmejob_ai.learning_path.langfuse_configured", return_value=True),
            patch("gimmejob_ai.learning_path.get_client", return_value=_BrokenUpdateLangfuse()),
            self.assertRaisesRegex(RuntimeError, "canonical RAG unavailable"),
        ):
            await advisor._retrieve_canonical_rag(self._state())


if __name__ == "__main__":
    unittest.main()
