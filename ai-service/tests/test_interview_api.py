from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from gimmejob_ai.main import create_app
from gimmejob_ai.schemas import AssistantResponse, InterviewEvaluation
from gimmejob_ai.settings import Settings


class _FakeAssistant:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def answer(self, messages, session_id: str, request_id: str):
        return AssistantResponse(answer="ok"), False


class _FakeEvaluator:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def evaluate(self, *, question, answer, language, session_id: str, request_id: str):
        return (
            InterviewEvaluation(
                question_id=question.id,
                score=78,
                rating="good",
                feedback="Correct core idea; add a concrete example.",
                strengths=["core idea"],
                gaps=["example"],
                follow_up_question="How would you apply this in CI?",
                recommended_topics=[question.category],
                reference_answer=question.reference_answer(language),
                strong_answer_signals=question.answer_signals(language),
            ),
            True,
        )


class InterviewApiTests(unittest.TestCase):
    def _write_catalog(self, root: Path) -> None:
        directory = root / "interview"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "sample.json").write_text(
            json.dumps(
                {
                    "questions": [
                        {
                            "id": "fixture-scope",
                            "level": "Middle",
                            "category": "Pytest",
                            "question": "What fixture scopes does pytest support?",
                            "shortAnswer": "Function, class, module, package and session.",
                            "strongAnswerSignals": ["function", "session", "lifetime"],
                            "prevalence": "Common",
                            "kind": "Theory",
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )

    def test_start_returns_question_without_answer_key(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)
            settings = Settings(
                environment="test",
                content_root=root,
                service_token=SecretStr("test-token"),
            )
            client = TestClient(create_app(settings))

            response = client.post(
                "/v1/interviews/start",
                headers={"Authorization": "Bearer test-token"},
                json={"question_count": 5, "track": "qa", "language": "en"},
            )

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["selected_count"], 1)
            self.assertEqual(body["questions"][0]["id"], "fixture-scope")
            self.assertNotIn("shortAnswer", response.text)
            self.assertNotIn("strongAnswerSignals", response.text)

    def test_start_rejects_empty_filter_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)
            settings = Settings(
                environment="test",
                content_root=root,
                service_token=SecretStr("test-token"),
            )
            client = TestClient(create_app(settings))

            response = client.post(
                "/v1/interviews/start",
                headers={"Authorization": "Bearer test-token"},
                json={"levels": ["Senior"]},
            )

            self.assertEqual(response.status_code, 422)

    def test_evaluate_returns_structured_feedback_and_reference_after_answer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)
            settings = Settings(
                environment="test",
                content_root=root,
                openai_api_key=SecretStr("openai-test-key"),
                service_token=SecretStr("test-token"),
            )
            with (
                patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant),
                patch("gimmejob_ai.main.InterviewEvaluator", _FakeEvaluator),
            ):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/interviews/evaluate",
                headers={"Authorization": "Bearer test-token"},
                json={
                    "session_id": "session-1",
                    "track": "qa",
                    "language": "en",
                    "question_id": "fixture-scope",
                    "answer": "Function and session control lifetime.",
                },
            )

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["session_id"], "session-1")
            self.assertEqual(body["evaluation"]["score"], 78)
            self.assertEqual(body["evaluation"]["question_id"], "fixture-scope")
            self.assertIn("Function, class, module", body["evaluation"]["reference_answer"])
            self.assertTrue(body["langfuse_tracing"])

    def test_evaluate_does_not_accept_unknown_question(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._write_catalog(root)
            settings = Settings(
                environment="test",
                content_root=root,
                openai_api_key=SecretStr("openai-test-key"),
                service_token=SecretStr("test-token"),
            )
            with (
                patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant),
                patch("gimmejob_ai.main.InterviewEvaluator", _FakeEvaluator),
            ):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/interviews/evaluate",
                headers={"Authorization": "Bearer test-token"},
                json={
                    "session_id": "session-1",
                    "question_id": "does-not-exist",
                    "answer": "Anything",
                },
            )

            self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
