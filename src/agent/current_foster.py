"""Which foster the agent is currently acting for.

Every tool takes a `foster_id`, but the model shouldn't have to know or guess a
Firebase uid — the web client already knows who is signed in and sends it with
each chat request, and the tools resolve an omitted id against it.

This is a ContextVar, not a module global, and that distinction is load-bearing.
A plain global is shared by every request in the process: with two people
chatting at once, the second request's id overwrites the first while the first's
stream is still open, and that stream's tool calls then read and write the wrong
person's journey. The value is set inside the streaming generator (see
`server._stream`), so each stream carries its own no matter how requests
interleave.
"""

from __future__ import annotations

from contextvars import ContextVar

# Falls back to the seeded demo foster so CLI use and local testing still work.
DEMO_FOSTER_ID = "annie"

_current: ContextVar[str] = ContextVar("current_foster", default=DEMO_FOSTER_ID)


def set_current_foster(foster_id: str | None) -> None:
    _current.set(foster_id.strip() if foster_id and foster_id.strip() else DEMO_FOSTER_ID)


def current_foster() -> str:
    return _current.get()


def resolve(foster_id: str = "") -> str:
    """An omitted id means "whoever this conversation belongs to"."""
    return foster_id.strip() if foster_id and foster_id.strip() else _current.get()
