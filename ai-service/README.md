# GimmeJob AI service

This directory is the isolated Python AI backend for GimmeJob. The stack is FastAPI + LangChain + OpenAI + Langfuse Cloud, with no direct LangGraph API yet.

## Current capabilities

- `GET /health` reports configuration readiness without exposing secrets.
- `POST /v1/chat` provides the structured read-only assistant.
- `POST /v1/interviews/start` builds a reproducible interview set from the existing Git-versioned QA/Python interview catalogs.
- `POST /v1/interviews/evaluate` evaluates a candidate answer against the trusted catalog answer/signals and returns structured score, feedback, gaps, follow-up question and review topics.
- Interview start responses never expose the reference answer or strong-answer signals before the user answers.
- LangChain handles structured model output; Langfuse tracing is enabled automatically when its standard cloud credentials are configured.
- `search_site_content` searches the existing Git-versioned Markdown learning content.
- The service is still read-only with respect to GimmeJob runtime state: progress/session persistence belongs to the authenticated web application/D1 layer, not to this service.

The first search implementation is deterministic lexical retrieval. Its tool contract is deliberately stable so it can later be replaced by embeddings + PostgreSQL/pgvector without changing the assistant API.

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
```

For Langfuse Cloud tracing, create a project and add:

```text
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Run:

```bash
uvicorn gimmejob_ai.main:app --reload --port 8000
```

Check health:

```bash
curl http://127.0.0.1:8000/health
```

Call the assistant:

```bash
curl -X POST http://127.0.0.1:8000/v1/chat \
  -H "Authorization: Bearer $GIMMEJOB_AI_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Give me a short explanation of test design techniques"}]}'
```

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

Build from the repository root because the image includes the public `content/` directory:

```bash
docker build -f ai-service/Dockerfile -t gimmejob-ai .
```

Do not expose `/v1/chat` or `/v1/interviews/*` directly to the browser. The GimmeJob Worker should proxy authenticated requests to this service so the service token never reaches client code.
