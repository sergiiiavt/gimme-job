from __future__ import annotations

import json
import logging
from contextlib import nullcontext
from time import perf_counter
from typing import Any, AsyncIterator, Literal, cast

from langchain_core.runnables import RunnableConfig
from langfuse import get_client, propagate_attributes

from .learning_path import LearningAdvisorGraph, LearningAdvisorState, _coerce_response
from .schemas import ChatMessage, LearningAdvisorResponse, WorkflowStep
from .settings import langfuse_configured

logger = logging.getLogger(__name__)

_NODE_LABELS = {
    "contextualize_query": "Contextualize query",
    "retrieve_canonical_rag": "Retrieve canonical RAG context",
    "compose_repository_answer": "Compose grounded path",
    "compose_general_answer": "Compose general path",
    "verify_grounding_and_map": "Verify grounding and map",
}
_COMPOSE_NODES = {"compose_repository_answer", "compose_general_answer"}


def _elapsed_ms(started: float) -> float:
    return round(max(0.0, (perf_counter() - started) * 1_000), 2)


def _step_from_update(update: dict[str, object]) -> WorkflowStep | None:
    raw_steps = update.get("workflow_steps")
    if not isinstance(raw_steps, list) or not raw_steps:
        return None
    try:
        return WorkflowStep.model_validate(raw_steps[-1])
    except Exception:
        return None


def _next_node(node_name: str, update: dict[str, object]) -> str | None:
    if node_name == "contextualize_query":
        return "retrieve_canonical_rag"
    if node_name == "retrieve_canonical_rag":
        return (
            "compose_repository_answer"
            if update.get("retrieval_mode") == "repository"
            else "compose_general_answer"
        )
    if node_name in _COMPOSE_NODES:
        return "verify_grounding_and_map"
    return None


def encode_sse(event: dict[str, object]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False, separators=(',', ':'))}\n\n"


