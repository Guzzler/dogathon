"""Demo tools over a local shelter roster. Swap the JSON for a real datastore."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..tools import tool

DATA = Path(__file__).resolve().parents[3] / "data" / "dogs.json"

STATUSES = ("available", "foster", "medical_hold", "adopted")


def _load() -> list[dict[str, Any]]:
    return json.loads(DATA.read_text())


def _save(dogs: list[dict[str, Any]]) -> None:
    DATA.write_text(json.dumps(dogs, indent=2) + "\n")


@tool
def list_dogs(status: str = "", max_weight_lbs: int = 0, good_with_kids: bool = False) -> list[dict]:
    """List dogs in the shelter roster, optionally filtered.

    Args:
        status: Keep only this status: available, foster, medical_hold, or adopted.
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
    for dog in _load():
        if dog["id"] == dog_id:
            return dog
    raise KeyError(f"No dog with id {dog_id}")


@tool(dangerous=True)
def update_dog(dog_id: str, status: str = "", notes: str = "") -> dict:
    """Change a dog's status or notes. Writes to the roster.

    Args:
        dog_id: The dog's id, for example d-001.
        status: New status: available, foster, medical_hold, or adopted.
        notes: Replacement notes text. Omit to leave the existing notes alone.
    """
    if status and status not in STATUSES:
        raise ValueError(f"status must be one of {', '.join(STATUSES)}")

    dogs = _load()
    for dog in dogs:
        if dog["id"] == dog_id:
            if status:
                dog["status"] = status
            if notes:
                dog["notes"] = notes
            _save(dogs)
            return dog
    raise KeyError(f"No dog with id {dog_id}")
