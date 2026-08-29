"""Durable storage for a foster's agent conversation history.

`server.py`'s in-memory `Session` still holds the live `Agent`. What survives
a Cloud Run restart or redeploy is the message transcript: without this, every
merge to `src/**` silently drops every foster's conversation. The approval
handoff, which used to be the other half of a `Session` and the reason
`--max-instances=1` was pinned, now lives on this same document as a polled
`pendingApproval` field -- see `approval_store.py`.

Stored at `fosters/{uid}/agentSession/current`, not a field on the foster's
main document -- that document is read in full by the web client on every
load, and a transcript growing on it would inflate every unrelated read.
`Agent.messages` is JSON-serializable but not Firestore-native (a message's
`content` can itself be a list of block dicts), so it's stored as a single
JSON string field rather than a native array/map, sidestepping any question
of how deep Firestore lets map-nested arrays go.
"""

from __future__ import annotations

import json
from typing import Any

from .firestore_client import db

# Keeps the stored document bounded for a long-running conversation; a
# foster who needs earlier context can just re-ask. Each turn appends
# roughly two entries (a user message and an assistant reply, more with
# tool calls), so 40 is a starting guess at ~20 turns, not a measured cap.
MAX_STORED_MESSAGES = 40


def _doc(foster_id: str):
    return db().collection("fosters").document(foster_id).collection("agentSession").document("current")


def load(foster_id: str) -> list[dict[str, Any]]:
    """The stored transcript for a foster, oldest first, or empty if none."""
    snap = _doc(foster_id).get()
    if not snap.exists:
        return []
    raw = (snap.to_dict() or {}).get("messagesJson")
    if not raw:
        return []
    try:
        return list(json.loads(raw))
    except (TypeError, ValueError):
        return []


def save(foster_id: str, messages: list[dict[str, Any]]) -> None:
    """Overwrite the stored transcript, trimmed to the most recent turns."""
    trimmed = messages[-MAX_STORED_MESSAGES:]
    # merge=True because this document is shared: `approval_store.py` keeps the
    # pending-approval field on it, and a plain set() here would delete a request
    # a turn elsewhere is parked on.
    _doc(foster_id).set({"messagesJson": json.dumps(trimmed)}, merge=True)


def clear(foster_id: str) -> None:
    """Drop the stored transcript, e.g. when the foster starts a fresh chat."""
    _doc(foster_id).delete()
