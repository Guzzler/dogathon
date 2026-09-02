"""Tools over the shelter's dog roster, backed by Firestore."""

from __future__ import annotations

from typing import Any

from ..firestore_client import db
from ..tools import tool

# "retired" is what a shelter sets from the roster form (RS-6) when a dog should stop being
# listed for a reason the other values would misstate. Kept in sync with DogStatus in
# web/src/types.ts.
STATUSES = ("available", "foster", "medical_hold", "adopted", "ready_for_adoption", "retired")

COLLECTION = "dogs"


def _load() -> list[dict[str, Any]]:
    return [doc.to_dict() for doc in db().collection(COLLECTION).stream()]


@tool
def list_dogs(status: str = "", max_weight_lbs: int = 0, good_with_kids: bool = False) -> list[dict]:
    """List dogs in the shelter roster, optionally filtered.

    Args:
        status: Keep only this status: available, foster, medical_hold, adopted, ready_for_adoption, or retired.
        max_weight_lbs: Keep only dogs at or under this weight. 0 means no limit.
        good_with_kids: If true, keep only dogs cleared to live with children.
    """
    dogs = _load()
    if status:
        dogs = [d for d in dogs if d["status"] == status]
    if max_weight_lbs:
        dogs = [d for d in dogs if d["weight_lbs"] <= max_weight_lbs]
    if good_with_kids:
        dogs = [d for d in dogs if d["good_with_kids"]]
    return dogs


@tool
def get_dog(dog_id: str) -> dict:
    """Look up one dog's full record by id.

    Args:
        dog_id: The dog's id, for example d-001.
    """
    snap = db().collection(COLLECTION).document(dog_id).get()
    if not snap.exists:
        raise KeyError(f"No dog with id {dog_id}")
    return snap.to_dict()


@tool(dangerous=True)
def update_dog(dog_id: str, status: str = "", notes: str = "") -> dict:
    """Change a dog's status or notes. Writes to the roster.

    Args:
        dog_id: The dog's id, for example d-001.
        status: New status: available, foster, medical_hold, adopted, ready_for_adoption, or retired.
        notes: Replacement notes text. Omit to leave the existing notes alone.
    """
    if status and status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")

    ref = db().collection(COLLECTION).document(dog_id)
    snap = ref.get()
    if not snap.exists:
        raise KeyError(f"No dog with id {dog_id}")

    updates: dict[str, Any] = {}
    if status:
        updates["status"] = status
    if notes:
        updates["notes"] = notes
    if updates:
        ref.update(updates)
    return ref.get().to_dict()
