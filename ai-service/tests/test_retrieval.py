from __future__ import annotations

import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

from pydantic import SecretStr

from gimmejob_ai.retrieval import CanonicalRagClient
from gimmejob_ai.settings import Settings


class _FakeResponse:
    def __init__(self, payload: dict[str, object] | bytes) -> None:
        self.payload = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self, _limit: int) -> bytes:
        return self.payload


class RetrievalClientTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _settings(url: str = "http://localhost/internal/rag/search") -> Settings:
        return Settings(
            environment="test",
            openai_api_key=SecretStr("openai-key"),
            service_token=SecretStr("service-token"),
            rag_url=url,
            rag_service_token=SecretStr("rag-token"),
        )

    @staticmethod
    def _payload(results: list[dict[str, object]] | None = None) -> dict[str, object]:
        return {
            "ok": True,
            "retrieval": "vectorize",
            "embeddingModel": "@cf/baai/bge-m3",
            "results": results or [],
        }

    async def test_client_maps_canonical_routes_to_ui_safe_source_keys(self) -> None:
        payload = self._payload(
            [
                {
                    "id": "q:python",
                    "refId": "parallelism",
                    "kind": "question",
                    "title": "Python parallelism",
                    "text": "Processes can execute CPU work in parallel.",
                    "score": 0.9,
                    "sourcePath": "/interview/python",
                    "route": "/interview/python",
                    "metadata": {"track": "python"},
                },
                {
                    "id": "q:qa",
                    "refId": "test-design",
                    "kind": "question",
                    "title": "Test design",
                    "text": "Choose techniques based on the test basis and risks.",
                    "score": 0.86,
                    "sourcePath": "/interview",
                    "route": "/interview",
                    "metadata": {"track": "qa"},
                },
                {
                    "id": "l:python",
                    "refId": "concurrency",
                    "kind": "learning",
                    "title": "Concurrency",
                    "text": "Compare threads, asyncio and processes.",
                    "score": 0.84,
                    "sourcePath": "/learn/programming?topic=concurrency",
                    "route": "/learn/programming",
                    "metadata": {"catalog": "python"},
                },
            ]
        )
        captured_headers: dict[str, str] = {}

        def fake_urlopen(request, timeout):
            captured_headers.update(dict(request.header_items()))
            return _FakeResponse(payload)

        client = CanonicalRagClient(self._settings())
        with patch("gimmejob_ai.retrieval.urlopen", side_effect=fake_urlopen):
            result = await client.search("Python parallelism", "en", limit=20)

        self.assertEqual(result.strategy, "vectorize")
        self.assertEqual(result.hits[0].source_path, "python-interview/parallelism")
        self.assertEqual(result.hits[1].source_path, "interview/test-design")
        self.assertEqual(result.hits[2].source_path, "python-learning/concurrency")
        self.assertEqual(captured_headers["X-gimmejob-rag-token"], "rag-token")
        self.assertEqual(captured_headers["User-agent"], "curl/8.10.1 GimmeJob-AI/1.0")

    async def test_client_rejects_unallowlisted_learning_route(self) -> None:
        payload = self._payload(
            [
                {
                    "id": "l:unknown",
                    "refId": "unknown",
                    "kind": "learning",
                    "title": "Unknown",
                    "text": "Unknown learning material.",
                    "score": 0.7,
                    "route": "/learn/not-allowed",
                }
            ]
        )
        client = CanonicalRagClient(self._settings())
        with (
            patch("gimmejob_ai.retrieval.urlopen", return_value=_FakeResponse(payload)),
            self.assertRaises(ValueError),
        ):
            await client.search("unknown", "en")

    async def test_client_rejects_invalid_json_and_unsuccessful_payloads(self) -> None:
        client = CanonicalRagClient(self._settings())
        with patch("gimmejob_ai.retrieval.urlopen", return_value=_FakeResponse(b"{")):
            with self.assertRaisesRegex(RuntimeError, "invalid JSON"):
                await client.search("query", "en")

        with patch("gimmejob_ai.retrieval.urlopen", return_value=_FakeResponse({"ok": False})):
            with self.assertRaisesRegex(RuntimeError, "unsuccessful"):
                await client.search("query", "en")

    async def test_client_translates_http_and_network_failures(self) -> None:
        client = CanonicalRagClient(self._settings())
        http_error = HTTPError(client.url, 503, "Unavailable", hdrs=None, fp=None)
        with patch("gimmejob_ai.retrieval.urlopen", side_effect=http_error):
            with self.assertRaisesRegex(RuntimeError, "HTTP 503"):
                await client.search("query", "en")

        with patch("gimmejob_ai.retrieval.urlopen", side_effect=TimeoutError("timeout")):
            with self.assertRaisesRegex(RuntimeError, "unavailable"):
                await client.search("query", "en")

    def test_production_client_rejects_plain_http(self) -> None:
        settings = Settings(
            environment="production",
            rag_url="http://gimme-job.com/internal/rag/search",
            rag_service_token=SecretStr("rag-token"),
        )
        with self.assertRaises(ValueError):
            CanonicalRagClient(settings)

    def test_client_rejects_credentials_and_fragments_in_rag_url(self) -> None:
        for url in (
            "http://user:pass@localhost/internal/rag/search",
            "http://localhost/internal/rag/search#fragment",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                CanonicalRagClient(self._settings(url))

    def test_client_requires_complete_rag_configuration(self) -> None:
        settings = Settings(environment="test", rag_url="http://localhost/internal/rag/search")
        with self.assertRaises(ValueError):
            CanonicalRagClient(settings)


if __name__ == "__main__":
    unittest.main()
