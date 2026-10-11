"""Render prompts with untrusted text safely.

Chapter: Prompts as testable artifacts (templates and the safe insertion of untrusted text)
https://gimme-job.com/learn/llm?topic=prompts-as-artifacts

The sanitizer guarantees the STRUCTURE of the prompt: customer text cannot open or close the
application's own structural tags. It does not stop instructions written in plain words; those
are tested separately as prompt injection.
"""

import re

from prompt_registry import get_template

STRUCTURAL_TAGS = ("customer_message", "system", "policy", "instructions", "rules", "role", "examples", "output_format")
TAG_PATTERN = re.compile(r"<\s*/?\s*(" + "|".join(STRUCTURAL_TAGS) + r")\b[^>]*>", re.IGNORECASE)


def neutralize(untrusted: str) -> str:
    return TAG_PATTERN.sub("[removed tag]", untrusted)


def render_system(policy_chunks: list[str], few_shot_examples: list[str]) -> str:
    template = get_template("support-answer", "v14")
    return template.substitute(
        policy_chunks="\n\n".join(neutralize(chunk) for chunk in policy_chunks),
        few_shot_examples="\n\n".join(few_shot_examples),
    )


def render_customer_message(message: str) -> str:
    return get_template("customer-message", "v1").substitute(customer_message=neutralize(message))


def tag_counts(prompt: str, tag: str) -> tuple[int, int]:
    """Count structural tags. In these templates a structural tag always stands on its own line;
    a tag name mentioned inside a sentence (for example in a rule) is prose, not structure."""
    flags = re.IGNORECASE | re.MULTILINE
    opening = len(re.findall(r"^\s*<\s*" + tag + r"\s*>\s*$", prompt, flags=flags))
    closing = len(re.findall(r"^\s*<\s*/\s*" + tag + r"\s*>\s*$", prompt, flags=flags))
    return opening, closing
