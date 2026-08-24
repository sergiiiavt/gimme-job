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
                sources=["python-learning/advanced-lessons.json#parallelism"],
                learning_map=LearningMap(
                    title="Python parallelism",
                    nodes=[
                        LearningMapNode(
                            id="parallelism",
                            title="Parallelism",
                            summary="Learn processes and their trade-offs.",
                            kind="concept",
                            source_path="python-learning/advanced-lessons.json#parallelism",
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
                    label="Retrieve Git materials",
                    detail="Found one material.",
                )
            ],
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

    def test_learning_path_returns_snake_case_workflow_and_map_contract(self) -> None:
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
            self.assertEqual(body["workflow_steps"][0]["id"], "retrieve")
            node = body["response"]["learning_map"]["nodes"][0]
            self.assertEqual(node["source_path"], "python-learning/advanced-lessons.json#parallelism")
            self.assertEqual(node["duration_minutes"], 30)
            self.assertTrue(body["langfuse_tracing"])

    def test_learning_path_provider_failure_is_sanitized(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.LearningAdvisorGraph", _FailingLearningAdvisor):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/learning-path",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "user", "content": "Python parallelism"}]},
            )

            self.assertEqual(response.status_code, 502)
            self.assertEqual(response.json()["detail"], "AI provider request failed.")
            self.assertNotIn("secret details", response.text)


if __name__ == "__main__":
    unittest.main()
