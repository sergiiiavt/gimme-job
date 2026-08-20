from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

_TOKEN_RE = re.compile(r"[\w+#.-]+", re.UNICODE)
_HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)


@dataclass(frozen=True)
class SearchHit:
    path: str
    title: str
    excerpt: str
    score: int

    def as_dict(self) -> dict[str, str | int]:
        return asdict(self)


def _tokens(value: str) -> list[str]:
    return [token.casefold() for token in _TOKEN_RE.findall(value) if len(token) >= 2]


def _matches_language(path: Path, language: Literal["en", "uk"]) -> bool:
    is_ukrainian = path.name.endswith(".uk.md")
    return is_ukrainian if language == "uk" else not is_ukrainian


def _title(text: str, fallback: str) -> str:
    match = _HEADING_RE.search(text)
    return match.group(1).strip() if match else fallback


def _excerpt(text: str, query_tokens: list[str], radius: int = 260) -> str:
    folded = text.casefold()
    positions = [folded.find(token) for token in query_tokens]
    positions = [position for position in positions if position >= 0]
    center = min(positions) if positions else 0
    start = max(0, center - radius)
    end = min(len(text), center + radius)
    snippet = re.sub(r"\s+", " ", text[start:end]).strip()
    if start > 0:
        snippet = f"…{snippet}"
    if end < len(text):
        snippet = f"{snippet}…"
    return snippet


def search_content(
    query: str,
    content_root: Path,
    language: Literal["en", "uk"] = "en",
    limit: int = 5,
) -> list[SearchHit]:
    """Deterministic lexical search over Git-versioned public learning content.

    This is intentionally simple for the first AI-service milestone. The tool contract
    can later be backed by embeddings/pgvector without changing the agent-facing API.
    """

    root = content_root.resolve()
    if not root.is_dir():
        return []

    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    bounded_limit = max(1, min(limit, 8))
    hits: list[SearchHit] = []

    for path in root.rglob("*.md"):
        if not path.is_file() or not _matches_language(path, language):
            continue

        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue

        folded = text.casefold()
        relative_path = path.relative_to(root).as_posix()
        path_text = relative_path.casefold()
        title = _title(text, path.stem)
        title_text = title.casefold()

        occurrence_score = sum(min(folded.count(token), 8) for token in query_tokens)
        title_score = sum(5 for token in query_tokens if token in title_text)
        path_score = sum(3 for token in query_tokens if token in path_text)
        all_terms_bonus = 12 if all(token in folded for token in query_tokens) else 0
        score = occurrence_score + title_score + path_score + all_terms_bonus

        if score <= 0:
            continue

        hits.append(
            SearchHit(
                path=relative_path,
                title=title,
                excerpt=_excerpt(text, query_tokens),
                score=score,
            )
        )

    hits.sort(key=lambda hit: (-hit.score, hit.path))
    return hits[:bounded_limit]
