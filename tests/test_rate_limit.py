"""The per-foster chat rate limit -- the spend brake, previously untested.

`_take_chat_token` is the only thing standing between one signed-in foster and
an unbounded number of model calls, and until PH-11 nothing exercised it. The
clock is driven rather than slept through: a test that waits out a real refill
window is a test nobody runs.
"""

from __future__ import annotations

import time
from typing import Iterator

import pytest

from agent import server


@pytest.fixture(autouse=True)
def clean_buckets() -> Iterator[None]:
    # The buckets are module state shared by every test in the process.
    server._buckets.clear()
    yield
    server._buckets.clear()


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch):
    """A hand-driven replacement for `time.monotonic`, in seconds."""

    class Clock:
        def __init__(self) -> None:
            self.now = 1000.0

        def advance(self, seconds: float) -> None:
            self.now += seconds

    c = Clock()
    monkeypatch.setattr(time, "monotonic", lambda: c.now)
    return c


def test_the_budget_is_divided_by_the_instance_count() -> None:
    # The tie PH-11 is actually about: raising --max-instances without raising
    # MAX_CLOUD_RUN_INSTANCES multiplies the effective ceiling. This asserts the
    # arithmetic exists, so removing it breaks a test rather than a bill.
    assert server.CHAT_REQUESTS_PER_MINUTE == max(
        1, server.CHAT_REQUESTS_PER_MINUTE_BUDGET // server.MAX_CLOUD_RUN_INSTANCES
    )
    assert server.MAX_CLOUD_RUN_INSTANCES >= 1


def test_the_first_burst_is_admitted_and_the_next_request_is_not(clock) -> None:
    limit = server.CHAT_REQUESTS_PER_MINUTE

    assert all(server._take_chat_token("annie") for _ in range(limit))
    assert not server._take_chat_token("annie")


def test_a_refused_foster_is_admitted_again_after_the_bucket_refills(clock) -> None:
    for _ in range(server.CHAT_REQUESTS_PER_MINUTE):
        server._take_chat_token("annie")
    assert not server._take_chat_token("annie")

    # One token's worth of refill, not a whole minute: the bucket is continuous,
    # so the foster is let back in as soon as one token exists.
    clock.advance(60 / server.CHAT_REQUESTS_PER_MINUTE)

    assert server._take_chat_token("annie")
    assert not server._take_chat_token("annie")


def test_the_bucket_does_not_refill_past_full(clock) -> None:
    server._take_chat_token("annie")
    clock.advance(3600)

    assert all(server._take_chat_token("annie") for _ in range(server.CHAT_REQUESTS_PER_MINUTE))
    assert not server._take_chat_token("annie")


def test_one_foster_exhausting_the_bucket_does_not_throttle_another(clock) -> None:
    for _ in range(server.CHAT_REQUESTS_PER_MINUTE):
        server._take_chat_token("annie")
    assert not server._take_chat_token("annie")

    assert server._take_chat_token("someone-else")


def test_idle_buckets_are_dropped_so_the_map_does_not_grow_per_visitor(clock) -> None:
    server._take_chat_token("annie")
    clock.advance(3600)

    server._take_chat_token("someone-else")

    assert "annie" not in server._buckets
    assert "someone-else" in server._buckets
