"""HTTP bridge for the web demo: SSE chat stream + an approval endpoint.

One conversation per foster id, and the id comes from a verified Firebase ID
token — never from the request body. The tools reach Firestore through the Admin
SDK (`firestore_client.py`), which bypasses `firestore.rules` entirely, so this
service is the *only* thing standing between an anonymous caller and any foster's
journey. A body-supplied id would let anyone who knows a uid read and write that
person's record; the token is what makes "this is my journey" checkable.

The live `Agent` and its approval queue still live in memory per instance --
an approval is someone waiting mid-request, which can't be handed across a
process boundary anyway. The message transcript itself is durable: it's
persisted to Firestore (`session_store.py`) after every turn and reloaded
when a foster's session is rebuilt, so a Cloud Run restart or redeploy no
longer erases their conversation. `--min-instances=1 --max-instances=1`
(`deploy-backend.yml`) is still pinned -- that was a correctness fix for the
approval queue, not a durability one, and stays until that queue moves too.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import re
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Iterator

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel

from . import session_store
from .builtin import registry
from .current_foster import set_current_foster
from .firestore_client import _ensure_app
from .loop import Agent, model_for_surface

load_dotenv()

# Cloud Run runs this with --allow-unauthenticated because a browser can't mint a
# Google IAM token; the Firebase ID token below is the actual door. The origin list
# is a second, weaker lock — it stops a random site from spending a signed-in
# foster's session, but it's the token that decides whose data is reachable.
ALLOWED_ORIGINS = [
    "https://pawthway-hackathon.web.app",
    "https://pawthway-hackathon.firebaseapp.com",
    # Vite dev server. Both spellings, because it prints one and people type the other.
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app = FastAPI(title="pawthway agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
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
    "shelter's contact. Check the tool's notified_shelter field in its result: "
    "if it's true, tell the foster the shelter's contact was notified directly; "
    "if it's false, say plainly that no one was notified automatically and the "
    "dog's status update is the only record for now -- never claim the shelter "
    "was contacted when it wasn't.\n\n"
    "Prefer taking action with your tools over describing what the foster could "
    "do themselves, but never call a dangerous (writing) tool without it being "
    "clearly what was asked for."
)

_registry = registry()

# A Firebase Auth uid. Deliberately permissive about the alphabet -- uids are an
# opaque provider format and pinning it tighter would lock out real users. What this
# actually guards is the Firestore path: no slashes, no dots, no traversal.
_FOSTER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

# Bounded so a long-lived instance can't accumulate a session per visitor
# forever. Oldest-idle is evicted first; an evicted foster simply starts a new
# conversation on their next message.
MAX_SESSIONS = 200
SESSION_TTL_SECONDS = 3600


@dataclass
class Session:
    """One foster's conversation, plus the approval slot that turn is waiting on."""

    agent: Agent
    approvals: "queue.Queue[bool]" = field(default_factory=queue.Queue)
    last_used: float = field(default_factory=time.monotonic)


_sessions: "OrderedDict[str, Session]" = OrderedDict()
_sessions_lock = threading.Lock()


def _normalize_foster_id(raw: str | None) -> str | None:
    """The id reaches Firestore paths through the tools, so validate the shape.

    Verified-then-still-checked: a token claim is trustworthy about *who*, not about
    what characters it contains. Returns None rather than a default, because falling
    back to a real foster id here would hand the caller someone else's journey.
    """
    candidate = (raw or "").strip()
    return candidate if _FOSTER_ID_RE.match(candidate) else None


def require_foster_id(authorization: str | None = Header(default=None)) -> str:
    """Resolve the caller to a foster id, or refuse.

    Everything downstream of this uses the Admin SDK, so this is the trust boundary
    for the whole service: the id is taken from the token's `uid` claim and nowhere
    else. `verify_id_token` checks the signature, the audience, the issuer and the
    expiry, so a forged or stale token can't get past it.
    """
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Sign in to use the assistant.")

    _ensure_app()
    try:
        claims = firebase_auth.verify_id_token(token.strip())
    except Exception:
        # Deliberately one message for expired, malformed and forged: telling a caller
        # which one it was is free reconnaissance, and the fix is the same either way.
        logging.info("rejected an id token")
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")

    foster_id = _normalize_foster_id(claims.get("uid"))
    if foster_id is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return foster_id


# Per-instance, and Cloud Run runs several: the real ceiling is this times the
# instance count. It's a brake on one signed-in foster hammering the model, not a
# quota -- anything that has to hold exactly needs shared state (Firestore, Redis).
CHAT_REQUESTS_PER_MINUTE = 20
_REFILL_PER_SECOND = CHAT_REQUESTS_PER_MINUTE / 60


@dataclass
class _Bucket:
    tokens: float
    updated: float


_buckets: dict[str, _Bucket] = {}
_buckets_lock = threading.Lock()


