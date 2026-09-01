FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    GIMMEJOB_AI_CONTENT_ROOT=/app/content

WORKDIR /app

RUN python -m pip install --no-cache-dir uv==0.12.1

COPY ai-service/pyproject.toml /app/pyproject.toml
COPY ai-service/uv.lock /app/uv.lock
COPY ai-service/src /app/src
RUN uv sync --frozen --no-dev --no-build --no-install-project

COPY content /app/content

RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD /app/.venv/bin/python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1

CMD ["/app/.venv/bin/uvicorn", "gimmejob_ai.application:app", "--host", "0.0.0.0", "--port", "8000"]
