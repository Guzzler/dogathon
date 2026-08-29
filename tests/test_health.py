"""`GET /health`'s shape, with the Firestore probe patched both ways.

`/health` is the one endpoint deliberately left open (it leaks nothing), and
it is what a future alert reads to answer "did this instance just restart and
drop every parked approval thread" -- see production-hardening.md PH-7/PH-8.
Its *shape* is therefore a contract, not an implementation detail.

`_firestore_reachable` is patched rather than exercised: the real call needs
credentials, which CI does not have and must not need.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from agent import server

HEALTH_KEYS = {
    "anthropic_key_set",
    "arcade_available",
    "firestore_reachable",
    "tool_count",
    "active_sessions",
}


@pytest.fixture
def client() -> TestClient:
    return TestClient(server.app)


@pytest.mark.parametrize("reachable", [True, False])
def test_health_reports_firestore_reachability(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, reachable: bool
) -> None:
    monkeypatch.setattr(server, "_firestore_reachable", lambda: reachable)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == HEALTH_KEYS
    assert body["firestore_reachable"] is reachable


def test_health_needs_no_authorization_header(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # /health and /tools are open on purpose; every other route requires a
    # verified Firebase ID token. A regression that put auth in front of
    # /health would break Cloud Run's own probing.
    monkeypatch.setattr(server, "_firestore_reachable", lambda: True)

    assert client.get("/health").status_code == 200


def test_health_counts_registered_tools_and_live_sessions(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(server, "_firestore_reachable", lambda: True)

    body = client.get("/health").json()

    # The registry is built at import time from the builtin tool modules, so a
    # module that failed to register would show up here as a smaller number.
    assert body["tool_count"] == len(server._registry)
    assert body["tool_count"] > 0
    assert isinstance(body["active_sessions"], int)


def test_chat_without_a_token_is_rejected(client: TestClient) -> None:
    # The auth check from PR #9 is load-bearing (an unauthenticated /chat used
    # to leak a foster's name and address); pin it so it can't be refactored
    # away quietly.
    response = client.post("/chat", json={"message": "hi"})

    assert response.status_code == 401
