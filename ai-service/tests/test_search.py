from __future__ import annotations

import hashlib
import json
import os
import secrets
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit

from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from gimmejob_ai.main import create_app
from gimmejob_ai.search import ALIAS, PublicSearch, SearchRequest, SearchUnavailable, _filters, _fuse
from gimmejob_ai.settings import Settings


def document(identifier="one", title="Pytest fixtures", parent="pytest"):
    return {"id": identifier, "title": title, "body": "Fixture setup teardown", "aliases": "фікстура",
            "title_aliases": "фікстура", "kind": "learning", "language": "en", "parent": parent,
            "canonical": identifier, "technical": []}


def snapshot(documents):
    revision = hashlib.sha256(json.dumps(documents, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return {"revision": revision, "documents": documents}


def not_found():
    return HTTPError("http://localhost", 404, "missing", {}, None)


class MemorySearch(PublicSearch):
    def __init__(self, settings):
        super().__init__(settings)
        self.collections = {}
        self.alias = None
        self.calls = []
        self.import_fail = False

    def _request(self, path, *, method="GET", body=None, timeout=12):
        self.calls.append((path, method, body))
        if path == "/health":
            return {"ok": True}
        if path == f"/aliases/{ALIAS}":
            if method == "PUT":
                self.alias = body["collection_name"]
            if not self.alias:
                raise not_found()
            return {"collection_name": self.alias}
        if path == "/collections":
            if method == "POST":
                self.collections[body["name"]] = {**body, "num_documents": 0, "created_at": len(self.collections)}
                return body
            return list(self.collections.values())
        name = path.split("/")[2]
        if "/import?" in path:
            rows = body.splitlines()
            self.collections[name]["num_documents"] += len(rows)
            return "\n".join(json.dumps({"success": not self.import_fail}) for _ in rows)
        if name not in self.collections:
            raise not_found()
        if method == "DELETE":
            return self.collections.pop(name)
        return self.collections[name]


class SearchTests(unittest.TestCase):
    def test_input_validation_and_protected_tokens(self):
        for fields in ({"query": "x"}, {"query": "xx", "kind": "job"}, {"query": "xx", "limit": 200},
                       {"query": "xx", "language": "invalid"}):
            with self.assertRaises(ValidationError):
                SearchRequest(revision="a" * 64, **fields)
        request = SearchRequest(query="C# C++ .NET HTTP 401 403", revision="a" * 64, kind="learning", language="uk")
        self.assertEqual(_filters(request), "kind:=learning && language:=uk && technical:=cplusplus && technical:=csharp && technical:=dotnet && technical:=status401 && technical:=status403")
        self.assertEqual(_filters(SearchRequest(query="anything", revision="a" * 64)), "")

    def test_fusion_deduplicates_translations_and_diversifies_chapters(self):
        docs = [document(str(index)) for index in range(4)]
        translated = {**docs[0], "id": "uk", "language": "uk"}
        hits = [{"document": doc} for doc in [*docs, translated, document("last", parent="other")]]
        result = _fuse(hits, [{"document": docs[0]}], 12)
        self.assertEqual(result[0]["id"], "0")
        self.assertEqual(len(result), 3)
        self.assertTrue(all(0 < item["score"] <= 1 for item in result))
        self.assertEqual(len(_fuse(hits, [], 1)), 1)
        self.assertEqual(_fuse([], [], 10), [])

    def test_request_transport_and_response_contract(self):
        engine = PublicSearch(Settings())
        with self.assertRaises(SearchUnavailable):
            engine._request("/health")
        engine = PublicSearch(Settings(search_url="http://localhost:8108", search_api_key=SecretStr("private-key")))
        for path, body, data in (("/health", None, '{"ok":true}'), ("/collections", {"x": 1}, '{}'),
                                 ("/documents/import?action=create", "{}", '{"success":true}')):
            response = Mock()
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            response.read.return_value = data.encode()
            with patch("gimmejob_ai.search.urlopen", return_value=response) as opened:
                result = engine._request(path, body=body)
                self.assertIsNotNone(result)
                self.assertEqual(opened.call_args.args[0].get_header("X-typesense-api-key"), "private-key")
        unconfigured = PublicSearch(Settings())
        with self.assertRaises(SearchUnavailable):
            unconfigured._embeddings()
        with patch("gimmejob_ai.search.OpenAIEmbeddings") as embeddings:
            PublicSearch(Settings(openai_api_key=SecretStr("test-key")))._embeddings()
            self.assertEqual(embeddings.call_args.kwargs["dimensions"], 512)

    def test_search_fuses_semantics_and_fails_back_when_embedding_provider_fails(self):
        engine = PublicSearch(Settings())
        health = {"revision": "a" * 64, "semanticAvailable": True}
        engine.health = Mock(return_value=health)
        engine._request = Mock(return_value={"hits": [{"document": document()}]})
        engine._query_embedding = Mock(return_value=(0.1, 0.2))
        request = SearchRequest(query="фікстура", revision="a" * 64, semantic=True)
        self.assertEqual(engine.search(request)["mode"], "hybrid")
        self.assertIn("distance_threshold", engine._request.call_args.args[0])
        engine._query_embedding.side_effect = RuntimeError("private provider error")
        self.assertEqual(engine.search(request)["mode"], "typesense")
        engine.health.return_value = {**health, "semanticAvailable": False}
        self.assertEqual(engine.search(request)["mode"], "typesense")
        self.assertEqual(engine.search(SearchRequest(query="++", revision="a" * 64))["candidates"], [])
        with self.assertRaises(SearchUnavailable):
            engine.search(SearchRequest(query="fixture", revision="b" * 64))
        # Operators and arbitrary filters never pass through the query input.
        engine.search(SearchRequest(query="pytest -foo:=[x]", revision="a" * 64))
        params = parse_qs(urlsplit(engine._request.call_args.args[0]).query)
        self.assertEqual(params["q"], ["pytest foo x"])
        self.assertEqual(params["drop_tokens_threshold"], ["0"])

    def test_query_embeddings_are_cached(self):
        engine = PublicSearch(Settings())
        embeddings = Mock()
        embeddings.embed_query.return_value = [0.1, 0.2]
        engine._embeddings = Mock(return_value=embeddings)
        self.assertEqual(engine._query_embedding("pytest"), (0.1, 0.2))
        engine._query_embedding("pytest")
        embeddings.embed_query.assert_called_once()

    def test_complete_atomic_index_import_cache_reuse_and_retention(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            corpus = path / "snapshot.json"
            docs = [document(), document("two")]
            value = snapshot(docs)
            corpus.write_text(json.dumps(value, ensure_ascii=False))
            engine = MemorySearch(Settings(search_corpus_path=corpus, search_cache_path=path / "cache" / "embeddings.sqlite",
                                           openai_api_key=SecretStr("test-key")))
            embeddings = Mock()
            embeddings.embed_documents.side_effect = lambda texts: [[0.1, 0.2] for _ in texts]
            engine._embeddings = Mock(return_value=embeddings)
            result = engine.index()
            self.assertEqual(result["count"], 2)
            self.assertTrue(result["semanticAvailable"])
            self.assertEqual(result["revision"], value["revision"])
            previous_alias = engine.alias
            self.assertEqual(engine.index(), result)
            self.assertEqual(embeddings.embed_documents.call_count, 1)
            engine._cached_embeddings(docs)
            self.assertEqual(embeddings.embed_documents.call_count, 1)
            docs.append(document("three", title="New title"))
            corpus.write_text(json.dumps(snapshot(docs)))
            engine.index()
            self.assertNotEqual(previous_alias, engine.alias)
            self.assertIn(previous_alias, engine.collections)
            docs.append(document("four", title="Another title"))
            corpus.write_text(json.dumps(snapshot(docs)))
            engine.index()
            self.assertEqual(len(engine.collections), 2)
            self.assertNotIn(previous_alias, engine.collections)

    def test_failed_import_and_invalid_snapshot_never_switch_active_alias(self):
        with tempfile.TemporaryDirectory() as directory:
            corpus = Path(directory) / "snapshot.json"
            corpus.write_text(json.dumps(snapshot([document()])))
            engine = MemorySearch(Settings(search_corpus_path=corpus))
            engine.index()
            original_alias = engine.alias
            new = snapshot([document("new")])
            corpus.write_text(json.dumps(new))
            engine.import_fail = True
            with self.assertRaises(SearchUnavailable):
                engine.index()
            self.assertEqual(engine.alias, original_alias)
            new["revision"] = "invalid"
            corpus.write_text(json.dumps(new))
            with self.assertRaises(ValueError):
                engine.index()
            with self.assertRaises(SearchUnavailable):
                engine._build_collection(original_alias, "a" * 64, [], False)
            engine._request = Mock(side_effect=URLError("offline"))
            with patch("gimmejob_ai.search.time.sleep"):
                with self.assertRaises(SearchUnavailable):
                    engine.index()

    def test_search_api_is_service_authenticated_and_errors_are_sanitized(self):
        settings = Settings(service_token=SecretStr("test-token"))
        with TestClient(create_app(settings)) as client:
            self.assertEqual(client.get("/v1/search/health").status_code, 401)
            self.assertEqual(client.post("/v1/search", json={}).status_code, 401)
            headers = {"Authorization": "Bearer test-token"}
            with patch.object(PublicSearch, "health", return_value={"revision": "a" * 64, "count": 1}):
                self.assertEqual(client.get("/v1/search/health", headers=headers).status_code, 200)
            self.assertEqual(client.get("/v1/search/health", headers=headers).status_code, 503)
            with patch.object(PublicSearch, "search", return_value={"candidates": []}):
                self.assertEqual(client.post("/v1/search", headers=headers, json={"query": "pytest", "revision": "a" * 64}).status_code, 200)
            response = client.post("/v1/search", headers=headers, json={"query": "pytest", "revision": "a" * 64})
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("test-token", response.text)


@unittest.skipUnless(os.getenv("TYPESENSE_TEST_BINARY"), "Real Typesense integration runs in the search workflow")
class TypesenseIntegrationTests(unittest.TestCase):
    def test_real_index_search_filters_deletions_and_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            corpus = folder / "snapshot.json"
            docs = [document("fixture"), document("k8s", title="Kubernetes"), document("csharp", title="C#"),
                    document("cplusplus", title="C++"), document("401", title="HTTP 401"), document("403", title="HTTP 403")]
            docs[1]["title_aliases"] = "k8s"
            for doc in docs:
                doc["parent"] = doc["id"]
                doc["body"] = doc["title"]
            docs[2]["technical"] = ["csharp"]
            docs[3]["technical"] = ["cplusplus"]
            docs[4]["technical"] = ["status401"]
            docs[5]["technical"] = ["status403"]
            corpus.write_text(json.dumps(snapshot(docs)))
            key = secrets.token_hex(32)
            with (folder / "server.log").open("w") as log:
                process = subprocess.Popen([os.environ["TYPESENSE_TEST_BINARY"], "--data-dir=" + directory,
                    "--api-address=127.0.0.1", "--api-port=18138", "--peering-port=18137", "--thread-pool-size=4"],
                    env={**os.environ, "TYPESENSE_API_KEY": key}, stdout=log, stderr=log)
                try:
                    engine = PublicSearch(Settings(search_url="http://127.0.0.1:18138", search_api_key=SecretStr(key), search_corpus_path=corpus))
                    engine.index()
                    for query, expected in [("fixt", "fixture"), ("fixtuer", "fixture"), ("ixtures", "fixture"),
                                            ("k8s", "k8s"), ("C#", "csharp"), ("C++", "cplusplus"), ("HTTP 401", "401"), ("HTTP 403", "403")]:
                        result = engine.search(SearchRequest(query=query, revision=snapshot(docs)["revision"]))
                        self.assertEqual(result["candidates"][0]["id"], expected, query)
                    self.assertEqual(engine.search(SearchRequest(query="unknownword", revision=snapshot(docs)["revision"]))["candidates"], [])
                    docs.pop(0)
                    corpus.write_text(json.dumps(snapshot(docs)))
                    engine.index()
                    self.assertEqual(engine.health()["count"], 5)
                    self.assertEqual(engine.search(SearchRequest(query="fixture", revision=snapshot(docs)["revision"]))["candidates"], [])
                    engine.settings = Settings(search_url="http://127.0.0.1:18138", search_api_key=SecretStr(key),
                        search_corpus_path=corpus, search_cache_path=folder / "cache.sqlite", openai_api_key=SecretStr("test-key"))
                    embeddings = Mock()
                    embeddings.embed_documents.side_effect = lambda texts: [[0.1] * 512 for _ in texts]
                    embeddings.embed_query.return_value = [0.1] * 512
                    engine._embeddings = Mock(return_value=embeddings)
                    engine.index()
                    semantic = engine.search(SearchRequest(query="C++", revision=snapshot(docs)["revision"], semantic=True))
                    self.assertEqual(semantic["mode"], "hybrid")
                    self.assertEqual([item["id"] for item in semantic["candidates"]], ["cplusplus"])
                finally:
                    process.terminate()
                    process.wait(timeout=10)
