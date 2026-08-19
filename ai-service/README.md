# GimmeJob AI service

This directory is the isolated Python AI backend for GimmeJob. It intentionally starts small: FastAPI + LangChain + OpenAI + Langfuse Cloud, with no direct LangGraph API yet.

## Current milestone

- `GET /health` reports configuration readiness without exposing secrets.
- `POST /v1/chat` is protected by a server-to-server bearer token.
- LangChain `create_agent` handles the model/tool loop and structured output.
- `search_site_content` searches the existing Git-versioned Markdown learning content.
- Langfuse tracing is enabled automatically when its standard cloud credentials are configured.
- The agent is read-only: it cannot mutate GimmeJob state or call external action tools.

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

## Tests

```bash
python -m unittest discover -s tests -v
```

## Docker

Build from the repository root because the image includes the public `content/` directory:

```bash
docker build -f ai-service/Dockerfile -t gimmejob-ai .
```

Do not expose `/v1/chat` directly to the browser. The GimmeJob Worker will later proxy authenticated requests to this service so the service token never reaches client code.
