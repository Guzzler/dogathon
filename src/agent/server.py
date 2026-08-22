"""HTTP bridge for the web demo: SSE chat stream + an approval endpoint.

Single-session by design — one Agent, one pending approval slot. That's the
right amount of infrastructure for a live demo on a laptop; don't grow this
into a multi-tenant server without adding per-session state.
"""

from __future__ import annotations

import json
import os
import queue
from typing import Any, Iterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .builtin import registry
from .loop import Agent

load_dotenv()

app = FastAPI(title="dogathon agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_registry = registry()
_approval_box: "queue.Queue[bool]" = queue.Queue()
_agent = Agent(_registry, approve=lambda name, args: _approval_box.get(timeout=300))


class ChatRequest(BaseModel):
    message: str


class ApprovalRequest(BaseModel):
    approved: bool


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _stream(message: str) -> Iterator[str]:
    try:
        for ev in _agent.run(message):
            payload: dict[str, Any] = {"text": ev.text}
            if ev.name:
                payload["name"] = ev.name
            if ev.args:
                payload["args"] = ev.args
            if ev.kind == "tool_result":
                payload["is_error"] = ev.is_error
            yield _sse(ev.kind, payload)
    except Exception as exc:  # keep the stream alive long enough to report the failure
        yield _sse("error", {"text": f"{type(exc).__name__}: {exc}"})


@app.get("/health")
def health() -> dict[str, Any]:
    from . import arcade_tools

    return {
        "anthropic_key_set": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "arcade_available": arcade_tools.available(),
        "tool_count": len(_registry),
    }


@app.get("/tools")
def list_tools() -> list[dict[str, Any]]:
    return [
        {"name": t.name, "description": t.description.split("\n")[0], "dangerous": t.dangerous}
        for t in sorted(_registry, key=lambda t: t.name)
    ]


@app.post("/chat")
def chat(req: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(req.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/approve")
def approve(req: ApprovalRequest) -> dict[str, bool]:
    _approval_box.put(req.approved)
    return {"ok": True}


@app.post("/reset")
def reset() -> dict[str, bool]:
    _agent.reset()
    return {"ok": True}


def main() -> None:
    import uvicorn

    uvicorn.run("agent.server:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
