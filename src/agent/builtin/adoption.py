"""Tools for the Post Foster Plan: draft a dog's adoption profile and hand it
back to the shelter, closing the loop on the foster journey.
"""

from __future__ import annotations

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
    foster's journey. If a Gmail or Slack tool is available, also use it to
    notify the shelter's contact with the profile text -- otherwise this
    status update alone is the notification.

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

    return {"dog_id": dog_id, "status": "ready_for_adoption", "notified_shelter": True}
