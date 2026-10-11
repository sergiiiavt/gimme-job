"""Model output is untrusted input for whatever consumes it: encode it for HTML, keep only safe links.

Chapter: Security, red teaming and guardrails (improper output handling)
https://gimme-job.com/learn/llm?topic=security-red-teaming
"""

import re

LINK = re.compile(r"\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)")  # allows one level of parentheses in the URL
ALLOWED_HOSTS = frozenset({"shop.example"})
ENTITIES = [("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ('"', "&quot;"), ("'", "&#x27;")]


def escape_html(text: str) -> str:
    for char, entity in ENTITIES:
        text = text.replace(char, entity)
    return text


def to_html(answer: str) -> str:
    """Escape all text; turn Markdown links into anchors only for https URLs on allowed hosts."""
    parts, position = [], 0
    for match in LINK.finditer(answer):
        parts.append(escape_html(answer[position:match.start()]))
        text, url = match.group(1), match.group(2)
        # the whole authority must be an allowed host: a port or user info would let
        # https://shop.example:1@evil.example through, and browsers would open evil.example
        host = re.match(r"https://([^/?#]+)", url)
        if host and host.group(1) in ALLOWED_HOSTS:
            parts.append(f'<a href="{escape_html(url)}" rel="noopener noreferrer">{escape_html(text)}</a>')
        else:
            parts.append(escape_html(text))
        position = match.end()
    parts.append(escape_html(answer[position:]))
    return "".join(parts)
