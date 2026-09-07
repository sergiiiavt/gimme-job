from __future__ import annotations

import asyncio
import json
import re
from dataclasses import asdict, dataclass
from typing import Literal, Protocol
from urllib.error import HTTPError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from .settings import Settings

RetrievalStrategy = Literal["vectorize", "lexical-fallback"]
FallbackReason = Literal[
    "none",
    "empty-query",
    "bindings-unavailable",
    "semantic-error",
    "no-matches-above-threshold",
]

_LEARNING_ROUTE_RE = re.compile(r"^/(?:learn|reference)/[a-z0-9][a-z0-9-]*$")
_ALLOWED_LEARNING_QUERY_KEYS = {"topic", "section", "track"}
_ALLOWED_QUESTION_ROUTES = {"/interview", "/interview/python"}
_RAG_USER_AGENT = "curl/8.10.1 GimmeJob-AI/1.0"


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
class RetrievalHitDiagnostics:
    id: str
    rank: int
    raw_rank: int | None
    score: float
    threshold: float | None
    matched_tokens: tuple[str, ...]
    title_matched_tokens: tuple[str, ...]
    coverage: float | None
    title_coverage: float | None
    phrase_bonus: float | None
    minimum_matches: int | None

    def score_explanation(self) -> str:
        if self.threshold is not None:
            return f"Vector similarity {self.score:.4f}; accepted because it is >= {self.threshold:.2f}."
        if self.coverage is not None and self.title_coverage is not None and self.phrase_bonus is not None:
            return (
                f"Lexical score = {self.coverage:.4f}×0.65 + "
                f"{self.title_coverage:.4f}×0.20 + {self.phrase_bonus:.2f} = {self.score:.4f}."
            )
        return f"Retriever score {self.score:.4f}."


@dataclass(frozen=True)
class RetrievalDiagnostics:
    selected_kinds: tuple[str, ...]
    requested_limit: int
    corpus_document_count: int
    semantic_available: bool
    semantic_attempted: bool
    embedding_input_chars: int
    embedding_dimension: int | None
    embedding_duration_ms: float
    vector_top_k: int | None
    vector_query_duration_ms: float
    raw_vector_match_count: int
    kind_filtered_match_count: int
    score_threshold: float
    threshold_passed_match_count: int
    fallback_reason: FallbackReason
    lexical_tokens: tuple[str, ...]
    removed_stop_words: tuple[str, ...]
    lexical_candidate_count: int
    lexical_scored_count: int
    lexical_duration_ms: float
    result_diagnostics: tuple[RetrievalHitDiagnostics, ...]

    def by_id(self) -> dict[str, RetrievalHitDiagnostics]:
        return {item.id: item for item in self.result_diagnostics}


@dataclass(frozen=True)
class RetrievalResult:
    strategy: RetrievalStrategy
    embedding_model: str
    hits: tuple[RetrievalHit, ...]
    diagnostics: RetrievalDiagnostics


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


def _bounded_int(value: object, field: str, maximum: int, *, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum or value > maximum:
        raise ValueError(f"Canonical RAG response field {field} is invalid.")
    return value


def _bounded_number(value: object, field: str, maximum: float, *, minimum: float = 0) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"Canonical RAG response field {field} is invalid.")
    number = float(value)
    if number < minimum or number > maximum:
        raise ValueError(f"Canonical RAG response field {field} is invalid.")
    return number


def _nullable_int(value: object, field: str, maximum: int, *, minimum: int = 0) -> int | None:
    if value is None:
        return None
    return _bounded_int(value, field, maximum, minimum=minimum)


def _nullable_number(value: object, field: str, maximum: float) -> float | None:
    if value is None:
        return None
    return _bounded_number(value, field, maximum)


def _string_list(value: object, field: str, *, max_items: int = 24, max_length: int = 200) -> tuple[str, ...]:
    if not isinstance(value, list) or len(value) > max_items:
        raise ValueError(f"Canonical RAG response field {field} is invalid.")
    return tuple(_required_text(item, field, max_length) for item in value)


