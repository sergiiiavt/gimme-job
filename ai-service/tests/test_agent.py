from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pydantic import SecretStr

from gimmejob_ai.agent import AssistantAgent, build_search_tool
from gimmejob_ai.retrieval import RetrievalHit, RetrievalResult
from gimmejob_ai.schemas import AssistantResponse, ChatMessage
from gimmejob_ai.settings import Settings, langfuse_configured


class _FakeAgentRuntime:
    def __init__(self, structured_response: AssistantResponse) -> None:
        self.structured_response = structured_response
        self.invocations: list[tuple[dict[str, object], dict[str, object]]] = []

    async def ainvoke(self, payload: dict[str, object], config: dict[str, object]):
        self.invocations.append((payload, config))
        return {"structured_response": self.structured_response}


class _FakeRetriever:
    def __init__(self, result: RetrievalResult) -> None:
        self.result = result
        self.queries: list[tuple[str, str, int]] = []

    async def search(self, query: str, language: str, limit: int = 8) -> RetrievalResult:
        self.queries.append((query, language, limit))
        return self.result


class AgentTests(unittest.IsolatedAsyncioTestCase):
    def _settings(self, content_root: Path) -> Settings:
        return Settings(
            environment="test",
            content_root=content_root,
            openai_api_key=SecretStr("test-key"),
            service_token=SecretStr("service-token"),
        )

    async def test_search_tool_uses_canonical_rag_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            result = RetrievalResult(
                strategy="vectorize",
                embedding_model="@cf/baai/bge-m3",
                hits=(
                    RetrievalHit(
                        id="l:1",
                        ref_id="boundary-values",
                        kind="learning",
                        title="Boundary value analysis",
                        text="Boundary value analysis checks values around boundaries.",
                        score=0.91,
                        source_path="qa-fundamentals/boundary-values",
                        route="/reference/qa-fundamentals",
                    ),
                ),
            )
            retriever = _FakeRetriever(result)
            tool = build_search_tool(self._settings(Path(temporary_directory)), retriever=retriever)

            response = await tool.ainvoke({"query": "boundary value", "language": "en", "limit": 3})

            self.assertEqual(response["query"], "boundary value")
            self.assertEqual(response["retrieval"], "vectorize")
            self.assertEqual(response["embedding_model"], "@cf/baai/bge-m3")
            self.assertEqual(response["results"][0]["source_path"], "qa-fundamentals/boundary-values")
            self.assertEqual(retriever.queries, [("boundary value", "en", 3)])

    def test_langfuse_configuration_requires_both_keys(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(langfuse_configured())
        with patch.dict(os.environ, {"LANGFUSE_PUBLIC_KEY": "pk"}, clear=True):
            self.assertFalse(langfuse_configured())
        with patch.dict(
            os.environ,
            {"LANGFUSE_PUBLIC_KEY": "pk", "LANGFUSE_SECRET_KEY": "sk"},
            clear=True,
        ):
            self.assertTrue(langfuse_configured())

    async def test_answer_passes_session_metadata_and_structured_response(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            expected = AssistantResponse(
                answer="Use boundary values around each equivalence partition.",
                sources=["qa-fundamentals/bva"],
            )
            runtime = _FakeAgentRuntime(expected)
            assistant = AssistantAgent.__new__(AssistantAgent)
            assistant.settings = settings
            assistant.agent = runtime

            with patch("gimmejob_ai.agent.langfuse_configured", return_value=False):
                response, traced = await assistant.answer(
                    messages=[ChatMessage(role="user", content="Explain BVA")],
                    session_id="session-123",
                    request_id="request-456",
                )

            self.assertEqual(response, expected)
            self.assertFalse(traced)
            payload, config = runtime.invocations[0]
            self.assertEqual(payload["messages"][0]["content"], "Explain BVA")
            metadata = config["metadata"]
            self.assertEqual(metadata["request_id"], "request-456")
            self.assertEqual(metadata["langfuse_session_id"], "session-123")
            self.assertIn("gimmejob-ai", metadata["langfuse_tags"])

    async def test_answer_validates_mapping_structured_response(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))

            class MappingRuntime:
                async def ainvoke(self, payload, config):
                    return {
                        "structured_response": {
                            "answer": "Mapped response",
                            "cards": [],
                            "sources": [],
                            "suggested_prompts": [],
                        }
                    }

            assistant = AssistantAgent.__new__(AssistantAgent)
            assistant.settings = settings
            assistant.agent = MappingRuntime()
            with patch("gimmejob_ai.agent.langfuse_configured", return_value=False):
                response, traced = await assistant.answer(
                    messages=[ChatMessage(role="user", content="Hello")],
                    session_id="session",
                    request_id="request",
                )

            self.assertEqual(response.answer, "Mapped response")
            self.assertFalse(traced)


if __name__ == "__main__":
    unittest.main()
