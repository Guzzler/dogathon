"""Tools over a foster's journey record, backed by Firestore.

The app's UI writes most of this data directly via the Firestore web SDK
(onboarding answers, swipes, checklist ticks) -- these tools exist so the
agent can read that state when it reasons, and occasionally act on it when
asked to during a chat (e.g. "mark the vet visit done").
"""

from __future__ import annotations

from typing import Any

from ..firestore_client import db
from ..tools import tool

COLLECTION = "fosters"

DEFAULT_APPROVAL_CHECKLIST = [
    {"id": "application", "label": "Foster application submitted", "done": False, "owner": "foster"},
    {"id": "home-check", "label": "Home environment check", "done": False, "owner": "shelter"},
    {"id": "reference-check", "label": "Reference check", "done": False, "owner": "shelter"},
    {"id": "orientation", "label": "Foster orientation completed", "done": False, "owner": "foster"},
]

DEFAULT_PREP_CHECKLIST = [
    {"id": "crate", "label": "Crate", "done": False},
    {"id": "food", "label": "Food + bowls", "done": False},
    {"id": "leash", "label": "Leash + collar/harness", "done": False},
    {"id": "bed", "label": "Bed or blanket", "done": False},
    {"id": "id-tag", "label": "ID tag", "done": False},
]

DEFAULT_CARE_CHECKLIST = [
    {"id": "weigh-in-1", "label": "First weigh-in", "done": False},
    {"id": "vet-visit", "label": "Vet check-up scheduled", "done": False},
    {"id": "feeding-routine", "label": "Feeding routine established", "done": False},
    {"id": "photos", "label": "Photos added for adoption profile", "done": False},
]

CHECKLISTS = {
    "approval": ("approvalChecklist", DEFAULT_APPROVAL_CHECKLIST),
    "prep": ("prepChecklist", DEFAULT_PREP_CHECKLIST),
    "care": ("careChecklist", DEFAULT_CARE_CHECKLIST),
}


def _ref(foster_id: str):
    return db().collection(COLLECTION).document(foster_id)


@tool
def get_foster(foster_id: str = "annie") -> dict:
    """Look up a foster's full journey record: intake answers, liked/passed
    dogs, matched dog, checklists, and pickup details.

    Args:
        foster_id: The foster's id. Defaults to the demo foster, "annie".
    """
    snap = _ref(foster_id).get()
    if not snap.exists:
        raise KeyError(f"No foster with id {foster_id}")
    return {"id": foster_id, **snap.to_dict()}


@tool(dangerous=True)
def save_intake(
    foster_id: str = "annie",
    living_arrangement: str = "",
    experience_level: str = "",
    time_availability: str = "",
    size_preference: str = "",
    energy_preference: str = "",
    restrictions: str = "",
) -> dict:
    """Save a foster's onboarding intake answers.

    Args:
        foster_id: The foster's id. Defaults to the demo foster, "annie".
        living_arrangement: e.g. "apartment" or "house with yard".
        experience_level: e.g. "first-time" or "experienced".
        time_availability: How much daily time the foster has for a dog.
        size_preference: Preferred dog size, e.g. "small", "medium", "large".
        energy_preference: Preferred energy level, e.g. "low", "medium", "high".
        restrictions: Any hard restrictions, e.g. "no cats in the home".
    """
    intake = {
        "living_arrangement": living_arrangement,
        "experience_level": experience_level,
        "time_availability": time_availability,
        "size_preference": size_preference,
        "energy_preference": energy_preference,
        "restrictions": restrictions,
    }
    _ref(foster_id).set({"intake": intake, "phase": "discovery"}, merge=True)
    return get_foster(foster_id=foster_id)


@tool(dangerous=True)
def record_swipe(foster_id: str = "annie", dog_id: str = "", liked: bool = False) -> dict:
    """Record a like/pass on a dog during discovery. A like moves the foster
    into the Match phase with that dog.

    Args:
        foster_id: The foster's id. Defaults to the demo foster, "annie".
        dog_id: The dog's id, for example d-001.
        liked: True for a like (swipe right), False for a pass (swipe left).
    """
    from firebase_admin import firestore as fa_firestore

    ref = _ref(foster_id)
    field = "likedDogIds" if liked else "passedDogIds"
    updates: dict[str, Any] = {field: fa_firestore.ArrayUnion([dog_id])}
    if liked:
        updates["matchedDogId"] = dog_id
        updates["phase"] = "match"
    ref.set(updates, merge=True)
    return get_foster(foster_id=foster_id)


@tool(dangerous=True)
def update_checklist(foster_id: str = "annie", checklist: str = "prep", item_id: str = "", done: bool = True) -> dict:
    """Tick or untick one item on one of a foster's checklists.

    Args:
        foster_id: The foster's id. Defaults to the demo foster, "annie".
        checklist: Which checklist: "approval", "prep", or "care".
        item_id: The checklist item's id, e.g. "crate" or "vet-visit".
        done: Whether the item is now done.
    """
    if checklist not in CHECKLISTS:
        raise ValueError(f"checklist must be one of {', '.join(CHECKLISTS)}")
    field, defaults = CHECKLISTS[checklist]

    ref = _ref(foster_id)
    snap = ref.get()
    items = (snap.to_dict() or {}).get(field) or [dict(i) for i in defaults]
    found = False
    for item in items:
        if item["id"] == item_id:
            item["done"] = done
            found = True
    if not found:
        raise KeyError(f"No checklist item {item_id!r} in {checklist}")

    ref.set({field: items}, merge=True)
    return get_foster(foster_id=foster_id)
