"""The approval handoff, in shared state instead of one process's memory.

A dangerous tool call parks the request thread until a human answers. That
used to be a `queue.Queue[bool]` living on the in-memory `Session`: the
thread blocked on `.get(timeout=300)` and `/approve` called `.put()`. A
parked thread is not serializable and a second Cloud Run instance has no way
to hand a bool to a thread sitting in another container, so `/approve`
landing on the wrong instance would silently do nothing and the foster would
watch a spinner for the full 300 seconds. That is the whole reason
`--max-instances=1` is pinned in `deploy-backend.yml`.

The replacement is deliberately boring: the waiting thread writes a pending
request to `fosters/{uid}/agentSession/current` (the document
`session_store.py` already owns) and **polls** it until a decision appears.
A Firestore real-time listener would be the tempting alternative and is a
second concurrency model inside a thread that is already blocking, with its
own background thread and callback ordering to reason about; a poll is a
loop and a sleep. At one read per second for at most 300 seconds, an
unanswered approval costs 300 document reads -- a rounding error against
what the model call in the same turn costs.

Both sides of this run in the server via the Admin SDK, which bypasses
`firestore.rules`, so the subcollection stays owner-read / no-client-write
exactly as PH-3 left it. The foster's browser never writes this field; it
POSTs `/approve` like it always did.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from .firestore_client import db

# The same ceiling the blocking `queue.get(timeout=300)` had. An approval
# nobody answers has to end somewhere, and the failure mode that matters is
# hanging forever, not ending a few seconds early.
APPROVAL_TIMEOUT_SECONDS = 300

# One read per second while someone is deciding. Low enough that the tool call
# resumes as fast as a human perceives, high enough that the read count stays
# trivial. Turned into an argument on `wait()` so the tests don't sleep.
POLL_INTERVAL_SECONDS = 1.0

_FIELD = "pendingApproval"


def _doc(foster_id: str):
    return (
        db()
        .collection("fosters")
        .document(foster_id)
        .collection("agentSession")
        .document("current")
    )


def _pending(foster_id: str) -> dict[str, Any] | None:
    snap = _doc(foster_id).get()
    if not snap.exists:
        return None
    value = (snap.to_dict() or {}).get(_FIELD)
    return value if isinstance(value, dict) else None


def request(foster_id: str, tool_name: str) -> str:
    """Record that a turn is waiting on a human, and return the request's id.

    The id is what makes a stale answer harmless: `/approve` always answers
    whatever is currently pending, and `wait()` only accepts a decision
    carrying the id it asked with. A decision for a request that has already
    timed out cannot resolve the next one by accident.
    """
    request_id = uuid.uuid4().hex
    # merge=True: this document also holds the transcript (`messagesJson`),
    # which must survive an approval being written beside it.
    _doc(foster_id).set(
        {
            _FIELD: {
                "requestId": request_id,
                "tool": tool_name,
                "decision": None,
                "requestedAt": time.time(),
            }
        },
        merge=True,
    )
    return request_id


def resolve(foster_id: str, approved: bool) -> bool:
    """Answer whatever this foster is currently waiting on.

    Returns False when nothing was pending -- a duplicate `/approve`, or one
    for a request that already timed out. That is worth logging and is not
    worth erroring: the caller is a browser that may simply have double-fired.
    """
    pending = _pending(foster_id)
    if pending is None or pending.get("decision") is not None:
        return False

    pending = dict(pending)
    pending["decision"] = bool(approved)
    pending["decidedAt"] = time.time()
    _doc(foster_id).set({_FIELD: pending}, merge=True)
    return True


def clear(foster_id: str) -> None:
    """Drop any pending request. Written as null rather than deleted so this
    needs no `DELETE_FIELD` sentinel import; readers treat both the same."""
    _doc(foster_id).set({_FIELD: None}, merge=True)


def wait(
    foster_id: str,
    request_id: str,
    timeout: float = APPROVAL_TIMEOUT_SECONDS,
    poll: float = POLL_INTERVAL_SECONDS,
    now: Any = time.monotonic,
    sleep: Any = time.sleep,
) -> bool:
    """Block until the human answers, the request is superseded, or time runs out.

    Every exit that isn't an explicit approval returns False, i.e. declined.
    Denying on timeout rather than raising is a deliberate change from the
    `queue.Empty` the old code let escape: an exception there aborted the
    stream leaving an assistant `tool_use` block in the transcript with no
    matching `tool_result`, which the next request would then send back to the
    API. Declining keeps the conversation well-formed and tells the foster
    plainly that nobody answered.
    """
    deadline = now() + timeout
    while True:
        try:
            pending = _pending(foster_id)
        except Exception:
            # A transient Firestore failure must not decide the question by
            # itself; keep polling until the deadline says otherwise.
            logging.exception("approval poll failed for %s", foster_id)
            pending = None
        else:
            if pending is None or pending.get("requestId") != request_id:
                # Superseded (a `/reset`, or a newer request) -- nobody is
                # coming to answer this one.
                return False
            decision = pending.get("decision")
            if decision is not None:
                clear(foster_id)
                return bool(decision)

        if now() >= deadline:
            logging.info("approval timed out for %s (request %s)", foster_id, request_id)
            clear(foster_id)
            return False
        sleep(poll)
