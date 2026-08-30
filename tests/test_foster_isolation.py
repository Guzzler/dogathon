"""Two correctness properties with a privacy consequence, neither previously tested.

`CLAUDE.md` states both outright -- that `current_foster` must stay a ContextVar
set inside the streaming generator ("don't simplify it back to a global"), and
that `server.py` keeps one `Agent` per foster id so one foster's questions can't
surface in another's transcript. Both are the kind of thing a well-meaning
simplification deletes, and until PH-12 the only thing standing behind either was
a paragraph of prose.

Nothing here refactors `server.py` to be testable: the model call is stubbed and
the plumbing around it is exercised as it ships. `_stream` is driven in two real
threads because that is how it actually runs -- FastAPI iterates a sync generator
in a threadpool worker, and it is the per-thread context that keeps two streams
apart. Interleaving two generators inside one thread would prove nothing.
"""

from __future__ import annotations

import threading
from typing import Any, Iterator

import pytest

from agent import server
from agent.current_foster import current_foster
from agent.loop import Event


class FakeAgent:
    """Stands in for `Agent`: same three attributes `_stream` touches."""

    def __init__(self, marker: str = "") -> None:
        self.messages: list[dict[str, Any]] = []
        self.model = ""
        self.marker = marker
        self.seen: str | None = None

    def run(self, message: str) -> Iterator[Event]:
        yield Event(kind="text", text=f"{self.marker}:{message}")


class RendezvousAgent(FakeAgent):
    """Reads `current_foster` only once *both* streams have set theirs.

    The barrier is the whole test. Without it each thread would set and read its
    own id before the other ran, and a module-level global would pass.
    """

    def __init__(self, barrier: threading.Barrier) -> None:
        super().__init__()
        self._barrier = barrier

    def run(self, message: str) -> Iterator[Event]:
        self._barrier.wait(timeout=5)
        self.seen = current_foster()
        yield Event(kind="text", text="ok")


def _drain(session: server.Session, foster_id: str) -> None:
    for _ in server._stream("hello", session, foster_id, model="stub"):
        pass


def test_two_concurrent_streams_each_keep_their_own_foster_id(fake_db) -> None:
    # The negative direction is the point: replace the ContextVar in
    # current_foster.py with a module-level variable and this fails, because a
    # global is shared across threads while a context is not.
    barrier = threading.Barrier(2)
    sessions = {fid: server.Session(agent=RendezvousAgent(barrier)) for fid in ("foster-a", "foster-b")}

    threads = [threading.Thread(target=_drain, args=(sessions[fid], fid)) for fid in sessions]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)
        assert not t.is_alive(), "a stream never finished; the rendezvous deadlocked"

    assert sessions["foster-a"].agent.seen == "foster-a"
    assert sessions["foster-b"].agent.seen == "foster-b"


def test_a_stream_persists_its_own_transcript_and_not_the_others(fake_db) -> None:
    # The same isolation, seen from the other end: whatever a stream writes to
    # Firestore must land under the foster whose stream it was.
    for fid in ("foster-a", "foster-b"):
        session = server.Session(agent=FakeAgent(marker=fid))
        session.agent.messages = [{"role": "user", "content": fid}]
        _drain(session, fid)

    a = fake_db.docs["fosters/foster-a/agentSession/current"]
    b = fake_db.docs["fosters/foster-b/agentSession/current"]
    assert "foster-a" in a["messagesJson"] and "foster-b" not in a["messagesJson"]
    assert "foster-b" in b["messagesJson"] and "foster-a" not in b["messagesJson"]


@pytest.fixture(autouse=True)
def clean_sessions(monkeypatch: pytest.MonkeyPatch):
    server._sessions.clear()
    # `_build_agent` constructs a real `Agent`, which wants an Anthropic client.
    # Stub the construction, not the session bookkeeping being tested.
    monkeypatch.setattr(server, "_build_agent", lambda foster_id: FakeAgent(marker=foster_id))
    yield
    server._sessions.clear()


def test_each_foster_gets_a_distinct_agent_with_a_distinct_transcript(fake_db) -> None:
    a = server._session("foster-a")
    b = server._session("foster-b")

    assert a is not b
    assert a.agent is not b.agent
    assert a.agent.messages is not b.agent.messages

    a.agent.messages.append({"role": "user", "content": "a private question"})

    assert b.agent.messages == []
    assert server._session("foster-a").agent is a.agent, "the same foster must keep their session"


def test_evicting_one_session_leaves_the_other_alone(fake_db) -> None:
    a = server._session("foster-a")
    a.agent.messages.append({"role": "user", "content": "still here"})
    b = server._session("foster-b")

    with server._sessions_lock:
        del server._sessions["foster-b"]

    assert server._session("foster-a").agent is a.agent
    assert server._session("foster-a").agent.messages == [{"role": "user", "content": "still here"}]
    # foster-b comes back rebuilt from storage, which is empty -- a fresh object,
    # not the evicted one, and carrying nothing of foster-a's.
    rebuilt = server._session("foster-b")
    assert rebuilt.agent is not b.agent
    assert rebuilt.agent.messages == []
