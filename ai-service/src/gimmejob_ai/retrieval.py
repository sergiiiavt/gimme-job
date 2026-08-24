from __future__ import annotations

import asyncio
import json
from dataclasses import asdict, dataclass
from typing import Literal, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .settings import Settings

RetrievalStrategy = Literal["vectorize", "lexical-fallback"]


@dataclass(frozen=True)
class RetrievalHit:
    id: str
    ref_id: str
    kind: Literal["learning", "question"]
    title: str
    text: str
    score: float
    source_path: str
    route: str | None

    @property
    def path(self) -> str:
        """Compatibility alias used by the learning-map grounding verifier."""

        return self.source_path

    @property
    def excerpt(self) -> str:
        return self.text[:2_000]

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class RetrievalResult:
    strategy: RetrievalStrategy
    embedding_model: str
    hits: tuple[RetrievalHit, ...]


class LearningRetriever(Protocol):
    async def search(
        self,
        query: str,
        language: Literal["en", "uk"],
        limit: int = 8,
    ) -> RetrievalResult: ...


def _validated_rag_url(value: str, environment: str) -> str:
    parsed = urlparse(value.strip())
    local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    if parsed.scheme not in ({"http", "https"} if local and environment != "production" else {"https"}):
        raise ValueError("Canonical RAG URL must use HTTPS outside local development.")
    if not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("Canonical RAG URL is invalid.")
    return value.strip()


def _required_text(value: object, field: str, max_length: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"Canonical RAG response field {field} must be text.")
    cleaned = value.strip()
    if not cleaned or len(cleaned) > max_length:
        raise ValueError(f"Canonical RAG response field {field} is invalid.")
    return cleaned


def _parse_hit(value: object) -> RetrievalHit:
    if not isinstance(value, dict):
        raise ValueError("Canonical RAG result must be an object.")
    kind = value.get("kind")
    if kind not in {"learning", "question"}:
        raise ValueError("Canonical RAG returned an unsupported document kind.")
    score = value.get("score")
    if not isinstance(score, (int, float)) or not 0 <= float(score) <= 1.5:
        raise ValueError("Canonical RAG returned an invalid score.")
    route_value = value.get("route")
    route = None if route_value is None else _required_text(route_value, "route", 1_000)
    source_path = _required_text(value.get("sourcePath"), "sourcePath", 1_000)
    if not source_path.startswith("/") or source_path.startswith("//"):
        raise ValueError("Canonical RAG returned an unsafe source path.")
    return RetrievalHit(
        id=_required_text(value.get("id"), "id", 200),
        ref_id=_required_text(value.get("refId"), "refId", 300),
        kind=kind,
        title=_required_text(value.get("title"), "title", 1_000),
        text=_required_text(value.get("text"), "text", 6_000),
        score=float(score),
        source_path=source_path,
        route=route,
    )


class CanonicalRagClient:
    """Read-only client for GimmeJob's single canonical Worker RAG pipeline."""

    def __init__(self, settings: Settings) -> None:
        if not settings.rag_configured:
            raise ValueError("Canonical RAG is not configured.")
        self.url = _validated_rag_url(settings.rag_url or "", settings.environment)
        self.token = settings.rag_service_token.get_secret_value()
        self.timeout = settings.request_timeout_seconds

    def _request(self, query: str, language: Literal["en", "uk"], limit: int) -> RetrievalResult:
        payload = json.dumps(
            {
                "query": query,
                "language": language,
                "kinds": ["learning", "question"],
                "limit": max(1, min(limit, 8)),
            }
        ).encode("utf-8")
        request = Request(
            self.url,
            data=payload,
            method="POST",
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                "x-gimmejob-rag-token": self.token,
            },
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:  # noqa: S310 - URL is validated/configured
                raw = response.read(256_000)
        except HTTPError as error:
            raise RuntimeError(f"Canonical RAG request failed with HTTP {error.code}.") from error
        except (URLError, TimeoutError, OSError) as error:
            raise RuntimeError("Canonical RAG service is unavailable.") from error

        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError) as error:
            raise RuntimeError("Canonical RAG returned invalid JSON.") from error
        if not isinstance(value, dict) or value.get("ok") is not True:
            raise RuntimeError("Canonical RAG returned an unsuccessful response.")
        strategy = value.get("retrieval")
        if strategy not in {"vectorize", "lexical-fallback"}:
            raise RuntimeError("Canonical RAG returned an unknown retrieval strategy.")
        embedding_model = _required_text(value.get("embeddingModel"), "embeddingModel", 300)
        results = value.get("results")
        if not isinstance(results, list) or len(results) > 12:
            raise RuntimeError("Canonical RAG returned an invalid result list.")
        return RetrievalResult(
            strategy=strategy,
            embedding_model=embedding_model,
            hits=tuple(_parse_hit(item) for item in results),
        )

    async def search(
        self,
        query: str,
        language: Literal["en", "uk"],
        limit: int = 8,
    ) -> RetrievalResult:
        return await asyncio.to_thread(self._request, query.strip()[:2_000], language, limit)
