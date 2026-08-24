from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

_TOKEN_RE = re.compile(r"[\w+#.-]+", re.UNICODE)
_HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)
_WHITESPACE_RE = re.compile(r"\s+")
_FRAGMENT_RE = re.compile(r"[^a-z0-9._-]+")
_JSON_IDENTITY_KEYS = frozenset({"id", "title", "question", "term", "name", "card", "lesson", "heading"})
_QUERY_STOP_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "about",
        "become",
        "does",
        "do",
        "explain",
        "for",
        "from",
        "give",
        "help",
        "how",
        "in",
        "is",
        "learn",
        "me",
        "need",
        "of",
        "path",
        "please",
        "show",
        "teach",
        "the",
        "to",
        "understand",
        "want",
        "what",
        "with",
        "вивчити",
        "допоможи",
        "мені",
        "навчи",
        "покажи",
        "поясни",
        "про",
        "стати",
        "хочу",
        "що",
        "як",
    }
)


@dataclass(frozen=True)
class SearchHit:
    path: str
    title: str
    excerpt: str
    score: int

    def as_dict(self) -> dict[str, str | int]:
        return asdict(self)


@dataclass(frozen=True)
class _SearchDocument:
    file_path: str
    path: str
    title: str
    text: str


@dataclass(frozen=True)
class _ScoredDocument:
    document: _SearchDocument
    score: int
    matched_tokens: int
    matched_terms: tuple[str, ...]


def _tokens(value: str) -> list[str]:
    tokens = [token.casefold().strip(".-") for token in _TOKEN_RE.findall(value)]
    tokens = list(dict.fromkeys(token for token in tokens if len(token) >= 2))
    meaningful = [token for token in tokens if token not in _QUERY_STOP_WORDS]
    return meaningful or tokens


def _term_count(value: str, token: str) -> int:
    pattern = re.compile(rf"(?<![\w+#]){re.escape(token)}(?![\w+#])", re.UNICODE)
    return len(pattern.findall(value))


def _matches_language(path: Path, language: Literal["en", "uk"]) -> bool:
    is_ukrainian = path.name.endswith(".uk.md")
    return is_ukrainian if language == "uk" else not is_ukrainian


def _title(text: str, fallback: str) -> str:
    match = _HEADING_RE.search(text)
    return match.group(1).strip() if match else fallback


