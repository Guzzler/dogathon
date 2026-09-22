"""Tools over the shelter's dog roster, backed by Firestore.

Read-only, on purpose. There used to be a tool here that set any dog's status or notes; its only screen twin is the staff roster (RS-6), and the agent acts for one foster,
never for staff -- so it was a way around `firestore.rules`, not a shortcut (PH-27). The one
dog write a foster's agent may make is Post Foster's, on their own matched dog, in
`adoption.py`.
"""

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
        max_weight_lbs: Keep only dogs recorded at or under this weight. 0 means no limit.
            Dogs with no recorded weight are left out when a limit is set.
        good_with_kids: If true, keep only dogs cleared to live with children.
    """
    dogs = _load()
    if status:
        dogs = [d for d in dogs if d.get("status") == status]
    if max_weight_lbs:
        # A dog the shelter entered without a weight (RS-6's form omits the key) is not a
        # dog known to be light enough: under a weight limit, unknown is excluded.
        dogs = [d for d in dogs if d.get("weight_lbs") is not None and d["weight_lbs"] <= max_weight_lbs]
    if good_with_kids:
        dogs = [d for d in dogs if d.get("good_with_kids") is True]
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
