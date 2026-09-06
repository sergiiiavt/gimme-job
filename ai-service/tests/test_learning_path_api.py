from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from gimmejob_ai.main import create_app
from gimmejob_ai.schemas import (
    AssistantResponse,
    LearningMap,
    LearningMapNode,
    TraceRetrievalResult,
    TraceTokenUsage,
    WorkflowStep,
)
from gimmejob_ai.settings import Settings


class _FakeLearningAdvisor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def answer(self, messages, session_id: str, request_id: str):
        return (
            AssistantResponse(
                answer="Repository-grounded path",
                sources=["python-interview/python-parallelism"],
                learning_map=LearningMap(
                    title="Python parallelism",
                    nodes=[
                        LearningMapNode(
                            id="parallelism",
                            title="Parallelism",
                            summary="Learn processes and their trade-offs.",
                            kind="concept",
                            source_path="python-interview/python-parallelism",
                            duration_minutes=30,
                        )
                    ],
                ),
            ),
            True,
            "repository",
            [
                WorkflowStep(
                    id="retrieve",
                    label="Retrieve canonical RAG context",
                    detail="Found one material.",
                    duration_ms=12.5,
                    input={"query": "Python parallelism", "limit": 8},
                    output={"strategy": "vectorize", "result_count": 1},
                    retrieval_results=[
                        TraceRetrievalResult(
                            title="Python parallelism",
                            kind="question",
                            score=0.92,
                            source_path="python-interview/python-parallelism",
                            excerpt="Processes provide CPU parallelism.",
                        )
                    ],
                    token_usage=TraceTokenUsage(
                        input_tokens=100,
                        output_tokens=25,
                        total_tokens=125,
                    ),
                )
            ],
            48.25,
            "https://cloud.langfuse.com/project/example/traces/trace-1",
        )


class _FailingLearningAdvisor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def answer(self, messages, session_id: str, request_id: str):
        raise RuntimeError("provider secret details must not escape")


class LearningPathApiTests(unittest.TestCase):
    @staticmethod
    def _settings(content_root: Path) -> Settings:
        return Settings(
            environment="test",
            content_root=content_root,
            openai_api_key=SecretStr("openai-test-key"),
            service_token=SecretStr("test-token"),
            rag_url="http://localhost/internal/rag/search",
            rag_service_token=SecretStr("rag-test-token"),
        )

    def test_learning_path_requires_bearer_token(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _FakeLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path",
                json={"messages": [{"role": "user", "content": "Python parallelism"}]},
            )

            self.assertEqual(response.status_code, 401)

    def test_learning_path_requires_final_user_message(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _FakeLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "assistant", "content": "Previous answer"}]},
            )

            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["detail"], "The final message must have role 'user'.")

    def test_learning_path_returns_rich_snake_case_trace_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _FakeLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path",
                headers={"Authorization": "Bearer test-token"},
                json={
                    "session_id": "learning-session",
                    "messages": [{"role": "user", "content": "Python parallelism"}],
                },
            )

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["session_id"], "learning-session")
            self.assertEqual(body["orchestration"], "langgraph")
            self.assertEqual(body["retrieval_mode"], "repository")
            self.assertEqual(body["total_duration_ms"], 48.25)
            self.assertEqual(
                body["langfuse_trace_url"],
                "https://cloud.langfuse.com/project/example/traces/trace-1",
            )

            step = body["workflow_steps"][0]
            self.assertEqual(step["id"], "retrieve")
            self.assertEqual(step["duration_ms"], 12.5)
            self.assertEqual(step["input"]["query"], "Python parallelism")
            self.assertEqual(step["output"]["strategy"], "vectorize")
            self.assertEqual(step["retrieval_results"][0]["score"], 0.92)
            self.assertEqual(step["token_usage"]["total_tokens"], 125)

            node = body["response"]["learning_map"]["nodes"][0]
            self.assertEqual(node["source_path"], "python-interview/python-parallelism")
            self.assertEqual(node["duration_minutes"], 30)
            self.assertTrue(body["langfuse_tracing"])

    def test_learning_path_runtime_failure_returns_renderable_safe_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _FailingLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "user", "content": "Python parallelism"}]},
            )

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["retrieval_mode"], "general")
            self.assertFalse(body["langfuse_tracing"])
            self.assertIsNone(body["langfuse_trace_url"])
            self.assertEqual(body["total_duration_ms"], 0.0)
            self.assertEqual(body["workflow_steps"][0]["id"], "runtime_fallback")
            self.assertEqual(body["response"]["learning_map"]["title"], "Python parallelism")
            self.assertEqual(len(body["response"]["learning_map"]["nodes"]), 1)
            self.assertEqual(body["response"]["sources"], [])
            self.assertNotIn("secret details", response.text)

    def test_learning_path_runtime_failure_localizes_ukrainian_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _FailingLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "user", "content": "Паралелізм у Python"}]},
            )

            self.assertEqual(response.status_code, 200)
            self.assertIn("AI-генерація тимчасово недоступна", response.json()["response"]["answer"])


if __name__ == "__main__":
    unittest.main()
