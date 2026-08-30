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

# Two bounds in one number. It keeps the stored document from growing without
# limit, and -- since `server._stream` applies `trim()` to the live
# `Agent.messages` at the end of every turn -- it also bounds what gets re-sent
# to the model each turn on a warm instance. That second half is the one that
# costs money: before PH-10 nothing trimmed the in-memory list, so the cap only
# bit across a restart. Each turn appends roughly two entries (a user message
# and an assistant reply, more with tool calls), so 40 is a starting guess at
# ~20 turns, not a measured cap.
MAX_STORED_MESSAGES = 40


def _starts_clean_turn(message: dict[str, Any]) -> bool:
    """True if a transcript beginning at this message is one the API will accept.

    That means a `user` message that isn't the *result* half of a tool call --
    a transcript opening with a `tool_result` refers to a `tool_use` block that
    is no longer there, and the API rejects it.
    """
    if message.get("role") != "user":
        return False
    content = message.get("content")
    if not isinstance(content, list):
        return True  # a plain string user message
    return not any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )


def trim(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The most recent turns, cut where the API can still parse the result.

    A blind `messages[-MAX:]` is wrong and fails *intermittently*: cut between
    an assistant's `tool_use` block and the matching `tool_result` and the next
    request 400s. So the cut point walks backwards to the nearest message that
    starts a clean turn. If there is no such message, keep everything -- over-
    keeping costs tokens, under-keeping breaks the conversation.
    """
    if len(messages) <= MAX_STORED_MESSAGES:
        return messages
    cut = len(messages) - MAX_STORED_MESSAGES
    for idx in range(cut, -1, -1):
        if _starts_clean_turn(messages[idx]):
            return messages[idx:]
    return messages


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
    trimmed = trim(messages)
    # merge=True because this document is shared: `approval_store.py` keeps the
    # pending-approval field on it, and a plain set() here would delete a request
    # a turn elsewhere is parked on.
    _doc(foster_id).set({"messagesJson": json.dumps(trimmed)}, merge=True)


def clear(foster_id: str) -> None:
    """Drop the stored transcript, e.g. when the foster starts a fresh chat."""
    _doc(foster_id).delete()
