"""HTTP bridge for the web demo: SSE chat stream + an approval endpoint.

Single-session by design — one Agent, one pending approval slot. That's the
right amount of infrastructure for a live demo on a laptop; don't grow this
into a multi-tenant server without adding per-session state.
"""

from __future__ import annotations

import json
import logging
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

app = FastAPI(title="pawthway agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PAWTHWAY_SYSTEM = (
    "You are the Pawthway foster assistant, embedded in a foster's journey app. "
    "You're used in exactly three moments: (1) coordinating pickup with the foster "
    "once they've scheduled it in the Match phase, (2) answering a foster's questions "
    "about caring for their matched dog during the Care Plan phase, and (3) drafting "
    "and sending the dog's adoption profile back to the shelter at the end of the "
    "foster window (Post Foster Plan).\n\n"
    "For pickup coordination: the foster sees this chat as talking to their shelter's "
    "foster coordinator, so answer in that voice -- warm, practical, first-person "
    "plural for the shelter (\"we'll have her ready\"). Call get_foster to read the "
    "confirmed pickup date, time and location, and get_dog for the dog itself. Confirm "
    "the slot works, then answer the ordinary logistics fosters ask about: what to "
    "bring (carrier or leash and collar, a towel, proof of address), how long the "
    "handoff takes (about 30 minutes of paperwork and a walkthrough), parking, what "
    "goes home with the dog (medical records, current food, any meds), and who to "
    "contact on the day. You don't have real parking maps or staff rosters -- speak "
    "generally rather than inventing specifics, and don't change the pickup unless the "
    "foster asks you to.\n\n"
    "For care questions: look up the foster and their matched dog with get_foster "
    "and get_dog before answering, so advice is grounded in that specific dog's "
    "notes (temperament, medical needs, etc). Draw on real foster wisdom for "
    "common pain points -- crate training (e.g. feeding meals in the crate to "
    "build a positive association), food indiscretion (what dogs can't safely "
    "eat), and behavior issues like nipping/biting (e.g. redirecting to a towel "
    "or chew toy instead of hands). Keep answers short, practical, and warm.\n\n"
    "For adoption profiles: call generate_adoption_profile to gather the dog's "
    "record, the foster's notes, and the full care log, then write a warm, "
    "specific, one-paragraph adoption profile in your text reply (don't just "
    "repeat the raw data). Once the foster approves it, call "
    "send_adoption_profile_to_shelter with that exact text to close out the "
    "journey. If a Gmail or Slack tool is available, also use it to notify the "
    "shelter's contact.\n\n"
    "Prefer taking action with your tools over describing what the foster could "
    "do themselves, but never call a dangerous (writing) tool without it being "
    "clearly what was asked for."
)

_registry = registry()
_approval_box: "queue.Queue[bool]" = queue.Queue()
_agent = Agent(
    _registry,
    system=PAWTHWAY_SYSTEM,
    approve=lambda name, args: _approval_box.get(timeout=300),
)


class ChatRequest(BaseModel):
    message: str


class ApprovalRequest(BaseModel):
    approved: bool


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _friendly_error(exc: Exception) -> dict[str, str]:
    """Turn a provider exception into something safe to show a foster.

    The raw text from the SDK is a JSON blob with a request id in it — useless to
    the person reading, and it leaks how the thing is wired. The real exception is
    logged for whoever is on call; the browser gets a sentence and a code it can
    branch on.
    """
    status = getattr(exc, "status_code", None)
    name = type(exc).__name__

    if status == 401 or "authentication_error" in str(exc):
        code, text = "auth", "The assistant isn't set up correctly right now. The team has been notified."
    elif status == 429 or "rate_limit" in str(exc):
        code, text = "rate_limit", "Lots of people are asking questions right now. Try again in a moment."
    elif status is not None and 500 <= status < 600:
        code, text = "upstream", "The assistant is having trouble right now. Try again in a moment."
    elif name in {"APIConnectionError", "APITimeoutError", "ConnectionError", "TimeoutError"}:
        code, text = "network", "Couldn't reach the assistant. Check your connection and try again."
    else:
        code, text = "unknown", "Something went wrong on our side. Try again in a moment."

    logging.exception("agent stream failed (code=%s)", code)
    return {"text": text, "code": code}


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
        yield _sse("error", _friendly_error(exc))


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


class HighlightsRequest(BaseModel):
    notes: list[str]


# Kept small on purpose: one instruction, the journal lines, a 300-token ceiling. The adoption
# page waits on this, so it runs on Haiku with no tools — the job is only to compress what the
# foster wrote into the things an adopter actually asks about.
HIGHLIGHTS_SYSTEM = (
    "You summarise a foster carer's journal about a dog into notes for an adoption profile."
)
HIGHLIGHTS_PROMPT = (
    "Notes written by the foster over the whole foster period:\n{notes}\n\n"
    "Reply with exactly two lines.\n"
    "TAGS: 3-6 comma-separated tags, 1-2 words, lowercase "
    "(e.g. potty-trained, energetic, good-with-kids)\n"
    "SUMMARY: 2-4 sentences an adopter needs — house-training, temperament with people and "
    "other animals, energy level, anxieties, medical needs, and progress made.\n\n"
    "Write the summary as one overall picture of the dog. Do not go entry by entry or "
    "day by day, and do not mention dates. Only describe what the notes actually say — "
    "do not invent details."
)


@app.post("/highlights")
def highlights(req: HighlightsRequest) -> dict[str, Any]:
    """Summarise journal entries into adoption-profile tags and a short write-up.

    Returns empty values rather than erroring when there's no key or nothing logged, so the
    adoption page just shows its empty state instead of breaking.
    """
    notes = [n.strip() for n in req.notes if n and n.strip()]
    if not notes or not os.environ.get("ANTHROPIC_API_KEY"):
        return {"tags": [], "summary": ""}

    import anthropic

    try:
        resp = anthropic.Anthropic().messages.create(
            model="claude-haiku-4-5",
            max_tokens=300,
            system=HIGHLIGHTS_SYSTEM,
            messages=[{
                "role": "user",
                "content": HIGHLIGHTS_PROMPT.format(
                    notes="\n".join(f"- {n}" for n in notes[-40:])
                ),
            }],
        )
    except Exception:
        return {"tags": [], "summary": ""}

    text = "".join(b.text for b in resp.content if b.type == "text")

    tags: list[str] = []
    summary = ""
    for line in text.splitlines():
        line = line.strip()
        if line.upper().startswith("TAGS:"):
            for raw in line.split(":", 1)[1].split(","):
                tag = raw.strip().strip(".").lower()
                if tag and len(tag) <= 24 and tag not in tags:
                    tags.append(tag)
        elif line.upper().startswith("SUMMARY:"):
            summary = line.split(":", 1)[1].strip()
        elif summary and line:  # a summary that wrapped onto the next line
            summary += " " + line

    return {"tags": tags[:6], "summary": summary}


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

    # Cloud Run sets PORT and expects the app to bind 0.0.0.0; local dev
    # keeps the old 127.0.0.1:8000 with reload for a fast edit loop.
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0" if "PORT" in os.environ else "127.0.0.1"
    uvicorn.run("agent.server:app", host=host, port=port, reload="PORT" not in os.environ)


if __name__ == "__main__":
    main()
