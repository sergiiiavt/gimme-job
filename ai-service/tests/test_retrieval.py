from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from pydantic import SecretStr

from gimmejob_ai.retrieval import CanonicalRagClient
from gimmejob_ai.settings import Settings


class _FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = json.dumps(payload).encode("utf-8")

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

    async def test_client_maps_canonical_routes_to_ui_safe_source_keys(self) -> None:
        payload = {
            "ok": True,
            "retrieval": "vectorize",
            "embeddingModel": "@cf/baai/bge-m3",
            "results": [
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
            ],
        }
        captured_headers: dict[str, str] = {}

        def fake_urlopen(request, timeout):
            captured_headers.update(dict(request.header_items()))
            return _FakeResponse(payload)

        client = CanonicalRagClient(self._settings())
        with patch("gimmejob_ai.retrieval.urlopen", side_effect=fake_urlopen):
            result = await client.search("Python parallelism", "en", limit=8)

        self.assertEqual(result.strategy, "vectorize")
        self.assertEqual(result.hits[0].source_path, "python-interview/parallelism")
        self.assertEqual(result.hits[1].source_path, "python-learning/concurrency")
        self.assertEqual(captured_headers["X-gimmejob-rag-token"], "rag-token")

    def test_production_client_rejects_plain_http(self) -> None:
        settings = Settings(
            environment="production",
            rag_url="http://gimme-job.com/internal/rag/search",
            rag_service_token=SecretStr("rag-token"),
        )
        with self.assertRaises(ValueError):
            CanonicalRagClient(settings)

    def test_client_requires_complete_rag_configuration(self) -> None:
        settings = Settings(environment="test", rag_url="http://localhost/internal/rag/search")
        with self.assertRaises(ValueError):
            CanonicalRagClient(settings)


if __name__ == "__main__":
    unittest.main()