async def stream_learning_advisor(
    advisor: LearningAdvisorGraph,
    messages: list[ChatMessage],
    session_id: str,
    request_id: str,
) -> AsyncIterator[dict[str, object]]:
    """Stream observable LangGraph execution while preserving the final response contract."""

    overall_started = perf_counter()
    sequence = 0

    def event(event_type: str, **payload: object) -> dict[str, object]:
        nonlocal sequence
        sequence += 1
        return {
            "type": event_type,
            "sequence": sequence,
            "elapsed_ms": _elapsed_ms(overall_started),
            **payload,
        }

    handler = advisor._langfuse_handler()
    tags = ["gimmejob-ai", "learning-path-advisor", "langgraph", advisor.settings.environment]
    config: RunnableConfig = {
        "run_name": "learning-path-advisor",
        "metadata": {
            "request_id": request_id,
            "service": "gimmejob-ai",
            "environment": advisor.settings.environment,
            "orchestration": "langgraph",
            "langfuse_session_id": session_id,
            "langfuse_tags": tags,
        },
        "tags": tags,
    }
    if handler is not None:
        config["callbacks"] = [handler]

    root_context = nullcontext(None)
    attribute_context = nullcontext()
    trace_url: str | None = None
    if handler is not None:
        try:
            langfuse = get_client()
            trace_id = langfuse.create_trace_id(seed=request_id)
            root_context = langfuse.start_as_current_observation(
                as_type="agent",
                name="learning-path-advisor",
                trace_context={"trace_id": trace_id},
                input={"messages": [message.model_dump() for message in messages]},
            )
            try:
                trace_url = langfuse.get_trace_url(trace_id=trace_id)
            except Exception:
                logger.warning("Langfuse trace URL generation failed; live trace remains active.")
            attribute_context = propagate_attributes(
                trace_name="Learning Path Advisor",
                session_id=session_id,
                tags=tags,
                metadata={
                    "requestid": request_id,
                    "service": "gimmejob-ai",
                    "environment": advisor.settings.environment,
                    "orchestration": "langgraph",
                },
            )
        except Exception:
            logger.warning("Langfuse live root trace initialization failed; callback tracing may be partial.")
            root_context = nullcontext(None)
            attribute_context = nullcontext()
            trace_url = None

    prompt = messages[-1].content.strip()
    yield event(
        "trace.start",
        request_id=request_id,
        session_id=session_id,
        model=advisor.settings.openai_model,
        orchestration="langgraph",
        langfuse_tracing=handler is not None,
        langfuse_trace_url=trace_url,
        prompt=prompt,
    )
    yield event(
        "node.start",
        node_id="contextualize_query",
        label=_NODE_LABELS["contextualize_query"],
    )

    state: dict[str, object] = {
        "messages": messages,
        "workflow_steps": [],
    }

    with root_context as root_span:
        with attribute_context:
            async for part in advisor.graph.astream(
                state,
                config=config,
                stream_mode="updates",
                version="v2",
            ):
                if part.get("type") != "updates":
                    continue
                updates = part.get("data")
                if not isinstance(updates, dict):
                    continue

                for node_name, raw_update in updates.items():
                    if node_name.startswith("__") or not isinstance(raw_update, dict):
                        continue
                    update = cast(dict[str, object], raw_update)
                    state.update(update)
                    step = _step_from_update(update)

                    if node_name in _COMPOSE_NODES:
                        yield event(
                            "llm.complete",
                            node_id=node_name,
                            label="OpenAI structured response complete",
                            token_usage=step.token_usage.model_dump() if step and step.token_usage else None,
                        )

                    if node_name == "retrieve_canonical_rag":
                        yield event(
                            "retrieval.complete",
                            node_id=node_name,
                            label="Canonical RAG retrieval complete",
                            strategy=update.get("retrieval_strategy", "none"),
                            embedding_model=update.get("embedding_model", ""),
                            result_count=update.get("retrieval_result_count", 0),
                            top_score=update.get("retrieval_top_score", 0.0),
                        )

                    yield event(
                        "node.complete",
                        node_id=node_name,
                        label=_NODE_LABELS.get(node_name, node_name),
                        step=step.model_dump() if step else None,
                    )

                    next_node = _next_node(node_name, update)
                    if next_node is not None:
                        yield event(
                            "node.start",
                            node_id=next_node,
                            label=_NODE_LABELS[next_node],
                        )
                        if next_node in _COMPOSE_NODES:
                            yield event(
                                "llm.start",
                                node_id=next_node,
                                label="OpenAI structured response started",
                                model=advisor.settings.openai_model,
                            )

        response = _coerce_response(state["response"])
        if root_span is not None:
            try:
                root_span.update(
                    output={
                        "answer": response.answer,
                        "sources": response.sources,
                        "learning_map": response.learning_map.model_dump(),
                    },
                    metadata={
                        "retrieval_strategy": state.get("retrieval_strategy", "none"),
                        "embedding_model": state.get("embedding_model", ""),
                        "retrieval_mode": state.get("retrieval_mode", "general"),
                    },
                )
                advisor._score_trace(root_span, cast(LearningAdvisorState, state), response)
            except Exception:
                logger.warning("Langfuse live root trace update failed; answer delivery continues.")

    mode = cast(Literal["repository", "general"], state["retrieval_mode"])
    steps = [
        step if isinstance(step, WorkflowStep) else WorkflowStep.model_validate(step)
        for step in cast(list[object], state["workflow_steps"])
    ]
    total_duration_ms = _elapsed_ms(overall_started)
    result = LearningAdvisorResponse(
        request_id=request_id,
        session_id=session_id,
        model=advisor.settings.openai_model,
        langfuse_tracing=handler is not None,
        langfuse_trace_url=trace_url,
        retrieval_mode=mode,
        total_duration_ms=total_duration_ms,
        workflow_steps=steps,
        response=response,
    )

    yield event(
        "trace.complete",
        request_id=request_id,
        retrieval_mode=mode,
        total_duration_ms=total_duration_ms,
        workflow_steps=len(steps),
    )
    yield event("result", payload=result.model_dump())
