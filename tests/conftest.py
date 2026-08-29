"""Shared fixtures for the backend tests.

The one hard constraint on everything in `tests/`: it must run in CI with no
Application Default Credentials, no `ANTHROPIC_API_KEY`, and no network. CI's
`backend` job has none of the three, and a test that needs one of them is the
wrong test for this harness -- see `docs/initiatives/production-hardening.md`,
PH-9. That's why the Firestore fake below exists rather than an emulator: the
point is to exercise *our* serialization and trimming, not Google's database.
"""

from __future__ import annotations

import json
from typing import Any

import pytest


class FakeDocument:
    """The two-method slice of a Firestore DocumentReference we actually use."""

    def __init__(self, store: dict[str, dict[str, Any]], path: str) -> None:
        self._store = store
        self._path = path

    def get(self) -> "FakeSnapshot":
        return FakeSnapshot(self._store.get(self._path))

    def set(self, data: dict[str, Any]) -> None:
        # Firestore stores what it is given; round-tripping through JSON here
        # keeps the fake honest about the fact that a stored value is data, not
        # a live reference to the caller's list.
        self._store[self._path] = json.loads(json.dumps(data))

    def delete(self) -> None:
        self._store.pop(self._path, None)

    def collection(self, name: str) -> "FakeCollection":
        return FakeCollection(self._store, f"{self._path}/{name}")


class FakeSnapshot:
    def __init__(self, data: dict[str, Any] | None) -> None:
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict[str, Any] | None:
        return self._data


class FakeCollection:
    def __init__(self, store: dict[str, dict[str, Any]], path: str) -> None:
        self._store = store
        self._path = path

    def document(self, name: str) -> FakeDocument:
        return FakeDocument(self._store, f"{self._path}/{name}")


class FakeDb:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, Any]] = {}

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self.docs, name)


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch) -> FakeDb:
    """Patches `session_store.db` so the module talks to an in-memory store."""
    from agent import session_store

    db = FakeDb()
    monkeypatch.setattr(session_store, "db", lambda: db)
    return db
