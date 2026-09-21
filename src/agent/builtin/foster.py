"""Tools over a foster's journey record, backed by Firestore.

The app's UI writes most of this data directly via the Firestore web SDK
(onboarding answers, swipes, checklist ticks) -- these tools exist so the
agent can read that state when it reasons, and occasionally act on it when
asked to during a chat (e.g. "mark the vet visit done").
"""

from __future__ import annotations

from ..current_foster import resolve
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

# The approval checklist has two owners and one writer per field (RS-10): the foster's own
# steps live here on `fosters/{uid}`, the shelter's live on `applications/{id}.checklist` and
# are written by staff. This tool writes `approvalChecklist` wholesale, so without the guard
# below it would tick -- or silently un-tick -- a step this document no longer owns, and the
# foster's screen would show a shelter approval nobody at the shelter gave.
APPROVAL_OWNERS = {i["id"]: i["owner"] for i in DEFAULT_APPROVAL_CHECKLIST}


def _approval_owner(item: dict) -> str:
    """Records seeded before `owner` existed fall back to the default's, same as the web app."""
    return item.get("owner") or APPROVAL_OWNERS.get(item.get("id", ""), "foster")


def _ref(foster_id: str):
    return db().collection(COLLECTION).document(foster_id)


@tool
def get_foster(foster_id: str = "") -> dict:
    """Look up a foster's full journey record: intake answers, liked/passed
    dogs, matched dog, checklists, and pickup details.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
    """
    foster_id = resolve(foster_id)
    snap = _ref(foster_id).get()
    if not snap.exists:
        raise KeyError(f"No foster with id {foster_id}")
    return {"id": foster_id, **snap.to_dict()}


# There is deliberately no intake-writing tool (PH-26). The questionnaire is the only thing
# that writes `intake`, with its own guards -- it omits a slider nobody moved and writes both
# halves of a size/energy answer -- and the agent is only mounted in phases past it. A tool
# here would be a second questionnaire with none of those rules, and it used to be one: it
# blanked every answer it wasn't given and sent a matched foster back to Discovery.


@tool(dangerous=True)
def record_swipe(foster_id: str = "", dog_id: str = "", liked: bool = False) -> dict:
    """Save or pass on a dog -- the same thing a swipe in Discovery does. A like
    only adds the dog to the foster's saved list; it does not apply to foster
    it. Applying is done by the foster in the app (Saved -> Apply to foster),
    which is what tells the shelter.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
        dog_id: The dog's id, for example d-001.
        liked: True to save the dog (swipe right), False to pass (swipe left).
    """
    # Exactly the write Discovery's swipe makes (`DiscoveryView.tsx`, like/pass): the dog
    # joins one list and leaves the other. It used to also set `matchedDogId` and
    # `phase: "match"` -- an application with no `applications` document, so no shelter
    # ever saw it, and in Care Plan it swapped out the dog living in the foster's home.
    foster_id = resolve(foster_id)
    ref = _ref(foster_id)
    data = ref.get().to_dict() or {}
    add, drop = ("likedDogIds", "passedDogIds") if liked else ("passedDogIds", "likedDogIds")
    kept = list(data.get(add) or [])
    if dog_id not in kept:
        kept.append(dog_id)
    ref.set({add: kept, drop: [d for d in data.get(drop) or [] if d != dog_id]}, merge=True)
    return get_foster(foster_id=foster_id)


@tool
def update_checklist(foster_id: str = "", checklist: str = "prep", item_id: str = "", done: bool = True) -> dict:
    """Tick or untick one item on one of a foster's checklists.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
        checklist: Which checklist: "approval", "prep", or "care".
        item_id: The checklist item's id, e.g. "crate" or "vet-visit".
        done: Whether the item is now done.

    On the "approval" checklist only the foster's own steps can be changed
    here; the shelter's steps (home check, reference check) are theirs to
    mark and this will refuse them.
    """
    foster_id = resolve(foster_id)
    if checklist not in CHECKLISTS:
        raise ValueError(f"checklist must be one of {', '.join(CHECKLISTS)}")
    field, defaults = CHECKLISTS[checklist]

    ref = _ref(foster_id)
    snap = ref.get()
    items = (snap.to_dict() or {}).get(field) or [dict(i) for i in defaults]
    found = False
    for item in items:
        if item["id"] == item_id:
            if checklist == "approval" and _approval_owner(item) == "shelter":
                raise PermissionError(
                    f"{item_id!r} is the shelter's step, not the foster's -- only shelter "
                    "staff can mark it done, from their own dashboard."
                )
            item["done"] = done
            found = True
    if not found:
        raise KeyError(f"No checklist item {item_id!r} in {checklist}")

    ref.set({field: items}, merge=True)
    return get_foster(foster_id=foster_id)
