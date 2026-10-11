"""Split documents into chunks of whole sentences, with overlap, section titles and document metadata.

Chapter: Evaluating RAG systems (testing ingestion and chunking)
https://gimme-job.com/learn/llm?topic=rag-testing
"""

import re
from dataclasses import dataclass

SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


@dataclass(frozen=True)
class Chunk:
    id: str
    document: str
    section: str
    sentences: tuple[str, ...]
    tenant: str = "public"
    valid_from: str = ""

    @property
    def text(self) -> str:
        return " ".join(self.sentences)


def sentences(text: str) -> list[str]:
    return [part for part in SENTENCE_END.split(" ".join(text.split())) if part]


def sections(markdown: str) -> list[tuple[str, str]]:
    """(title, body) for every '# ' section; text before the first heading belongs to an untitled section."""
    result, title, lines = [], "", []
    for line in markdown.splitlines():
        if line.startswith("# "):
            if any(part.strip() for part in lines):
                result.append((title, "\n".join(lines)))
            title, lines = line[2:].strip(), []
        else:
            lines.append(line)
    if any(part.strip() for part in lines):
        result.append((title, "\n".join(lines)))
    return result


def chunk_document(document: dict, max_words: int = 20, overlap: int = 1) -> list[Chunk]:
    """Chunks never cross a section boundary. A single sentence longer than max_words becomes a chunk of
    its own instead of being dropped or cut. Neighbouring chunks share up to `overlap` sentences."""
    chunks = []
    for title, body in sections(document["text"]):
        parts, start = sentences(body), 0
        while start < len(parts):
            end, words = start, 0
            while end < len(parts):
                size = len(parts[end].split())
                if end > start and words + size > max_words:
                    break
                words += size
                end += 1
            chunks.append(Chunk(f"{document['id']}#{len(chunks)}", document["id"], title, tuple(parts[start:end]),
                                document.get("tenant", "public"), document.get("valid_from", "")))
            if end == len(parts):
                break
            start = max(end - overlap, start + 1)
    return chunks
