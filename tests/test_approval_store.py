"""The approval handoff, exercised without waiting 300 real seconds.

`wait()` takes its clock and its sleep as arguments precisely so these tests
can drive them. That is the only concession the production code makes to being
tested; everything else here is the real code path.

The three behaviours PH-8 named as its verification are the first three tests:
two approvals in one session both resolve, an unanswered approval times out
rather than hanging, and a request whose document disappears underneath it
(the restart / `/reset` case) ends in a decision rather than a wedged thread.
"""

from __future__ import annotations

import pytest

from agent import approval_store, session_store

DOC = "fosters/annie/agentSession/current"


class FakeClock:
    """A monotonic clock that only advances when `sleep` is called."""

    def __init__(self) -> None:
        self.t = 0.0
        self.slept = 0.0

    def now(self) -> float:
        return self.t

    def sleep(self, seconds: float) -> None:
        self.t += seconds
        self.slept += seconds


def test_two_approvals_in_one_session_both_resolve(fake_db) -> None:
    first = approval_store.request("annie", "update_dog")
    assert approval_store.resolve("annie", True) is True
    assert approval_store.wait("annie", first) is True

    # The first request is cleared, so the second starts from a clean slate --
    # this is the case that a naive "one boolean field" design gets wrong.
    second = approval_store.request("annie", "send_adoption_profile_to_shelter")
    assert second != first
    assert approval_store.resolve("annie", False) is True
    assert approval_store.wait("annie", second) is False


def test_an_unanswered_approval_times_out_and_declines(fake_db) -> None:
    clock = FakeClock()
    request_id = approval_store.request("annie", "update_dog")

    assert (
        approval_store.wait(
            "annie", request_id, timeout=300, poll=1.0, now=clock.now, sleep=clock.sleep
        )
        is False
    )
    # It waited the full ceiling rather than giving up early or spinning forever.
    assert clock.slept == pytest.approx(300, abs=1.0)
    # And it left nothing behind for the next request to trip over.
    assert fake_db.docs[DOC]["pendingApproval"] is None


def test_a_vanished_request_declines_immediately(fake_db) -> None:
    # What a `/reset` (or a foster whose session was rebuilt) looks like from
    # inside a parked thread: the document it was waiting on is gone.
    clock = FakeClock()
    request_id = approval_store.request("annie", "update_dog")
    session_store.clear("annie")

    assert (
        approval_store.wait("annie", request_id, now=clock.now, sleep=clock.sleep) is False
    )
    assert clock.slept == 0  # no point waiting out 300s for an answer nobody will give


def test_a_superseded_request_does_not_steal_the_new_answer(fake_db) -> None:
    clock = FakeClock()
    stale = approval_store.request("annie", "update_dog")
    approval_store.request("annie", "log_care_entry")  # a newer turn took over
    approval_store.resolve("annie", True)

    # The approval belongs to the newer request; the stale waiter must decline,
    # not run a dangerous tool on someone else's yes.
    assert approval_store.wait("annie", stale, now=clock.now, sleep=clock.sleep) is False


def test_resolve_reports_when_nothing_is_pending(fake_db) -> None:
    assert approval_store.resolve("annie", True) is False  # no request at all

    approval_store.request("annie", "update_dog")
    assert approval_store.resolve("annie", True) is True
    assert approval_store.resolve("annie", True) is False  # a double-tapped button


def test_a_decision_arriving_mid_poll_is_picked_up(fake_db) -> None:
    clock = FakeClock()
    request_id = approval_store.request("annie", "update_dog")

    answered_at = {}

    def sleep(seconds: float) -> None:
        clock.sleep(seconds)
        if clock.t >= 3 and "t" not in answered_at:
            approval_store.resolve("annie", True)
            answered_at["t"] = clock.t

    assert (
        approval_store.wait("annie", request_id, now=clock.now, sleep=sleep) is True
    )
    assert answered_at["t"] == pytest.approx(3.0)
    assert clock.slept < 10  # returned promptly after the answer, not at the deadline


def test_a_transient_firestore_failure_keeps_polling(fake_db, monkeypatch) -> None:
    clock = FakeClock()
    request_id = approval_store.request("annie", "update_dog")
    approval_store.resolve("annie", True)

    real = approval_store._pending
    calls = {"n": 0}

    def flaky(foster_id: str):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("deadline exceeded")
        return real(foster_id)

    monkeypatch.setattr(approval_store, "_pending", flaky)

    # A blip must not decide the question by itself in either direction.
    assert approval_store.wait("annie", request_id, now=clock.now, sleep=clock.sleep) is True
    assert calls["n"] == 2


def test_the_transcript_and_the_approval_share_a_document_without_clobbering(fake_db) -> None:
    # The regression this guards: `session_store.save()` used a plain set(),
    # which would delete a pendingApproval a turn elsewhere is parked on.
    request_id = approval_store.request("annie", "update_dog")
    session_store.save("annie", [{"role": "user", "content": "hi"}])

    assert fake_db.docs[DOC]["pendingApproval"]["requestId"] == request_id
    assert session_store.load("annie") == [{"role": "user", "content": "hi"}]

    approval_store.resolve("annie", True)
    approval_store.clear("annie")
    # …and clearing the approval leaves the transcript alone.
    assert session_store.load("annie") == [{"role": "user", "content": "hi"}]
