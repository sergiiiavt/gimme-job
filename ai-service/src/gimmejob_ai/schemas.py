from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    session_id: str | None = Field(default=None, min_length=1, max_length=200)


class AssistantCard(BaseModel):
    """A UI-ready card that the web app can render later."""

    kind: Literal["knowledge", "learning", "interview", "hint"]
    title: str
    summary: str
    source_path: str | None = None


class AssistantResponse(BaseModel):
    """Structured final output from the LangChain agent."""

    answer: str
    cards: list[AssistantCard] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    suggested_prompts: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    request_id: str
    session_id: str
    model: str
    langfuse_tracing: bool
    response: AssistantResponse


class HealthResponse(BaseModel):
    service: str
    version: str
    status: Literal["ok", "degraded"]
    environment: str
    model: str
    openai_configured: bool
    service_auth_configured: bool
    langfuse_configured: bool
    content_available: bool
