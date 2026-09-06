from __future__ import annotations

import unittest
from types import SimpleNamespace

from gimmejob_ai.learning_path_stream import encode_sse, stream_learning_advisor
from gimmejob_ai.schemas import AssistantResponse, ChatMessage, LearningMap, LearningMapNode, WorkflowStep


class _FakeGraph:
    async def astream(self, state, config, stream_mode, version):
        self.state = state
        self.config = config
        self.stream_mode = stream_mode
        self.version = version

        contextualize = WorkflowStep(
            id="contextualize",
            label="Contextualize query",
            detail="Used the current prompt as the retrieval query.",
            duration_ms=1.25,
            input={"current_prompt": "Python parallelism", "message_count": 1},
            output={"retrieval_query": "Python parallelism", "language": "en"},
        )
        retrieve = WorkflowStep(
            id="retrieve",
            label="Retrieve canonical RAG context",
            detail="Found one canonical RAG material using vectorize.",
            duration_ms=10.5,
            input={"query": "Python parallelism", "language": "en", "limit": 8},
            output={"strategy": "vectorize", "result_count": 1, "route": "repository"},
        )
        compose = WorkflowStep(
            id="compose_repository",
            label="Compose grounded path",
            detail="LangChain produced structured advice from canonical RAG context.",
            duration_ms=25.0,
            input={"mode": "repository", "rag_excerpt_count": 1},
            output={"answer_chars": 24, "map_nodes": 1},
            token_usage={"input_tokens": 100, "output_tokens": 25, "total_tokens": 125},
        )
        verify = WorkflowStep(
            id="verify",
            label="Verify grounding and map",
            detail="Kept one verified GimmeJob source reference and a connected map.",
            duration_ms=2.0,
            input={"retrieval_mode": "repository", "declared_sources": 1},
            output={"verified_sources": 1, "connected": True},
        )
        response = AssistantResponse(
            answer="Repository-grounded path",
            sources=["python-interview/python-parallelism"],
            learning_map=LearningMap(
                title="Python parallelism",
                nodes=[
                    LearningMapNode(
                        id="parallelism",
                        title="Parallelism",
                        summary="Learn processes and their trade-offs.",
                        kind="concept",
                        source_path="python-interview/python-parallelism",
                    )
                ],
            ),
        )

        yield {
            "type": "updates",
            "ns": [],
            "data": {
                "contextualize_query": {
                    "query": "Python parallelism",
                    "language": "en",
                    "workflow_steps": [contextualize],
                }
            },
        }
        yield {
            "type": "updates",
            "ns": [],
            "data": {
                "retrieve_canonical_rag": {
                    "retrieval_mode": "repository",
                    "retrieval_strategy": "vectorize",
                    "embedding_model": "@cf/baai/bge-m3",
                    "retrieval_result_count": 1,
                    "retrieval_top_score": 0.92,
                    "workflow_steps": [contextualize, retrieve],
                }
            },
        }
        yield {
            "type": "updates",
            "ns": [],
            "data": {
                "compose_repository_answer": {
                    "draft_response": response,
                    "workflow_steps": [contextualize, retrieve, compose],
                }
            },
        }
        yield {
            "type": "updates",
            "ns": [],
            "data": {
                "verify_grounding_and_map": {
                    "response": response,
                    "workflow_steps": [contextualize, retrieve, compose, verify],
                }
            },
        }


class _FakeAdvisor:
    def __init__(self) -> None:
        self.settings = SimpleNamespace(openai_model="gpt-test", environment="test")
        self.graph = _FakeGraph()

    @staticmethod
    def _langfuse_handler():
        return None

    @staticmethod
    def _score_trace(root_span, state, response):
        raise AssertionError("No Langfuse root span should exist in this unit test")


class LearningPathStreamTests(unittest.IsolatedAsyncioTestCase):
    async def test_streams_real_graph_lifecycle_and_final_contract(self) -> None:
        advisor = _FakeAdvisor()
        events = [
            event
            async for event in stream_learning_advisor(
                advisor,
                messages=[ChatMessage(role="user", content="Python parallelism")],
                session_id="session-1",
                request_id="request-1",
            )
        ]

        self.assertEqual(advisor.graph.stream_mode, "updates")
        self.assertEqual(advisor.graph.version, "v2")
        self.assertEqual(
            [event["type"] for event in events],
            [
                "trace.start",
                "node.start",
                "node.complete",
                "node.start",
                "retrieval.complete",
                "node.complete",
                "node.start",
                "llm.start",
                "llm.complete",
                "node.complete",
                "node.start",
                "node.complete",
                "trace.complete",
                "result",
            ],
        )
        self.assertEqual([event["sequence"] for event in events], list(range(1, len(events) + 1)))
        self.assertEqual(events[0]["request_id"], "request-1")
        self.assertEqual(events[0]["prompt"], "Python parallelism")

        retrieval = next(event for event in events if event["type"] == "retrieval.complete")
        self.assertEqual(retrieval["strategy"], "vectorize")
        self.assertEqual(retrieval["result_count"], 1)
        self.assertEqual(retrieval["top_score"], 0.92)

        llm_complete = next(event for event in events if event["type"] == "llm.complete")
        self.assertEqual(llm_complete["token_usage"]["total_tokens"], 125)

        result = events[-1]["payload"]
        self.assertEqual(result["request_id"], "request-1")
        self.assertEqual(result["session_id"], "session-1")
        self.assertEqual(result["retrieval_mode"], "repository")
        self.assertEqual(result["workflow_steps"][2]["id"], "compose_repository")
        self.assertEqual(result["response"]["answer"], "Repository-grounded path")

    def test_encode_sse_outputs_one_data_frame(self) -> None:
        encoded = encode_sse({"type": "node.start", "sequence": 1, "label": "Retrieve"})
        self.assertTrue(encoded.startswith("data: "))
        self.assertTrue(encoded.endswith("\n\n"))
        self.assertIn('"type":"node.start"', encoded)


if __name__ == "__main__":
    unittest.main()
