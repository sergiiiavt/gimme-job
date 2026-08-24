from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from gimmejob_ai.main import create_app
from gimmejob_ai.schemas import AssistantResponse
from gimmejob_ai.settings import Settings


class _FakeAssistant:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def answer(self, messages, session_id: str, request_id: str):
        return (
            AssistantResponse(
                answer="Short answer",
                sources=["qa-fundamentals/example.md"],
                suggested_prompts=["Quiz me"],
            ),
            True,
        )


class _FailingAssistant:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def answer(self, messages, session_id: str, request_id: str):
        raise RuntimeError("provider secret details must not escape")


class ApiTests(unittest.TestCase):
    def _configured_settings(self, content_root: Path) -> Settings:
        return Settings(
            environment="test",
            content_root=content_root,
            openai_api_key=SecretStr("openai-test-key"),
            service_token=SecretStr("test-token"),
            rag_url="http://localhost/internal/rag/search",
            rag_service_token=SecretStr("rag-test-token"),
        )

    def test_health_is_degraded_without_openai_key(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = Settings(
                environment="test",
                content_root=Path(temporary_directory),
                service_token=SecretStr("test-token"),
            )
            client = TestClient(create_app(settings))

            response = client.get("/health")

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["status"], "degraded")
            self.assertFalse(body["openai_configured"])
            self.assertTrue(body["service_auth_configured"])
            self.assertFalse(body["rag_configured"])

    def test_health_is_ok_when_required_runtime_configuration_exists(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._configured_settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant):
                client = TestClient(create_app(settings))

            response = client.get("/health")

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["status"], "ok")
            self.assertTrue(body["openai_configured"])
            self.assertTrue(body["service_auth_configured"])
            self.assertTrue(body["rag_configured"])
            self.assertTrue(body["content_available"])

    def test_chat_requires_bearer_token_before_provider_call(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = Settings(
                environment="test",
                content_root=Path(temporary_directory),
                service_token=SecretStr("test-token"),
            )
            client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )

            self.assertEqual(response.status_code, 401)

    def test_chat_rejects_bad_bearer_token(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._configured_settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                headers={"Authorization": "Bearer wrong-token"},
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )

            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json()["detail"], "Invalid bearer token.")

    def test_chat_requires_service_auth_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = Settings(
                environment="test",
                content_root=Path(temporary_directory),
                openai_api_key=SecretStr("openai-test-key"),
            )
            with patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                headers={"Authorization": "Bearer anything"},
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )

            self.assertEqual(response.status_code, 503)

    def test_chat_requires_canonical_rag_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = Settings(
                environment="test",
                content_root=Path(temporary_directory),
                openai_api_key=SecretStr("openai-test-key"),
                service_token=SecretStr("test-token"),
            )
            client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )

            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()["detail"], "Canonical RAG is not configured.")

    def test_chat_requires_final_user_message(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._configured_settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "assistant", "content": "Previous answer"}]},
            )

            self.assertEqual(response.status_code, 422)
            self.assertEqual(response.json()["detail"], "The final message must have role 'user'.")

    def test_chat_returns_structured_response_and_session(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._configured_settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.AssistantAgent", _FakeAssistant):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                headers={"Authorization": "Bearer test-token"},
                json={
                    "session_id": "session-123",
                    "messages": [{"role": "user", "content": "Explain BVA"}],
                },
            )

            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body["session_id"], "session-123")
            self.assertEqual(body["response"]["answer"], "Short answer")
            self.assertEqual(body["response"]["suggested_prompts"], ["Quiz me"])
            self.assertTrue(body["langfuse_tracing"])
            self.assertTrue(body["request_id"])

    def test_provider_failure_is_sanitized(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = self._configured_settings(Path(temporary_directory))
            with patch("gimmejob_ai.main.AssistantAgent", _FailingAssistant):
                client = TestClient(create_app(settings))

            response = client.post(
                "/v1/chat",
                headers={"Authorization": "Bearer test-token"},
                json={"messages": [{"role": "user", "content": "Hello"}]},
            )

            self.assertEqual(response.status_code, 502)
            self.assertEqual(response.json()["detail"], "AI provider request failed.")
            self.assertNotIn("secret details", response.text)


if __name__ == "__main__":
    unittest.main()
