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


class LearningMapNode(BaseModel):
    """One UI-ready node in a connected learning map."""

    id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=240)
    summary: str = Field(min_length=1, max_length=2_000)
    kind: Literal["topic", "foundation", "concept", "practice", "source"]
    source_path: str | None = Field(default=None, max_length=500)
    duration_minutes: int | None = Field(default=None, ge=1, le=240)


class LearningMapEdge(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    target: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=120)


class LearningMap(BaseModel):
    title: str = Field(default="Learning path", min_length=1, max_length=240)
    nodes: list[LearningMapNode] = Field(default_factory=list, max_length=8)
    edges: list[LearningMapEdge] = Field(default_factory=list, max_length=12)


class AssistantResponse(BaseModel):
    """Structured final output from the LangChain agent."""

    answer: str
    cards: list[AssistantCard] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    suggested_prompts: list[str] = Field(default_factory=list)
    learning_map: LearningMap = Field(default_factory=LearningMap)


class ChatResponse(BaseModel):
    request_id: str
    session_id: str
    model: str
    langfuse_tracing: bool
    response: AssistantResponse


TraceScalar = str | int | float | bool | None


class TraceRetrievalResult(BaseModel):
    title: str = Field(min_length=1, max_length=1_000)
    kind: Literal["learning", "question"]
    score: float = Field(ge=0, le=1.5)
    source_path: str = Field(min_length=1, max_length=1_000)
    excerpt: str = Field(min_length=1, max_length=2_000)


class TraceTokenUsage(BaseModel):
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class WorkflowStep(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=240)
    detail: str = Field(min_length=1, max_length=1_000)
    duration_ms: float = Field(default=0, ge=0, le=300_000)
    input: dict[str, TraceScalar] = Field(default_factory=dict, max_length=20)
    output: dict[str, TraceScalar] = Field(default_factory=dict, max_length=20)
    retrieval_results: list[TraceRetrievalResult] = Field(default_factory=list, max_length=8)
    token_usage: TraceTokenUsage | None = None


class LearningAdvisorResponse(BaseModel):
    request_id: str
    session_id: str
    model: str
    langfuse_tracing: bool
    langfuse_trace_url: str | None = Field(default=None, max_length=2_000)
    orchestration: Literal["langgraph"] = "langgraph"
    retrieval_mode: Literal["repository", "general"]
    total_duration_ms: float = Field(default=0, ge=0, le=300_000)
    workflow_steps: list[WorkflowStep]
    response: AssistantResponse


class InterviewQuestionPrompt(BaseModel):
    """Interview question data safe to send before the candidate answers."""

    id: str
    question: str
    level: str
    category: str
    prevalence: str
    kind: str
    track: Literal["qa", "python"]


class InterviewStartRequest(BaseModel):
    track: Literal["qa", "python", "all"] = "qa"
    language: Literal["en", "uk"] = "en"
    question_count: int = Field(default=10, ge=1, le=20)
    levels: list[str] = Field(default_factory=list, max_length=5)
    categories: list[str] = Field(default_factory=list, max_length=20)
    session_id: str | None = Field(default=None, min_length=1, max_length=200)


class InterviewStartResponse(BaseModel):
    request_id: str
    session_id: str
    questions: list[InterviewQuestionPrompt]
    selected_count: int


class InterviewEvaluateRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=200)
    track: Literal["qa", "python"] = "qa"
    language: Literal["en", "uk"] = "en"
    question_id: str = Field(min_length=1, max_length=200)
    answer: str = Field(min_length=1, max_length=20_000)


class InterviewEvaluationDraft(BaseModel):
    """Provider-generated part of an interview evaluation."""

    score: int = Field(ge=0, le=100)
    rating: Literal["weak", "partial", "good", "strong"]
    feedback: str = Field(min_length=1, max_length=4_000)
    strengths: list[str] = Field(default_factory=list, max_length=8)
    gaps: list[str] = Field(default_factory=list, max_length=8)
    follow_up_question: str | None = Field(default=None, max_length=2_000)
    recommended_topics: list[str] = Field(default_factory=list, max_length=8)


class InterviewEvaluation(InterviewEvaluationDraft):
    """Final evaluation enriched with trusted GimmeJob catalog data."""

    question_id: str
    reference_answer: str
    strong_answer_signals: list[str] = Field(default_factory=list)


class InterviewEvaluateResponse(BaseModel):
    request_id: str
    session_id: str
    model: str
    langfuse_tracing: bool
    evaluation: InterviewEvaluation


class HealthResponse(BaseModel):
    service: str
    version: str
    status: Literal["ok", "degraded"]
    environment: str
    model: str
    openai_configured: bool
    service_auth_configured: bool
    rag_configured: bool
    langfuse_configured: bool
    content_available: bool
