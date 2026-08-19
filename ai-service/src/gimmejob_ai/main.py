from __future__ import annotations

import logging
import secrets
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status

from . import __version__
from .agent import AssistantAgent
from .schemas import ChatRequest, ChatResponse, HealthResponse
from .settings import Settings, langfuse_configured

logger = logging.getLogger(__name__)


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

    assistant = AssistantAgent(runtime) if runtime.openai_configured else None

    @app.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        content_available = runtime.content_root.resolve().is_dir()
        ready = runtime.openai_configured and runtime.service_auth_configured and content_available
        return HealthResponse(
            service="gimmejob-ai",
            version=__version__,
            status="ok" if ready else "degraded",
            environment=runtime.environment,
            model=runtime.openai_model,
            openai_configured=runtime.openai_configured,
            service_auth_configured=runtime.service_auth_configured,
            langfuse_configured=langfuse_configured(),
            content_available=content_available,
        )

    def require_auth(authorization: str | None = Header(default=None)) -> None:
        _authorized(runtime, authorization)

    @app.post(
        "/v1/chat",
        response_model=ChatResponse,
        dependencies=[Depends(require_auth)],
    )
    async def chat(request: ChatRequest) -> ChatResponse:
        if assistant is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI is not configured.",
            )
        if request.messages[-1].role != "user":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
                detail="AI provider request failed.",
            ) from error

        return ChatResponse(
            request_id=request_id,
            session_id=session_id,
            model=runtime.openai_model,
            langfuse_tracing=traced,
            response=response,
        )

    return app


app = create_app()