def _take_chat_token(foster_id: str) -> bool:
    now = time.monotonic()
    with _buckets_lock:
        bucket = _buckets.get(foster_id)
        if bucket is None:
            # A bucket that has had time to refill completely carries no state worth
            # keeping, so dropping those is what stops this growing per visitor.
            full_after = CHAT_REQUESTS_PER_MINUTE / _REFILL_PER_SECOND
            for idle in [k for k, b in _buckets.items() if now - b.updated > full_after]:
                del _buckets[idle]
            bucket = _Bucket(tokens=float(CHAT_REQUESTS_PER_MINUTE), updated=now)
            _buckets[foster_id] = bucket

        bucket.tokens = min(
            float(CHAT_REQUESTS_PER_MINUTE),
            bucket.tokens + (now - bucket.updated) * _REFILL_PER_SECOND,
        )
        bucket.updated = now

        if bucket.tokens < 1:
            return False
        bucket.tokens -= 1
        return True


def _build_agent(foster_id: str, approvals: "queue.Queue[bool]") -> Agent:
    # Pinning the id in the system prompt is what stops the agent falling back to
    # the "annie" tool defaults and reading somebody else's journey.
    system = (
        f"{PAWTHWAY_SYSTEM}\n\n"
        f"The foster you are talking to has id \"{foster_id}\". Always pass "
        f"foster_id=\"{foster_id}\" to every tool that accepts it. Never use a "
        f"different foster id, and never answer using another foster's data."
    )
    return Agent(
        _registry,
        system=system,
        approve=lambda name, args: approvals.get(timeout=300),
    )


def _session(foster_id: str) -> Session:
    now = time.monotonic()
    with _sessions_lock:
        for stale in [k for k, s in _sessions.items() if now - s.last_used > SESSION_TTL_SECONDS]:
            del _sessions[stale]

        session = _sessions.get(foster_id)
        if session is None:
            approvals: "queue.Queue[bool]" = queue.Queue()
            agent = _build_agent(foster_id, approvals)
            # Rebuilding after an eviction, a restart or a redeploy: pick the
            # conversation back up instead of starting the foster over.
            agent.messages = session_store.load(foster_id)
            session = Session(agent=agent, approvals=approvals)
            _sessions[foster_id] = session
            while len(_sessions) > MAX_SESSIONS:
                _sessions.popitem(last=False)

        session.last_used = now
        _sessions.move_to_end(foster_id)
        return session


# None of these carry a foster id: which journey a request touches is decided by the
# token, so there is nothing for the body to say about it.
class ChatRequest(BaseModel):
    message: str
    # Which of the three surfaces is asking ("match", "careplan", "postfoster"),
    # which is what selects the model. Optional: a client that doesn't send it
    # gets the capable model, so an older build gets dearer, never worse.
    # NB: the foster id is NOT accepted here — it comes off the verified token.
    phase: str | None = None


class ApprovalRequest(BaseModel):
    approved: bool


class ResetRequest(BaseModel):
    pass


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


def _stream(message: str, session: Session, foster_id: str, model: str) -> Iterator[str]:
    # Set inside the generator, not in the endpoint: the generator body runs in its
    # own context while the response streams, so binding it here is what keeps two
    # overlapping conversations from resolving each other's foster id.
    set_current_foster(foster_id)
    # A session outlives the phase it started in — the same foster walks from Match
    # to Care Plan on one conversation — so the model is chosen per message, not at
    # construction. Switching mid-conversation is safe: a model that doesn't
    # recognise the thinking blocks already in the history ignores them.
    session.agent.model = model
    try:
        for ev in session.agent.run(message):
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
    finally:
        # Persist even on failure: whatever turns did complete before the
        # error should still survive a restart.
        try:
            session_store.save(foster_id, session.agent.messages)
        except Exception:
            logging.exception("failed to persist agent session for %s", foster_id)


@app.get("/health")
def health() -> dict[str, Any]:
    from . import arcade_tools

    with _sessions_lock:
        active = len(_sessions)

    return {
        "anthropic_key_set": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "arcade_available": arcade_tools.available(),
        "tool_count": len(_registry),
        "active_sessions": active,
    }


@app.get("/tools")
def list_tools() -> list[dict[str, Any]]:
    return [
        {"name": t.name, "description": t.description.split("\n")[0], "dangerous": t.dangerous}
        for t in sorted(_registry, key=lambda t: t.name)
    ]


@app.post("/chat")
def chat(req: ChatRequest, foster_id: str = Depends(require_foster_id)) -> StreamingResponse:
    if not _take_chat_token(foster_id):
        raise HTTPException(
            status_code=429,
            detail="That's a lot of questions at once. Give it a minute and try again.",
        )

    session = _session(foster_id)
    return StreamingResponse(
        _stream(req.message, session, foster_id, model_for_surface(req.phase)),
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


# Signed in only: the body is a foster's own journal about their dog, and an open
# endpoint that takes text and returns model output is also somebody else's free LLM.
@app.post("/highlights", dependencies=[Depends(require_foster_id)])
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
def approve(req: ApprovalRequest, foster_id: str = Depends(require_foster_id)) -> dict[str, bool]:
    # This is the release valve for the dangerous (writing) tools, so it needs the same
    # door as /chat -- otherwise an attacker triggers a write and approves it themselves.
    _session(foster_id).approvals.put(req.approved)
    return {"ok": True}


@app.post("/reset")
def reset(
    req: ResetRequest | None = None,
    foster_id: str = Depends(require_foster_id),
) -> dict[str, bool]:
    _session(foster_id).agent.reset()
    session_store.clear(foster_id)
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
