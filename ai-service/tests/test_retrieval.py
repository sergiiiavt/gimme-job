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

    async def test_client_preserves_direct_learning_paths_and_builds_question_deep_links(self) -> None:
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
                    "sourcePath": "/learn/programming?topic=concurrency-models",
                    "route": "/learn/programming",
                    "metadata": {"catalog": "python"},
                },
                {
                    "id": "l:http-status",
                    "refId": "http-foundations#http-status-codes",
                    "kind": "learning",
                    "title": "HTTP status codes",
                    "text": "Status codes communicate request processing results.",
                    "score": 0.82,
                    "sourcePath": "/learn/api?topic=http-foundations&section=http-status-codes",
                    "route": "/learn/api",
                    "metadata": {"catalog": "api-integration"},
                },
                {
                    "id": "l:csharp",
                    "refId": "csharp-methods-parameters#ref-out-and-in",
                    "kind": "learning",
                    "title": "ref, out and in",
                    "text": "C# parameter passing modes.",
                    "score": 0.8,
                    "sourcePath": "/learn/programming?topic=csharp-methods-parameters&section=ref-out-and-in&track=csharp",
                    "route": "/learn/programming",
                    "metadata": {"catalog": "csharp"},
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
        self.assertEqual(result.hits[0].source_path, "/interview/python?question=parallelism")
        self.assertEqual(result.hits[1].source_path, "/interview?question=test-design")
        self.assertEqual(result.hits[2].source_path, "/learn/programming?topic=concurrency-models")
        self.assertEqual(
            result.hits[3].source_path,
            "/learn/api?topic=http-foundations&section=http-status-codes",
        )
        self.assertEqual(
            result.hits[4].source_path,
            "/learn/programming?topic=csharp-methods-parameters&section=ref-out-and-in&track=csharp",
        )
        self.assertEqual(captured_headers["X-gimmejob-rag-token"], "rag-token")
        self.assertEqual(captured_headers["User-agent"], "curl/8.10.1 GimmeJob-AI/1.0")

    async def test_client_accepts_future_canonical_learning_routes_without_an_ai_allowlist(self) -> None:
        result = {
            "id": "l:future",
            "refId": "future-topic",
            "kind": "learning",
            "title": "Future topic",
            "text": "New Git-backed material.",
            "score": 0.7,
            "sourcePath": "/learn/future-area?topic=future-topic&section=core-concept",
            "route": "/learn/future-area",
        }
        client = CanonicalRagClient(self._settings())
        with patch(
            "gimmejob_ai.retrieval.urlopen",
            return_value=_FakeResponse(self._payload([result])),
        ):
            response = await client.search("future", "en")

        self.assertEqual(
            response.hits[0].source_path,
            "/learn/future-area?topic=future-topic&section=core-concept",
        )

    async def test_client_rejects_unsafe_or_mismatched_learning_paths(self) -> None:
        invalid_results = [
            {
                "id": "l:unsafe-route",
                "refId": "unsafe-route",
                "kind": "learning",
                "title": "Unsafe route",
                "text": "Invalid learning route.",
                "score": 0.7,
                "sourcePath": "/admin?topic=unknown",
                "route": "/admin",
            },
            {
                "id": "l:mismatch",
                "refId": "mismatch",
                "kind": "learning",
                "title": "Mismatch",
                "text": "Mismatched source route.",
                "score": 0.7,
                "sourcePath": "/learn/testing-tools?topic=mismatch",
                "route": "/learn/programming",
            },
            {
                "id": "l:missing-topic",
                "refId": "missing-topic",
                "kind": "learning",
                "title": "Missing topic",
                "text": "Missing direct topic identifier.",
                "score": 0.7,
                "sourcePath": "/learn/programming?track=python",
                "route": "/learn/programming",
            },
            {
                "id": "l:unsupported-query",
                "refId": "unsupported-query",
                "kind": "learning",
                "title": "Unsupported query",
                "text": "Unsupported query key.",
                "score": 0.7,
                "sourcePath": "/learn/programming?topic=python&redirect=https://evil.test",
                "route": "/learn/programming",
            },
        ]
        client = CanonicalRagClient(self._settings())
        for result in invalid_results:
            with self.subTest(result=result["id"]), patch(
                "gimmejob_ai.retrieval.urlopen",
                return_value=_FakeResponse(self._payload([result])),
            ), self.assertRaises(ValueError):
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

        cloudflare_error = HTTPError(
            client.url,
            403,
            "Forbidden",
            hdrs={"cf-ray": "1234567890abcdef-KBP"},
            fp=None,
        )
        with patch("gimmejob_ai.retrieval.urlopen", side_effect=cloudflare_error):
            with self.assertRaisesRegex(
                RuntimeError,
                r"HTTP 403 \(Cloudflare ray 1234567890abcdef-KBP\)",
            ):
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
