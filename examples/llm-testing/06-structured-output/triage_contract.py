"""The output contract for ticket triage.

Chapter: Structured output and validation
https://gimme-job.com/learn/llm?topic=structured-output-validation
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TicketTriage(BaseModel):
    """Every field is required (null is allowed where 'unknown' is possible); no extra fields."""
    model_config = ConfigDict(extra="forbid")

    category: Literal["billing", "technical", "account", "returns", "other"]
    priority: int = Field(ge=1, le=4)
    summary: str = Field(min_length=1, max_length=280)
    needs_human: bool
    order_id: str | None = Field(pattern=r"^A-\d{4}$")
    language: Literal["en", "uk"]


FALLBACK = TicketTriage(category="other", priority=3, summary="Needs manual triage",
                        needs_human=True, order_id=None, language="en")


def json_schema() -> dict:
    """The JSON Schema sent to providers that support schema-constrained output."""
    return TicketTriage.model_json_schema()
