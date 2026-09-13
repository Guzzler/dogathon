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
        return FakeSnapshot(self._store.get(self._path), self._path.rsplit("/", 1)[-1])

    def update(self, data: dict[str, Any]) -> None:
        """Real `update()` fails on a missing document; `set(merge=True)` creates one.

        The difference matters here: `send_adoption_profile_to_shelter` checks the
        dog exists and then updates, and a fake that quietly created the document
        would let a test pass against a dog that was never seeded.
        """
        if self._path not in self._store:
            raise KeyError(f"No document at {self._path}")
        self._store[self._path].update(json.loads(json.dumps(data)))

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        # Firestore stores what it is given; round-tripping through JSON here
        # keeps the fake honest about the fact that a stored value is data, not
        # a live reference to the caller's list.
        data = json.loads(json.dumps(data))
        if merge:
            # Top-level merge only, which is all the callers use. Real Firestore
            # merges nested maps key by key; nothing here writes a partial map,
            # so faking the deeper behaviour would only invite relying on it.
            self._store.setdefault(self._path, {}).update(data)
        else:
            self._store[self._path] = data

    def delete(self) -> None:
        self._store.pop(self._path, None)

    def collection(self, name: str) -> "FakeCollection":
        return FakeCollection(self._store, f"{self._path}/{name}")


class FakeSnapshot:
    def __init__(self, data: dict[str, Any] | None, doc_id: str = "") -> None:
        self._data = data
        self.id = doc_id

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

    def order_by(self, field: str) -> "FakeQuery":
        return FakeQuery(self._store, self._path, field)

    def stream(self):
        return FakeQuery(self._store, self._path, None).stream()


class FakeQuery:
    """Enough of a Firestore query for `get_care_log`: order by one field, stream.

    Only documents one segment below the collection path are members, so a
    subcollection under a document doesn't leak into its parent's results.
    """

    def __init__(self, store: dict[str, dict[str, Any]], path: str, field: str | None) -> None:
        self._store = store
        self._path = path
        self._field = field

    def stream(self):
        prefix = f"{self._path}/"
        members = [
            (key.removeprefix(prefix), value)
            for key, value in self._store.items()
            if key.startswith(prefix) and "/" not in key.removeprefix(prefix)
        ]
        if self._field:
            # Missing values sort first, the way an unset field does in Firestore.
            members.sort(key=lambda kv: (kv[1].get(self._field) is None, kv[1].get(self._field, 0)))
        return [FakeSnapshot(data, doc_id) for doc_id, data in members]


class FakeDb:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, Any]] = {}

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self.docs, name)


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch) -> FakeDb:
    """Points every module that reaches Firestore at one in-memory store.

    `session_store` and `approval_store` share the same document on purpose
    (the transcript and the pending approval live side by side), so they must
    share the same fake or the tests would not see them interfere.
    """
    from agent import approval_store, session_store
    from agent.builtin import adoption, care, foster, shelter

    db = FakeDb()
    for module in (session_store, approval_store, adoption, care, foster, shelter):
        monkeypatch.setattr(module, "db", lambda: db)
    return db
