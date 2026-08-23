"""Tools over a foster's care log: weigh-ins, vet visits, notes, photos."""

from __future__ import annotations

from ..current_foster import resolve
from ..firestore_client import db
from .foster import CHECKLISTS, get_foster
from ..tools import tool

FOSTERS = "fosters"
CARE_LOG = "careLog"


@tool
def get_care_log(foster_id: str = "") -> list[dict]:
    """Read a foster's full care log: weigh-ins, vet visits, notes, and photos, oldest first.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
    """
    foster_id = resolve(foster_id)
    docs = (
        db()
        .collection(FOSTERS)
        .document(foster_id)
        .collection(CARE_LOG)
        .order_by("created_at")
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]


@tool
def log_care_entry(
    foster_id: str = "",
    entry_type: str = "note",
    note: str = "",
    value: str = "",
    photo_url: str = "",
) -> dict:
    """Add one entry to a foster's care log.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
        entry_type: One of "weigh_in", "vet_visit", "note", "photo".
        note: Free-text note, e.g. "Ate well today, a bit shy at the vet."
        value: A measurement tied to the entry, e.g. a weight like "24 lbs".
        photo_url: A photo URL, if entry_type is "photo".
    """
    foster_id = resolve(foster_id)
    from firebase_admin import firestore as fa_firestore

    entry = {
        "type": entry_type,
        "note": note,
        "value": value,
        "photo_url": photo_url,
        "created_at": fa_firestore.SERVER_TIMESTAMP,
    }
    ref = db().collection(FOSTERS).document(foster_id).collection(CARE_LOG).document()
    ref.set(entry)
    return {"id": ref.id, **entry}


@tool
def get_care_checklist(foster_id: str = "") -> list[dict]:
    """Read a foster's care-plan checklist (weigh-ins, vet visits, feeding routine, photos).

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
    """
    foster_id = resolve(foster_id)
    foster = get_foster(foster_id=foster_id)
    field, defaults = CHECKLISTS["care"]
    return foster.get(field) or list(defaults)