def _validated_learning_source_path(value: object, route_path: str) -> str:
    source_path = _required_text(value, "sourcePath", 1_000)
    parsed = urlparse(source_path)
    if parsed.scheme or parsed.netloc or parsed.fragment or parsed.path != route_path:
        raise ValueError("Canonical RAG returned an unsafe learning source path.")
    params = parse_qs(parsed.query, keep_blank_values=True)
    if set(params) - _ALLOWED_LEARNING_QUERY_KEYS:
        raise ValueError("Canonical RAG returned an unsupported learning source query.")
    if not params.get("topic") and not params.get("section"):
        raise ValueError("Canonical RAG learning source must identify a topic or section.")
    if any(len(values) != 1 or not values[0].strip() for values in params.values()):
        raise ValueError("Canonical RAG returned an invalid learning source query.")
    return source_path


def _ui_source_path(kind: str, ref_id: str, route: str | None, canonical_source_path: object) -> str:
    """Return a validated, directly navigable GimmeJob content path."""

    route_path = route.split("?", 1)[0] if route else ""
    if kind == "question":
        if route_path not in _ALLOWED_QUESTION_ROUTES:
            raise ValueError("Canonical RAG returned a question route that the UI does not allow-list.")
        return f"{route_path}?question={quote(ref_id, safe='')}"
    if not _LEARNING_ROUTE_RE.fullmatch(route_path):
        raise ValueError("Canonical RAG returned an invalid learning route.")
    return _validated_learning_source_path(canonical_source_path, route_path)


def _parse_hit(value: object) -> RetrievalHit:
    if not isinstance(value, dict):
        raise ValueError("Canonical RAG result must be an object.")
    kind = value.get("kind")
    if kind not in {"learning", "question"}:
        raise ValueError("Canonical RAG returned an unsupported document kind.")
    score = value.get("score")
    if not isinstance(score, (int, float)) or not 0 <= float(score) <= 1.5:
        raise ValueError("Canonical RAG returned an invalid score.")
    ref_id = _required_text(value.get("refId"), "refId", 300)
    route_value = value.get("route")
    route = None if route_value is None else _required_text(route_value, "route", 1_000)
    if route is not None and (not route.startswith("/") or route.startswith("//")):
        raise ValueError("Canonical RAG returned an unsafe route.")
    return RetrievalHit(
        id=_required_text(value.get("id"), "id", 200),
        ref_id=ref_id,
        kind=kind,
        title=_required_text(value.get("title"), "title", 1_000),
        text=_required_text(value.get("text"), "text", 6_000),
        score=float(score),
        source_path=_ui_source_path(kind, ref_id, route, value.get("sourcePath")),
        route=route,
    )


def _parse_result_diagnostic(value: object) -> RetrievalHitDiagnostics:
    if not isinstance(value, dict):
        raise ValueError("Canonical RAG result diagnostic must be an object.")
    return RetrievalHitDiagnostics(
        id=_required_text(value.get("id"), "diagnostics.result.id", 200),
        rank=_bounded_int(value.get("rank"), "diagnostics.result.rank", 100, minimum=1),
        raw_rank=_nullable_int(value.get("rawRank"), "diagnostics.result.rawRank", 1_000, minimum=1),
        score=_bounded_number(value.get("score"), "diagnostics.result.score", 1.5),
        threshold=_nullable_number(value.get("threshold"), "diagnostics.result.threshold", 1.5),
        matched_tokens=_string_list(value.get("matchedTokens"), "diagnostics.result.matchedTokens"),
        title_matched_tokens=_string_list(value.get("titleMatchedTokens"), "diagnostics.result.titleMatchedTokens"),
        coverage=_nullable_number(value.get("coverage"), "diagnostics.result.coverage", 1.0),
        title_coverage=_nullable_number(value.get("titleCoverage"), "diagnostics.result.titleCoverage", 1.0),
        phrase_bonus=_nullable_number(value.get("phraseBonus"), "diagnostics.result.phraseBonus", 1.0),
        minimum_matches=_nullable_int(value.get("minimumMatches"), "diagnostics.result.minimumMatches", 24, minimum=1),
    )


