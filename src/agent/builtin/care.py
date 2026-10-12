"""Tools over a foster's care log: weigh-ins, vet visits, notes, photos."""

from __future__ import annotations

from ..current_foster import resolve
from ..firestore_client import db
from .foster import CHECKLISTS, get_foster
from ..tools import tool

FOSTERS = "fosters"
CARE_LOG = "careLog"

# The `CareLogEntry["type"]` union in web/src/types.ts. The UI gets this check from
# TypeScript; the model's argument is a free string, so the tool has to make it itself.
ENTRY_TYPES = ("weigh_in", "vet_visit", "note", "photo")


def belongs_to(entry: dict, dog_id: str | None) -> bool:
    """Whether a care-log entry is about the foster's current dog (PH-36).

    Entries carry the `dogId` they were written about. An untagged one predates the tag and is
    the current journey's until the foster's first `leaveJourney` (web/src/lib/journey.ts)
    stamps it with the dog it was about -- the same predicate as the web's `belongsToDog`.
    """
    tagged = entry.get("dogId")
    return not tagged or tagged == dog_id


@tool
def get_care_log(foster_id: str = "") -> list[dict]:
    """Read the care log for a foster's current dog: weigh-ins, vet visits, notes, and photos,
    oldest first. Entries about a dog they fostered before are not included.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
    """
    foster_id = resolve(foster_id)
    dog_id = get_foster(foster_id=foster_id).get("matchedDogId")
    docs = (
        db()
        .collection(FOSTERS)
        .document(foster_id)
        .collection(CARE_LOG)
        .order_by("created_at")
        .stream()
    )
    entries = [{"id": d.id, **d.to_dict()} for d in docs]
    return [e for e in entries if belongs_to(e, dog_id)]


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
    if entry_type not in ENTRY_TYPES:
        raise ValueError(f"entry_type must be one of {', '.join(ENTRY_TYPES)}")
    foster_id = resolve(foster_id)
    from firebase_admin import firestore as fa_firestore

    # Filed under the dog it is about, so a second foster's log doesn't open on the first
    # dog's weigh-ins (PH-36). No matched dog leaves it untagged, which reads as current.
    dog_id = get_foster(foster_id=foster_id).get("matchedDogId")
    entry = {
        "type": entry_type,
        "note": note,
        "value": value,
        "photo_url": photo_url,
        "created_at": fa_firestore.SERVER_TIMESTAMP,
    }
    if dog_id:
        entry["dogId"] = dog_id
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
