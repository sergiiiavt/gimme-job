from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from gimmejob_ai.main import create_app
from gimmejob_ai.schemas import AssistantResponse, LearningAdvisorResponse, LearningMap, LearningMapNode, WorkflowStep
from gimmejob_ai.settings import Settings


class _StreamCapableLearningAdvisor:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings


async def _successful_stream(advisor, messages, session_id: str, request_id: str):
    yield {
        "type": "trace.start",
        "sequence": 1,
        "elapsed_ms": 0.1,
        "request_id": request_id,
        "session_id": session_id,
        "model": advisor.settings.openai_model,
        "prompt": messages[-1].content,
    }
    yield {
        "type": "node.start",
        "sequence": 2,
        "elapsed_ms": 0.2,
        "node_id": "contextualize_query",
        "label": "Contextualize query",
    }
    result = LearningAdvisorResponse(
        request_id=request_id,
        session_id=session_id,
        model=advisor.settings.openai_model,
        langfuse_tracing=False,
        retrieval_mode="repository",
        total_duration_ms=12.5,
        workflow_steps=[
            WorkflowStep(
                id="contextualize",
                label="Contextualize query",
                detail="Used the current prompt as the retrieval query.",
                duration_ms=1.0,
                input={"current_prompt": messages[-1].content},
                output={"retrieval_query": messages[-1].content},
            )
        ],
        response=AssistantResponse(
            answer="Live repository answer",
            sources=["python-interview/python-parallelism"],
            learning_map=LearningMap(
                title="Python parallelism",
                nodes=[
                    LearningMapNode(
                        id="parallelism",
                        title="Parallelism",
                        summary="Understand execution models.",
                        kind="concept",
                        source_path="python-interview/python-parallelism",
                    )
                ],
            ),
        ),
    )
    yield {
        "type": "trace.complete",
        "sequence": 3,
        "elapsed_ms": 12.5,
        "request_id": request_id,
        "retrieval_mode": "repository",
        "total_duration_ms": 12.5,
        "workflow_steps": 1,
    }
    yield {
        "type": "result",
        "sequence": 4,
        "elapsed_ms": 12.5,
        "payload": result.model_dump(),
    }


async def _failing_stream(advisor, messages, session_id: str, request_id: str):
    if False:
        yield {}
    raise RuntimeError("provider secret details must not escape")


class LearningPathStreamApiTests(unittest.TestCase):
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

    def test_stream_requires_bearer_token(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _StreamCapableLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path/stream",
                json={"messages": [{"role": "user", "content": "Python parallelism"}]},
            )
            self.assertEqual(response.status_code, 401)

    def test_stream_requires_final_user_message(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _StreamCapableLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path/stream",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "assistant", "content": "Previous answer"}]},
            )
            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["detail"], "The final message must have role 'user'.")

    def test_stream_returns_incremental_sse_and_final_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with (
                patch("gimmejob_ai.main.LearningAdvisorGraph", _StreamCapableLearningAdvisor),
                patch("gimmejob_ai.main.stream_learning_advisor", _successful_stream),
            ):
                client = TestClient(create_app(settings))
                with client.stream(
                    "POST",
                    "/v1/learning-path/stream",
                    headers={"Authorization": "Bearer test-token"},
                    json={
                        "session_id": "learning-session",
                        "messages": [{"role": "user", "content": "Python parallelism"}],
                    },
                ) as response:
                    body = "".join(response.iter_text())
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue((response.headers.get("content-type") or "").startswith("text/event-stream"))
                    self.assertEqual(response.headers.get("cache-control"), "no-store")
                    self.assertEqual(response.headers.get("x-accel-buffering"), "no")
                    self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")

            self.assertIn('"type":"trace.start"', body)
            self.assertIn('"type":"node.start"', body)
            self.assertIn('"type":"trace.complete"', body)
            self.assertIn('"type":"result"', body)
            self.assertIn('"session_id":"learning-session"', body)
            self.assertIn('"answer":"Live repository answer"', body)
            self.assertLess(body.index('"type":"trace.start"'), body.index('"type":"result"'))

    def test_stream_failure_returns_safe_fallback_inside_sse(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with (
                patch("gimmejob_ai.main.LearningAdvisorGraph", _StreamCapableLearningAdvisor),
                patch("gimmejob_ai.main.stream_learning_advisor", _failing_stream),
            ):
                client = TestClient(create_app(settings))
                response = client.post(
                    "/v1/learning-path/stream",
                    headers={"Authorization": "Bearer test-token"},
                    json={"messages": [{"role": "user", "content": "Python parallelism"}]},
                )

            self.assertEqual(response.status_code, 200)
            self.assertIn('"type":"trace.error"', response.text)
            self.assertIn('"type":"result"', response.text)
            self.assertIn('"id":"runtime_fallback"', response.text)
            self.assertIn("AI generation is temporarily unavailable", response.text)
            self.assertNotIn("provider secret", response.text)
            self.assertNotIn("secret details", response.text)


if __name__ == "__main__":
    unittest.main()
