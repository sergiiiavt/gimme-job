# GimmeJob AI service

This directory is the isolated Python AI backend for GimmeJob. The stack is FastAPI + LangGraph + LangChain + OpenAI + Langfuse Cloud.

## Current capabilities

- `GET /health` reports OpenAI, service-auth, canonical-RAG, Langfuse, and content readiness without exposing secrets.
- `POST /v1/chat` provides the structured read-only assistant.
- `POST /v1/learning-path` runs an explicit LangGraph workflow: contextualize the conversation → retrieve from the single GimmeJob RAG pipeline → choose grounded/general composition → verify source attribution and map connectivity.
- `POST /v1/interviews/start` builds a reproducible interview set from the Git-versioned QA/Python interview catalogs.
- `POST /v1/interviews/evaluate` evaluates a candidate answer against the trusted catalog answer/signals.
- LangGraph owns orchestration; LangChain owns model/message/structured-output integration; OpenAI generates the structured answer.
- The Python service does **not** maintain its own second search index or lexical retriever. It calls the authenticated canonical Worker RAG endpoint.
- The canonical Worker RAG uses Cloudflare Workers AI + Vectorize when available and degrades to lexical ranking inside the same pipeline. Git/D1 remain authoritative sources.
- Langfuse callbacks capture the LangGraph/model execution. A root Learning Path trace also records canonical retrieval strategy, embedding model, retrieved IDs/scores, and deterministic runtime quality scores.
- Supported OpenAI generations report token usage through the LangChain/Langfuse integration; Langfuse model definitions turn that usage into per-generation and aggregate cost.
- The service remains read-only with respect to GimmeJob runtime state.

## Local setup

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e .
cp .env.example .env
```

Set at least:

```text
GIMMEJOB_AI_OPENAI_API_KEY=...
GIMMEJOB_AI_SERVICE_TOKEN=use-a-long-random-value
GIMMEJOB_AI_RAG_URL=http://127.0.0.1:<gimmejob-port>/internal/rag/search
GIMMEJOB_AI_RAG_SERVICE_TOKEN=use-a-second-long-random-value
```

The Worker must receive the same second value as `GIMMEJOB_RAG_SERVICE_TOKEN`.

For Langfuse Cloud tracing and cost observability, create a project and add:

```text
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_TRACING_ENVIRONMENT=development
```

Run the normal GimmeJob Worker locally so `/internal/rag/search` is reachable, then run the AI service:

```bash
uvicorn gimmejob_ai.main:app --reload --port 8000
```

Check health:

```bash
curl http://127.0.0.1:8000/health
```

A fully ready service reports `openai_configured`, `service_auth_configured`, and `rag_configured` as `true`. Langfuse is optional for answer delivery, so `langfuse_configured` may be false without degrading the core request path.

Call the assistant:

```bash
curl -X POST http://127.0.0.1:8000/v1/chat \
  -H "Authorization: Bearer $GIMMEJOB_AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Give me a short explanation of test design techniques"}]}'
```

Build a connected learning path:

```bash
curl -X POST http://127.0.0.1:8000/v1/learning-path \
  -H "Authorization: Bearer $GIMMEJOB_AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"demo-session","messages":[{"role":"user","content":"Python parallelism"}]}'
```

The response reports `orchestration: "langgraph"`, grounded/general `retrieval_mode`, the executed workflow steps, and a bounded `response.learning_map`.

## Langfuse observability and RAG quality

One learning-path request is intended to produce one root trace with:

```text
Learning Path Advisor
  contextualize_query
  retrieve_canonical_rag
    canonical-rag-retrieval
  compose_repository_answer | compose_general_answer
    OpenAI generation (tokens + cost when model pricing is known)
  verify_grounding_and_map
```

Runtime trace scores currently include:

- `map_connected`
- `retrieval_result_count`
- `retrieval_top_score`
- `grounded_node_ratio` for grounded answers
- `source_validity` for grounded answers

`rag_metrics.py` provides deterministic offline ranking metrics for Langfuse dataset/experiment runs:

- Precision@K
- Recall@K
- Hit Rate@K
- Reciprocal Rank (MRR when aggregated)
- nDCG@K

Faithfulness/groundedness, answer relevance, completeness/correctness, and citation quality belong in the Langfuse evaluation layer (LLM-as-a-Judge or Ragas) rather than in the production answer code. Retrieval thresholds should be tuned against those labeled experiments rather than hand-optimized from individual prompts.

Start an interview:

```bash
curl -X POST http://127.0.0.1:8000/v1/interviews/start \
  -H "Authorization: Bearer $GIMMEJOB_AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"track":"qa","language":"en","question_count":5,"levels":["Middle","Senior"]}'
```

Evaluate one answer using the returned `session_id` and `question_id`:

```bash
curl -X POST http://127.0.0.1:8000/v1/interviews/evaluate \
  -H "Authorization: Bearer $GIMMEJOB_AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"...","track":"qa","language":"en","question_id":"...","answer":"..."}'
```

## Tests

```bash
python -m unittest discover -s tests -v
```

## Docker

Build from the repository root because the image includes the public `content/` directory used by deterministic interview start/evaluation data:

```bash
docker build -f ai-service/Dockerfile -t gimmejob-ai .
```

Do not expose `/v1/chat`, `/v1/learning-path`, or `/v1/interviews/*` directly to the browser. The GimmeJob Worker proxies browser requests so the AI service token never reaches client code. The canonical RAG endpoint is separately protected by `GIMMEJOB_RAG_SERVICE_TOKEN`.