def _clean_text(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", text).strip()


def _excerpt(text: str, query_tokens: list[str], radius: int = 260) -> str:
    clean = _clean_text(text)
    folded = clean.casefold()
    positions = [folded.find(token) for token in query_tokens]
    positions = [position for position in positions if position >= 0]
    center = min(positions) if positions else 0
    start = max(0, center - radius)
    end = min(len(clean), center + radius)
    snippet = clean[start:end].strip()
    if start > 0:
        snippet = f"…{snippet}"
    if end < len(clean):
        snippet = f"{snippet}…"
    return snippet


def _localized_value(value: object, language: Literal["en", "uk"]) -> object:
    if isinstance(value, dict) and ("en" in value or "uk" in value):
        return value.get(language) or value.get("en") or value.get("uk") or ""
    return value


def _is_json_chunk(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    return any(key in value and isinstance(_localized_value(value[key], "en"), str) for key in _JSON_IDENTITY_KEYS)


def _extend_flattened_parts(
    parts: list[str],
    value: object,
    language: Literal["en", "uk"],
) -> bool:
    parts.extend(_flatten_json_value(value, language, nested=True))
    return len(parts) >= 80


def _flatten_json_list(value: list[object], language: Literal["en", "uk"]) -> list[str]:
    parts: list[str] = []
    for item in value:
        if isinstance(item, dict) and _is_json_chunk(item):
            continue
        if _extend_flattened_parts(parts, item, language):
            break
    return parts


def _uses_other_localization(
    record: dict[object, object],
    key: object,
    language: Literal["en", "uk"],
) -> bool:
    if not isinstance(key, str):
        return False
    if language == "en":
        return key.endswith("Uk")
    return not key.endswith("Uk") and f"{key}Uk" in record


def _flatten_json_mapping(
    value: dict[object, object],
    language: Literal["en", "uk"],
    nested: bool,
) -> list[str]:
    if nested and _is_json_chunk(value):
        return []

    parts: list[str] = []
    for key, item in value.items():
        if _uses_other_localization(value, key, language):
            continue
        if _extend_flattened_parts(parts, item, language):
            break
    return parts


def _flatten_json_value(
    value: object,
    language: Literal["en", "uk"],
    *,
    nested: bool = False,
) -> list[str]:
    value = _localized_value(value, language)
    if isinstance(value, str):
        clean = _clean_text(value)
        return [clean] if clean else []
    if isinstance(value, (int, float, bool)):
        return [str(value)]
    if isinstance(value, list):
        return _flatten_json_list(value, language)
    if isinstance(value, dict):
        return _flatten_json_mapping(value, language, nested)
    return []


def _record_title(record: dict[str, object], language: Literal["en", "uk"], fallback: str) -> str:
    for key in ("title", "question", "term", "name", "card", "lesson", "heading", "id"):
        preferred_key = f"{key}Uk" if language == "uk" and f"{key}Uk" in record else key
        value = _localized_value(record.get(preferred_key), language)
        if isinstance(value, str) and _clean_text(value):
            return _clean_text(value)
    return fallback


def _fragment(value: str, fallback: str) -> str:
    folded = value.casefold().encode("ascii", "ignore").decode("ascii")
    clean = _FRAGMENT_RE.sub("-", folded).strip("-.")
    return (clean or fallback)[:160]


@lru_cache(maxsize=512)
def _cached_markdown_document(
    absolute_path: str,
    relative_path: str,
    modified_ns: int,
    size: int,
) -> _SearchDocument | None:
    del modified_ns, size
    path = Path(absolute_path)
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return None
    return _SearchDocument(
        file_path=relative_path,
        path=relative_path,
        title=_title(text, path.stem),
        text=text,
    )


def _unique_json_source_path(relative_path: str, base_fragment: str, used_paths: set[str]) -> str:
    source_path = f"{relative_path}#{base_fragment}"
    suffix = 2
    while source_path in used_paths:
        source_path = f"{relative_path}#{base_fragment}-{suffix}"
        suffix += 1
    used_paths.add(source_path)
    return source_path


def _json_chunk_document(
    record: dict[object, object],
    trail: tuple[str, ...],
    relative_path: str,
    language: Literal["en", "uk"],
    document_index: int,
    used_paths: set[str],
) -> _SearchDocument | None:
    fallback_title = trail[-1] if trail else Path(relative_path).stem
    title = _record_title(record, language, fallback_title)
    record_id = record.get("id")
    identity = record_id if isinstance(record_id, str) else "-".join([*trail[-3:], title])
    base_fragment = _fragment(identity, f"item-{document_index + 1}")
    source_path = _unique_json_source_path(relative_path, base_fragment, used_paths)
    text = _clean_text(" ".join(_flatten_json_value(record, language)))
    if not text:
        return None
    return _SearchDocument(
        file_path=relative_path,
        path=source_path,
        title=title,
        text=text,
    )


def _visit_json_mapping(
    value: dict[object, object],
    trail: tuple[str, ...],
    relative_path: str,
    language: Literal["en", "uk"],
    documents: list[_SearchDocument],
    used_paths: set[str],
) -> None:
    if _is_json_chunk(value):
        document = _json_chunk_document(
            value,
            trail,
            relative_path,
            language,
            len(documents),
            used_paths,
        )
        if document is not None:
            documents.append(document)

    for key, item in value.items():
        _visit_json_value(
            item,
            (*trail, str(key)),
            relative_path,
            language,
            documents,
            used_paths,
        )


def _visit_json_list(
    value: list[object],
    trail: tuple[str, ...],
    relative_path: str,
    language: Literal["en", "uk"],
    documents: list[_SearchDocument],
    used_paths: set[str],
) -> None:
    for index, item in enumerate(value):
        _visit_json_value(
            item,
            (*trail, str(index)),
            relative_path,
            language,
            documents,
            used_paths,
        )


def _visit_json_value(
    value: object,
    trail: tuple[str, ...],
    relative_path: str,
    language: Literal["en", "uk"],
    documents: list[_SearchDocument],
    used_paths: set[str],
) -> None:
    if isinstance(value, dict):
        _visit_json_mapping(value, trail, relative_path, language, documents, used_paths)
    elif isinstance(value, list):
        _visit_json_list(value, trail, relative_path, language, documents, used_paths)


@lru_cache(maxsize=512)
def _cached_json_documents(
    absolute_path: str,
    relative_path: str,
    language: Literal["en", "uk"],
    modified_ns: int,
    size: int,
) -> tuple[_SearchDocument, ...]:
    del modified_ns, size
    try:
        raw: Any = json.loads(Path(absolute_path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return ()

    documents: list[_SearchDocument] = []
    used_paths: set[str] = set()
    _visit_json_value(raw, (), relative_path, language, documents, used_paths)
    return tuple(documents)


def _documents(root: Path, language: Literal["en", "uk"]) -> list[_SearchDocument]:
    documents: list[_SearchDocument] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.casefold() not in {".md", ".json"}:
            continue
        if path.suffix.casefold() == ".md" and not _matches_language(path, language):
            continue
        try:
            stat = path.stat()
            relative_path = path.relative_to(root).as_posix()
        except (OSError, ValueError):
            continue

        if path.suffix.casefold() == ".md":
            document = _cached_markdown_document(
                str(path),
                relative_path,
                stat.st_mtime_ns,
                stat.st_size,
            )
            if document is not None:
                documents.append(document)
        else:
            documents.extend(
                _cached_json_documents(
                    str(path),
                    relative_path,
                    language,
                    stat.st_mtime_ns,
                    stat.st_size,
                )
            )
    return documents


def _score_document(document: _SearchDocument, query: str, query_tokens: list[str]) -> _ScoredDocument | None:
    folded = document.text.casefold()
    title_text = document.title.casefold()
    path_text = document.file_path.casefold()
    occurrences = {token: _term_count(folded, token) for token in query_tokens}
    title_matches = {token for token in query_tokens if _term_count(title_text, token)}
    path_matches = {token for token in query_tokens if _term_count(path_text, token)}
    matched = [
        token
        for token in query_tokens
        if occurrences[token] or token in title_matches or token in path_matches
    ]
    if not matched:
        return None

    occurrence_score = sum(min(occurrences[token], 8) for token in matched)
    title_score = sum(7 for token in matched if token in title_matches)
    path_score = sum(3 for token in matched if token in path_matches)
    coverage_score = len(matched) * 7
    all_terms_bonus = 40 if len(matched) == len(query_tokens) else 0
    phrase = _clean_text(query).casefold()
    phrase_bonus = 12 if phrase and (phrase in folded or phrase in title_text) else 0
    score = occurrence_score + title_score + path_score + coverage_score + all_terms_bonus + phrase_bonus
    return _ScoredDocument(
        document=document,
        score=score,
        matched_tokens=len(matched),
        matched_terms=tuple(matched),
    )


def _diversified_results(scored: list[_ScoredDocument], limit: int) -> list[_ScoredDocument]:
    by_file: dict[str, list[_ScoredDocument]] = defaultdict(list)
    for item in scored:
        by_file[item.document.file_path].append(item)
    groups = sorted(by_file.values(), key=lambda group: (-group[0].score, group[0].document.file_path))
    max_per_file = max(1, math.ceil(limit / 2))
    selected: list[_ScoredDocument] = []
    for index in range(max_per_file):
        for group in groups:
            if index < len(group):
                selected.append(group[index])
                if len(selected) >= limit:
                    return selected
    return selected


def _rank_documents(
    root: Path,
    language: Literal["en", "uk"],
    query: str,
    query_tokens: list[str],
) -> list[_ScoredDocument]:
    scored = [
        result
        for document in _documents(root, language)
        if (result := _score_document(document, query, query_tokens)) is not None
    ]
    scored.sort(key=lambda item: (-item.score, item.document.path))
    return scored


def _supplement_uncovered_terms(
    query_tokens: list[str],
    all_scored: list[_ScoredDocument],
    selected: list[_ScoredDocument],
    selected_paths: set[str],
    covered_terms: set[str],
    limit: int,
) -> None:
    for token in query_tokens:
        if token in covered_terms or len(selected) >= limit:
            continue
        supplement = next(
            (
                item
                for item in all_scored
                if token in item.matched_terms and item.document.path not in selected_paths
            ),
            None,
        )
        if supplement is None:
            continue
        selected.append(supplement)
        selected_paths.add(supplement.document.path)
        covered_terms.update(supplement.matched_terms)


def _fill_from_ranked(
    ranked: list[_ScoredDocument],
    selected: list[_ScoredDocument],
    selected_paths: set[str],
    limit: int,
) -> None:
    for item in ranked:
        if len(selected) >= limit:
            break
        if item.document.path in selected_paths:
            continue
        selected.append(item)
        selected_paths.add(item.document.path)


def _select_search_results(
    query_tokens: list[str],
    all_scored: list[_ScoredDocument],
    ranked_strong: list[_ScoredDocument],
    limit: int,
) -> list[_ScoredDocument]:
    reserve = min(len(query_tokens), 3, max(0, limit - 1))
    selected = ranked_strong[: max(1, limit - reserve)]
    selected_paths = {item.document.path for item in selected}
    covered_terms = {term for item in selected for term in item.matched_terms}

    # Once a sufficiently relevant result anchors the query in the repository,
    # include the best exact hit for any remaining concept. This lets a query such
    # as "asyncio for test automation" combine asyncio and automation material
    # without letting an unrelated one-word collision claim repository grounding.
    _supplement_uncovered_terms(
        query_tokens,
        all_scored,
        selected,
        selected_paths,
        covered_terms,
        limit,
    )
    _fill_from_ranked(ranked_strong, selected, selected_paths, limit)
    return selected


def search_content(
    query: str,
    content_root: Path,
    language: Literal["en", "uk"] = "en",
    limit: int = 5,
) -> list[SearchHit]:
    """Search cached Markdown and structured JSON chunks in Git-versioned content."""

    root = content_root.resolve()
    if not root.is_dir():
        return []

    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    bounded_limit = max(1, min(limit, 8))
    minimum_matches = 1 if len(query_tokens) == 1 else max(2, math.ceil(len(query_tokens) / 2))
    all_scored = _rank_documents(root, language, query, query_tokens)
    strong = [item for item in all_scored if item.matched_tokens >= minimum_matches]
    if not strong:
        return []

    ranked_strong = _diversified_results(strong, bounded_limit)
    selected = _select_search_results(query_tokens, all_scored, ranked_strong, bounded_limit)

    return [
        SearchHit(
            path=item.document.path,
            title=item.document.title,
            excerpt=_excerpt(item.document.text, query_tokens),
            score=item.score,
        )
        for item in selected
    ]