def _parse_diagnostics(value: object) -> RetrievalDiagnostics:
    if not isinstance(value, dict):
        raise ValueError("Canonical RAG diagnostics must be an object.")
    fallback_reason = value.get("fallbackReason")
    allowed_reasons = {
        "none",
        "empty-query",
        "bindings-unavailable",
        "semantic-error",
        "no-matches-above-threshold",
    }
    if fallback_reason not in allowed_reasons:
        raise ValueError("Canonical RAG returned an invalid fallback reason.")
    selected_kinds = _string_list(value.get("selectedKinds"), "diagnostics.selectedKinds", max_items=3, max_length=30)
    if any(kind not in {"job", "learning", "question"} for kind in selected_kinds):
        raise ValueError("Canonical RAG returned invalid selected kinds.")
    raw_results = value.get("resultDiagnostics")
    if not isinstance(raw_results, list) or len(raw_results) > 12:
        raise ValueError("Canonical RAG result diagnostics are invalid.")
    return RetrievalDiagnostics(
        selected_kinds=selected_kinds,
        requested_limit=_bounded_int(value.get("requestedLimit"), "diagnostics.requestedLimit", 25, minimum=1),
        corpus_document_count=_bounded_int(value.get("corpusDocumentCount"), "diagnostics.corpusDocumentCount", 100_000),
        semantic_available=value.get("semanticAvailable") is True,
        semantic_attempted=value.get("semanticAttempted") is True,
        embedding_input_chars=_bounded_int(value.get("embeddingInputChars"), "diagnostics.embeddingInputChars", 2_000),
        embedding_dimension=_nullable_int(value.get("embeddingDimension"), "diagnostics.embeddingDimension", 100_000, minimum=1),
        embedding_duration_ms=_bounded_number(value.get("embeddingDurationMs"), "diagnostics.embeddingDurationMs", 300_000),
        vector_top_k=_nullable_int(value.get("vectorTopK"), "diagnostics.vectorTopK", 50, minimum=1),
        vector_query_duration_ms=_bounded_number(value.get("vectorQueryDurationMs"), "diagnostics.vectorQueryDurationMs", 300_000),
        raw_vector_match_count=_bounded_int(value.get("rawVectorMatchCount"), "diagnostics.rawVectorMatchCount", 50),
        kind_filtered_match_count=_bounded_int(value.get("kindFilteredMatchCount"), "diagnostics.kindFilteredMatchCount", 50),
        score_threshold=_bounded_number(value.get("scoreThreshold"), "diagnostics.scoreThreshold", 1.5),
        threshold_passed_match_count=_bounded_int(value.get("thresholdPassedMatchCount"), "diagnostics.thresholdPassedMatchCount", 50),
        fallback_reason=fallback_reason,
        lexical_tokens=_string_list(value.get("lexicalTokens"), "diagnostics.lexicalTokens"),
        removed_stop_words=_string_list(value.get("removedStopWords"), "diagnostics.removedStopWords"),
        lexical_candidate_count=_bounded_int(value.get("lexicalCandidateCount"), "diagnostics.lexicalCandidateCount", 100_000),
        lexical_scored_count=_bounded_int(value.get("lexicalScoredCount"), "diagnostics.lexicalScoredCount", 100_000),
        lexical_duration_ms=_bounded_number(value.get("lexicalDurationMs"), "diagnostics.lexicalDurationMs", 300_000),
        result_diagnostics=tuple(_parse_result_diagnostic(item) for item in raw_results),
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
                "user-agent": _RAG_USER_AGENT,
                "x-gimmejob-rag-token": self.token,
            },
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:  # noqa: S310 - URL is validated/configured
                raw = response.read(256_000)
        except HTTPError as error:
            cf_ray = error.headers.get("cf-ray") if error.headers else None
            detail = f"Canonical RAG request failed with HTTP {error.code}"
            if cf_ray:
                detail += f" (Cloudflare ray {cf_ray[:80]})"
            raise RuntimeError(f"{detail}.") from error
        except OSError as error:
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
            diagnostics=_parse_diagnostics(value.get("diagnostics")),
        )

    async def search(
        self,
        query: str,
        language: Literal["en", "uk"],
        limit: int = 8,
    ) -> RetrievalResult:
        return await asyncio.to_thread(self._request, query.strip()[:2_000], language, limit)
