from __future__ import annotations

import logging
import secrets
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status

from . import __version__
from .agent import AssistantAgent
from .interview import InterviewEvaluator, find_interview_question, select_interview_questions
from .learning_path import LearningAdvisorGraph
from .schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    InterviewEvaluateRequest,
    InterviewEvaluateResponse,
    InterviewStartRequest,
    InterviewStartResponse,
    LearningAdvisorResponse,
)
from .settings import Settings, langfuse_configured

logger = logging.getLogger(__name__)

_OPENAI_NOT_CONFIGURED_DETAIL = "OpenAI is not configured."
_RAG_NOT_CONFIGURED_DETAIL = "Canonical RAG is not configured."
_AI_PROVIDER_FAILED_DETAIL = "AI provider request failed."


def _authorized(settings: Settings, authorization: str | None) -> None:
    if not settings.service_auth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service authentication is not configured.",
        )

    prefix = "Bearer "
    if not authorization or not authorization.startswith(prefix):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    supplied = authorization[len(prefix) :].strip()
    expected = settings.service_token.get_secret_value()
    if not supplied or not secrets.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token.",
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime = settings or Settings()
    app = FastAPI(
        title="GimmeJob AI",
        version=__version__,
        docs_url="/docs" if runtime.environment != "production" else None,
        redoc_url=None,
    )

    rag_ai_ready = runtime.openai_configured and runtime.rag_configured
    assistant = AssistantAgent(runtime) if rag_ai_ready else None
    learning_advisor = LearningAdvisorGraph(runtime) if rag_ai_ready else None
    interview_evaluator = InterviewEvaluator(runtime) if runtime.openai_configured else None

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        content_available = runtime.content_root.resolve().is_dir()
        ready = (
            runtime.openai_configured
            and runtime.service_auth_configured
            and runtime.rag_configured
            and content_available
        )
        return HealthResponse(
            service="gimmejob-ai",
            version=__version__,
            status="ok" if ready else "degraded",
            environment=runtime.environment,
            model=runtime.openai_model,
            openai_configured=runtime.openai_configured,
            service_auth_configured=runtime.service_auth_configured,
            rag_configured=runtime.rag_configured,
            langfuse_configured=langfuse_configured(),
            content_available=content_available,
        )

    def require_auth(authorization: str | None = Header(default=None)) -> None:
        _authorized(runtime, authorization)

    def require_rag_ai(component: object | None) -> None:
        if not runtime.openai_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_OPENAI_NOT_CONFIGURED_DETAIL,
            )
        if not runtime.rag_configured or component is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_RAG_NOT_CONFIGURED_DETAIL,
            )

    @app.post(
        "/v1/chat",
        response_model=ChatResponse,
        dependencies=[Depends(require_auth)],
    )
    async def chat(request: ChatRequest) -> ChatResponse:
        require_rag_ai(assistant)
        if request.messages[-1].role != "user":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The final message must have role 'user'.",
            )

        request_id = uuid4().hex
        session_id = request.session_id or uuid4().hex
        try:
            response, traced = await assistant.answer(
                messages=request.messages,
                session_id=session_id,
                request_id=request_id,
            )
        except Exception as error:
            logger.warning("AI request failed with %s", type(error).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_AI_PROVIDER_FAILED_DETAIL,
            ) from error

        return ChatResponse(
            request_id=request_id,
            session_id=session_id,
            model=runtime.openai_model,
            langfuse_tracing=traced,
            response=response,
        )

    @app.post(
        "/v1/learning-path",
        dependencies=[Depends(require_auth)],
    )
    async def learning_path(request: ChatRequest) -> LearningAdvisorResponse:
        require_rag_ai(learning_advisor)
        if request.messages[-1].role != "user":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="The final message must have role 'user'.",
            )

        request_id = uuid4().hex
        session_id = request.session_id or uuid4().hex
        try:
            response, traced, retrieval_mode, workflow_steps = await learning_advisor.answer(
                messages=request.messages,
                session_id=session_id,
                request_id=request_id,
            )
        except Exception as error:
            logger.warning("Learning path request failed with %s", type(error).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_AI_PROVIDER_FAILED_DETAIL,
            ) from error

        return LearningAdvisorResponse(
            request_id=request_id,
            session_id=session_id,
            model=runtime.openai_model,
            langfuse_tracing=traced,
            retrieval_mode=retrieval_mode,
            workflow_steps=workflow_steps,
            response=response,
        )

    @app.post(
        "/v1/interviews/start",
        response_model=InterviewStartResponse,
        dependencies=[Depends(require_auth)],
    )
    async def start_interview(request: InterviewStartRequest) -> InterviewStartResponse:
        request_id = uuid4().hex
        session_id = request.session_id or uuid4().hex
        questions = select_interview_questions(
            content_root=runtime.content_root,
            track=request.track,
            language=request.language,
            session_id=session_id,
            question_count=request.question_count,
            levels=request.levels,
            categories=request.categories,
        )
        if not questions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="No interview questions match the selected filters.",
            )
        return InterviewStartResponse(
            request_id=request_id,
            session_id=session_id,
            questions=questions,
            selected_count=len(questions),
        )

    @app.post(
        "/v1/interviews/evaluate",
        response_model=InterviewEvaluateResponse,
        dependencies=[Depends(require_auth)],
    )
    async def evaluate_interview_answer(request: InterviewEvaluateRequest) -> InterviewEvaluateResponse:
        if interview_evaluator is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=_OPENAI_NOT_CONFIGURED_DETAIL,
            )
        question = find_interview_question(runtime.content_root, request.track, request.question_id)
        if question is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Interview question not found.",
            )

        request_id = uuid4().hex
        try:
            evaluation, traced = await interview_evaluator.evaluate(
                question=question,
                answer=request.answer,
                language=request.language,
                session_id=request.session_id,
                request_id=request_id,
            )
        except Exception as error:
            logger.warning("Interview evaluation failed with %s", type(error).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_AI_PROVIDER_FAILED_DETAIL,
            ) from error

        return InterviewEvaluateResponse(
            request_id=request_id,
            session_id=request.session_id,
            model=runtime.openai_model,
            langfuse_tracing=traced,
            evaluation=evaluation,
        )

    return app


app = create_app()
