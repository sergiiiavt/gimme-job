"""Private Typesense gateway. The canonical Worker/image snapshot remains the content authority."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sqlite3
import time
from functools import lru_cache
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from langchain_openai import OpenAIEmbeddings
from openai import RateLimitError
from pydantic import BaseModel, Field

from .settings import Settings

logger = logging.getLogger(__name__)
ALIAS = "gimmejob_public"
COLLECTIONS_PATH = "/collections/"
MODEL = "text-embedding-3-small"
DIMENSIONS = 512
# Bump when changing model, dimensions, or index field semantics.
SCHEMA_VERSION = "v1"


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=240)
    revision: str = Field(pattern=r"^[a-f0-9]{64}$")
    semantic: bool = False
    kind: Literal["learning", "question"] | None = None
    language: Literal["en", "uk"] | None = None
    limit: int = Field(default=12, ge=1, le=40)


class SearchUnavailable(RuntimeError):
    pass


def _tokens(text: str) -> list[str]:
    return [token.rstrip(".") for token in re.findall(r"[\w+#.]+", text.lower()) if re.search(r"\w", token)][:32]


def _technical(text: str) -> list[str]:
    names = {"c#": "csharp", "c++": "cplusplus", ".net": "dotnet"}
    return sorted({names[token] for token in _tokens(text) if token in names} | {
        f"status{token}" for token in _tokens(text) if re.fullmatch(r"[1-5]\d{2}", token)
    })


def _filters(request: SearchRequest) -> str:
    filters = [f"{key}:={value}" for key, value in (("kind", request.kind), ("language", request.language)) if value]
    filters.extend(f"technical:={term}" for term in _technical(request.query))
    return " && ".join(filters)


def _fuse(lexical: list[dict], semantic: list[dict], limit: int, language: str = "en") -> list[dict]:
    """Reciprocal ranks keep incompatible lexical/vector score scales out of the API."""
    candidates: dict[str, dict] = {}
    for weight, hits in ((1.0, lexical), (0.65, semantic)):
        for rank, hit in enumerate(hits):
            document = hit["document"]
            candidate = candidates.setdefault(document["id"], {"id": document["id"], "score": 0.0,
                                                               "parent": document["parent"], "canonical": document["canonical"], "language": document["language"]})
            candidate["score"] += weight / (30 + rank)
    # English/Ukrainian variants share an ID-independent parent. At most two sections per chapter.
    parents: dict[str, int] = {}
    result = []
    seen: set[str] = set()
    for candidate in sorted(candidates.values(), key=lambda item: (-item["score"], item["language"] != language)):
        if candidate["canonical"] in seen:
            continue
        seen.add(candidate["canonical"])
        parent = candidate["parent"]
        if parents.get(parent, 0) >= 2:
            continue
        parents[parent] = parents.get(parent, 0) + 1
        result.append({"id": candidate["id"], "score": min(1.0, candidate["score"] * 18)})
        if len(result) >= limit:
            break
    return result


class PublicSearch:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._query_embedding = lru_cache(maxsize=256)(self._embed_query)

    def _request(self, path: str, *, method: str = "GET", body=None, timeout: int = 12):
        if not self.settings.search_url or not self.settings.search_api_key:
            raise SearchUnavailable("Search is not configured.")
        payload = None
        if isinstance(body, str):
            payload = body.encode()
        elif body is not None:
            payload = json.dumps(body).encode()
        request = Request(self.settings.search_url.rstrip("/") + path, data=payload, method=method,
                          headers={"X-TYPESENSE-API-KEY": self.settings.search_api_key.get_secret_value(),
                                   "Content-Type": "application/json"})
        with urlopen(request, timeout=timeout) as response:
            data = response.read().decode()
        return data if "/import?" in path else json.loads(data)

    def health(self) -> dict:
        alias = self._request(f"/aliases/{ALIAS}")
        collection = self._request(COLLECTIONS_PATH + alias["collection_name"])
        return {"revision": collection["metadata"]["revision"], "count": collection["num_documents"],
                "semanticAvailable": collection["metadata"]["semantic"], "engine": "typesense"}

    def _embeddings(self) -> OpenAIEmbeddings:
        if not self.settings.openai_api_key:
            raise SearchUnavailable("Embeddings are not configured.")
        return OpenAIEmbeddings(model=MODEL, dimensions=DIMENSIONS, api_key=self.settings.openai_api_key,
                                request_timeout=12, max_retries=1, chunk_size=64)

    def _embed_query(self, query: str) -> tuple[float, ...]:
        return tuple(self._embeddings().embed_query(query))

    def search(self, request: SearchRequest) -> dict:
        health = self.health()
        if health["revision"] != request.revision:
            raise SearchUnavailable("Search index is catching up with this release.")
        q = " ".join(_tokens(request.query))
        if not q:
            return {"revision": request.revision, "mode": "typesense", "semanticAvailable": health["semanticAvailable"], "candidates": []}
        params = {"q": q, "query_by": "title,title_aliases,body,aliases", "query_by_weights": "8,6,2,1",
                  "drop_tokens_threshold": 0, "num_typos": "2,0,1,0", "min_len_1typo": 5, "min_len_2typo": 9,
                  "enable_typos_for_numerical_tokens": "false", "enable_typos_for_alpha_numerical_tokens": "false",
                  "prefix": "true,true,true,true", "per_page": 60, "highlight_fields": "none",
                  "include_fields": "id,parent,canonical,language", "filter_by": _filters(request), "search_cutoff_ms": 250,
                  "infix": "fallback,off,off,off" if len(_tokens(q)) == 1 and len(q) >= 4 else "off,off,off,off"}
        lexical = self._request(f"/collections/{ALIAS}/documents/search?" + urlencode(params))["hits"]
        semantic = []
        semantic_available = health["semanticAvailable"]
        if request.semantic and health["semanticAvailable"]:
            try:
                semantic = self._vector_search(self._query_embedding(request.query), _filters(request))
            except Exception as error:
                semantic_available = False
                logger.warning("Semantic search unavailable: %s %s", type(error).__name__, getattr(error, "code", ""))
        return {"revision": request.revision, "mode": "hybrid" if semantic else "typesense",
                "semanticAvailable": semantic_available, "candidates": _fuse(lexical, semantic, request.limit, "uk" if re.search(r"[А-Яа-яІіЇїЄєҐґ]", request.query) else "en")}

    def _vector_search(self, embedding: tuple[float, ...], filter_by: str) -> list[dict]:
        """A 512-dimension query embedding serializes to ~10 KB, past Typesense's 4,000-character GET
        query-string limit, so the vector query travels in a POST multi_search body."""
        vector = json.dumps(embedding, separators=(",", ":"))
        search = {"collection": ALIAS, "q": "*", "vector_query": f"embedding:({vector}, k:40, distance_threshold:0.55)",
                  "per_page": 40, "include_fields": "id,parent,canonical,language"}
        if filter_by:
            search["filter_by"] = filter_by
        result = self._request("/multi_search", method="POST", body={"searches": [search]})["results"][0]
        # multi_search answers 200 and reports a failed search inside its result.
        if "error" in result:
            raise SearchUnavailable(f"Vector search failed with status {result.get('code')}.")
        return result["hits"]

    def _embed_index_batch(self, model: OpenAIEmbeddings, texts: list[str]) -> list[list[float]]:
        attempt = 0
        while True:
            try:
                return model.embed_documents(texts)
            except RateLimitError as error:
                if error.code in {"insufficient_quota", "billing_hard_limit_reached"} or attempt >= 7:
                    raise
                delay = min(60, 5 * (2 ** attempt))
                attempt += 1
                logger.warning("Embedding index rate limited; retry %d of 7 in %d seconds.", attempt, delay)
                time.sleep(delay)

    def _cached_embeddings(self, documents: list[dict]) -> list[list[float]]:
        cache = self.settings.search_cache_path
        cache.parent.mkdir(parents=True, exist_ok=True)
        result: list[list[float]] = []
        with sqlite3.connect(cache) as database:
            database.execute("CREATE TABLE IF NOT EXISTS embeddings (id TEXT PRIMARY KEY, vector TEXT NOT NULL)")
            model = self._embeddings()
            for start in range(0, len(documents), 64):
                texts = [(doc["title"] + "\n" + doc["body"])[:6000] for doc in documents[start:start + 64]]
                keys = [hashlib.sha256(f"{MODEL}:{DIMENSIONS}:{text}".encode()).hexdigest() for text in texts]
                cached = {key: database.execute("SELECT vector FROM embeddings WHERE id = ?", (key,)).fetchone() for key in keys}
                missing = list(dict.fromkeys(key for key in keys if not cached[key]))
                if missing:
                    lookup = dict(zip(keys, texts))
                    vectors = self._embed_index_batch(model, [lookup[key] for key in missing])
                    database.executemany("INSERT OR REPLACE INTO embeddings VALUES (?, ?)",
                                         [(key, json.dumps(vector)) for key, vector in zip(missing, vectors, strict=True)])
                    database.commit()
                    cached.update({key: (json.dumps(vector),) for key, vector in zip(missing, vectors, strict=True)})
                result.extend(json.loads(cached[key][0]) for key in keys)
        return result

    def _wait_ready(self) -> None:
        for attempt in range(30):
            try:
                if self._request("/health").get("ok"):
                    break
            except (URLError, TimeoutError):
                pass
            if attempt == 29:
                raise SearchUnavailable("Typesense did not become ready.")
            time.sleep(1)

    def index(self) -> dict:
        self._wait_ready()
        snapshot = json.loads(self.settings.search_corpus_path.read_text())
        documents = snapshot["documents"]
        revision = hashlib.sha256(json.dumps(documents, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        if revision != snapshot["revision"] or len({doc["id"] for doc in documents}) != len(documents):
            raise ValueError("Canonical search snapshot failed integrity validation.")
        semantic = self.settings.openai_configured
        name = f"public_{SCHEMA_VERSION}_{revision[:24]}_{'vector' if semantic else 'lexical'}"
        try:
            collection = self._request(COLLECTIONS_PATH + name)
            complete = collection["num_documents"] == len(documents)
        except HTTPError as error:
            if error.code != 404:
                raise
            complete = False
        if not complete:
            self._build_collection(name, revision, documents, semantic)
        # Switch only after the full import passed. Keep the previous collection for rollback.
        self._request(f"/aliases/{ALIAS}", method="PUT", body={"collection_name": name})
        collections = self._request("/collections")
        previous = sorted((item for item in collections if item["name"].startswith("public_") and item["name"] != name),
                          key=lambda item: item["created_at"], reverse=True)
        for obsolete in previous[1:]:
            self._request(COLLECTIONS_PATH + obsolete["name"], method="DELETE")
        return self.health()

    def _build_collection(self, name: str, revision: str, documents: list[dict], semantic: bool) -> None:
        # Remove only an incomplete version of this exact snapshot, never the active alias target.
        try:
            active = self._request(f"/aliases/{ALIAS}")["collection_name"]
            if active == name:
                raise SearchUnavailable("Refusing to overwrite the active search collection.")
        except HTTPError as error:
            if error.code != 404:
                raise
        try:
            self._request(COLLECTIONS_PATH + name, method="DELETE")
        except HTTPError as error:
            if error.code != 404:
                raise
        fields = [{"name": "title", "type": "string", "infix": True}, {"name": "body", "type": "string"},
                  {"name": "aliases", "type": "string"}, {"name": "title_aliases", "type": "string"}, {"name": "kind", "type": "string", "facet": True},
                  {"name": "language", "type": "string", "facet": True}, {"name": "parent", "type": "string", "index": False},
                  {"name": "canonical", "type": "string", "index": False},
                  {"name": "technical", "type": "string[]", "facet": True}]
        vectors = self._cached_embeddings(documents) if semantic else []
        if semantic:
            fields.append({"name": "embedding", "type": "float[]", "num_dim": DIMENSIONS})
        self._request("/collections", method="POST", body={"name": name, "fields": fields,
                      "symbols_to_index": ["+", "#", ".", "_"], "metadata": {"revision": revision, "semantic": semantic}})
        for start in range(0, len(documents), 64):
            batch = [{**doc, **({"embedding": vectors[start + index]} if semantic else {})}
                     for index, doc in enumerate(documents[start:start + 64])]
            imported = self._request(f"/collections/{name}/documents/import?action=create", method="POST",
                                     body="\n".join(json.dumps(doc, ensure_ascii=False) for doc in batch), timeout=60)
            if any(not json.loads(line).get("success") for line in imported.splitlines()):
                raise SearchUnavailable("Search import failed; the previous index remains active.")
        if self._request(COLLECTIONS_PATH + name)["num_documents"] != len(documents):
            raise SearchUnavailable("Search import is incomplete.")


if __name__ == "__main__":
    print(json.dumps(PublicSearch(Settings()).index()))
