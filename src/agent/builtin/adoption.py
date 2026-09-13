"""Tools for the Post Foster Plan: draft a dog's adoption profile and hand it
back to the shelter, closing the loop on the foster journey.
"""

from __future__ import annotations

from .. import arcade_tools
from ..current_foster import resolve
from ..firestore_client import db
from .care import get_care_log
from .foster import get_foster
from .shelter import get_dog
from ..tools import tool


def _missing_records(dog: dict, foster: dict, care_log: list[dict]) -> list[str]:
    """What nobody ever recorded about this dog, phrased as the gap it is.

    The same job `buildAdoptionProfile` does for the adoption page
    (`web/src/lib/adoption.ts`), for the other reader of the same three sources.
    The page can render "Not recorded" in a row; a model reading three thin
    objects cannot tell an empty care log from a quiet one, so absence has to be
    handed over as a statement rather than as silence.

    Each entry is a sentence about what did not happen, not a field name:
    PH-19 established that a bare absence reads as "nothing there" exactly as
    confidently as a false claim reads as a fact.

    `dog` here is the raw Firestore document (`shelter.get_dog` returns
    `snap.to_dict()` and nothing else), *not* the frontend's `normalizeDog()`
    shape -- every derived field is simply absent rather than defaulted, so
    every read below goes through `.get()`.
    """
    journal = foster.get("journal") or []
    schedule = foster.get("careSchedule") or []
    entries = care_log or []

    missing: list[str] = []

    if not any(e.get("kind") == "photo" and e.get("photoUrl") for e in journal):
        missing.append("the foster never added a photo of this dog")
    if not any(e.get("kind") == "note" and (e.get("text") or "").strip() for e in journal):
        missing.append("the foster never wrote a journal note")

    ticked = [i for block in schedule for i in (block.get("items") or []) if i.get("done")]
    if not ticked:
        missing.append("no care-plan item was ever ticked off")

    weigh_ins = [e for e in entries if e.get("type") == "weigh_in" and e.get("value")]
    vet_visits = [e for e in entries if e.get("type") == "vet_visit"]
    if not weigh_ins and not vet_visits:
        missing.append("no weigh-in or vet visit was ever logged")
    if not weigh_ins and dog.get("weight_lbs") is None:
        missing.append("this dog has no recorded weight, from the foster or the shelter")

    if not (foster.get("adoptionNote") or "").strip():
        missing.append("the foster has not written their own note for the adoption page")

    if not (dog.get("needs") or []):
        missing.append("the shelter recorded no care needs for this dog")

    return missing


@tool
def generate_adoption_profile(foster_id: str = "") -> dict:
    """Gather everything needed to write a dog's adoption profile: the
    shelter's record for the matched dog, the foster's intake notes, and the
    full care log (weigh-ins, vet visits, notes, photos) gathered while
    fostering. Also returns `missing`: the things nobody ever recorded, each
    phrased as the gap it is. Write the warm, one-paragraph adoption profile
    yourself from this data rather than repeating it -- and say plainly that
    anything in `missing` was not recorded, rather than filling it in or
    passing over it in silence. A short, honest paragraph is the right answer
    when the care log is thin.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
    """
    foster_id = resolve(foster_id)
    foster = get_foster(foster_id=foster_id)
    dog_id = foster.get("matchedDogId")
    if not dog_id:
        raise ValueError(f"Foster {foster_id} has no matched dog yet.")
    dog = get_dog(dog_id=dog_id)
    care_log = get_care_log(foster_id=foster_id)
    return {
        "dog": dog,
        "foster_intake": foster.get("intake", {}),
        "care_log": care_log,
        "missing": _missing_records(dog, foster, care_log),
    }


@tool(dangerous=True)
def send_adoption_profile_to_shelter(foster_id: str = "", dog_id: str = "", profile_text: str = "") -> dict:
    """Send the finished adoption profile back to the shelter: saves it on
    the dog's record, marks the dog ready for adoption, and closes out the
    foster's journey. The shelter's own roster shows a `ready_for_adoption`
    dog in its "Back from foster" group with this profile rendered in full,
    so the write itself is how the shelter is notified. If a Gmail or Slack
    tool is available, also use it to reach their contact with the profile
    text -- that is an extra channel, not the notification.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
        dog_id: The matched dog's id, for example d-001.
        profile_text: The adoption profile narrative to send.
    """
    foster_id = resolve(foster_id)
    if not dog_id or not profile_text:
        raise ValueError("dog_id and profile_text are both required.")

    dog_ref = db().collection("dogs").document(dog_id)
    if not dog_ref.get().exists:
        raise KeyError(f"No dog with id {dog_id}")
    # `adoption_profile_source` records who wrote the paragraph. It is the one thing in this
    # app a model writes *down* -- since RS-12 the shelter reads it at /shelter/dogs and
    # decides from it whether a real animal gets listed -- and nothing else on the dog's
    # document distinguishes it from text a human might later put in the same field.
    dog_ref.update(
        {
            "status": "ready_for_adoption",
            "adoption_profile": profile_text,
            "adoption_profile_source": "agent",
        }
    )

    foster_ref = db().collection("fosters").document(foster_id)
    foster_ref.set({"phase": "complete", "readyForAdoption": True}, merge=True)

    # `notified_shelter` used to be `arcade_tools.available()` -- honest at the time (PR #19
    # removed a hardcoded True) but it was reporting a *capability*, not a delivery, and in
    # production it is always False because nobody has configured an ARCADE_API_KEY. Since
    # RS-12 the shelter's roster renders `adoption_profile` for exactly this status, so the
    # Firestore write above is a real notification to a surface a shelter demonstrably reads.
    # The two claims are reported separately rather than collapsed: this one is true because
    # the write landed, and the Arcade one stays a capability probe under its own name.
    return {
        "dog_id": dog_id,
        "status": "ready_for_adoption",
        "notified_shelter": True,
        "notified_via": "shelter_roster",
        "arcade_messaging_available": arcade_tools.available(),
    }
