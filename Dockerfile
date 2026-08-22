FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
COPY src ./src
COPY README.md ./

RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Cloud Run sets PORT; server.py reads it and binds 0.0.0.0 automatically.
CMD ["uv", "run", "agent-server"]
