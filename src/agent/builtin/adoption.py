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


@tool
def generate_adoption_profile(foster_id: str = "") -> dict:
    """Gather everything needed to write a dog's adoption profile: the
    shelter's record for the matched dog, the foster's intake notes, and the
    full care log (weigh-ins, vet visits, notes, photos) gathered while
    fostering. This returns raw materials -- write the actual warm,
    adoption-profile narrative yourself from this data, don't just repeat it.

    Args:
        foster_id: The foster's id. Leave this out -- it defaults to the
            signed-in foster the app is showing.
    """
    foster_id = resolve(foster_id)
    foster = get_foster(foster_id=foster_id)
    dog_id = foster.get("matchedDogId")
    if not dog_id:
        raise ValueError(f"Foster {foster_id} has no matched dog yet.")
    return {
        "dog": get_dog(dog_id=dog_id),
        "foster_intake": foster.get("intake", {}),
        "care_log": get_care_log(foster_id=foster_id),
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
    dog_ref.update({"status": "ready_for_adoption", "adoption_profile": profile_text})

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
