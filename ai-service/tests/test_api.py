from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from pydantic import SecretStr

from gimmejob_ai.main import create_app
from gimmejob_ai.settings import Settings


class ApiTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
