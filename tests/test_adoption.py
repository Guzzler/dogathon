"""What the adoption tool hands the model, and what it writes down afterwards.

`send_adoption_profile_to_shelter` persists one paragraph a model wrote onto a
real dog's record, and since RS-12 that write *is* the notification -- shelter
staff read it at `/shelter/dogs` and decide from it whether the animal gets
listed. Everything else this agent produces is a chat turn that scrolls away.

So the property under test is the one PH-20 exists for: the tool must hand over
what nobody recorded as a *statement*, not as an absent key. A model reading
three thin objects cannot tell an empty care log from a quiet one, and PH-19
established what it does with that -- a silently-absent field reads as "nothing
there" exactly as confidently as a false claim reads as a fact.

The dog dict these tools see is `snap.to_dict()` and nothing else
(`shelter.get_dog`), *not* the frontend's `normalizeDog()` shape, so the fixtures
below seed raw Firestore documents with fields genuinely absent rather than
defaulted -- which is the case that matters, since a silently-empty `missing`
list would report "nothing is missing" about a dog with nothing recorded.
"""

from __future__ import annotations

import pytest

from agent.builtin import adoption

DOG_ID = "d-100"
FOSTER_ID = "f-100"

BARE_DOG = {
    "id": DOG_ID,
    "name": "Juno",
    "breed": "Terrier mix",
    "age_years": 3,
    "status": "foster",
    "good_with_kids": None,
    "good_with_dogs": None,
    "notes": "Came in as a stray.",
}

NOTHING_LOGGED = [
    "the foster never added a photo of this dog",
    "the foster never wrote a journal note",
    "no care-plan item was ever ticked off",
    "no weigh-in or vet visit was ever logged",
    "this dog has no recorded weight, from the foster or the shelter",
    "the foster has not written their own note for the adoption page",
    "the shelter recorded no care needs for this dog",
]


def seed(fake_db, *, dog: dict | None = None, foster: dict | None = None, care_log=()):
    fake_db.collection("dogs").document(DOG_ID).set(dog or dict(BARE_DOG))
    fake_db.collection("fosters").document(FOSTER_ID).set(
        {"id": FOSTER_ID, "matchedDogId": DOG_ID, "intake": {}, **(foster or {})}
    )
    log = fake_db.collection("fosters").document(FOSTER_ID).collection("careLog")
    for i, entry in enumerate(care_log):
        log.document(f"e{i}").set({"created_at": i, **entry})


def test_nothing_logged_names_every_gap(fake_db):
    """A foster who logged nothing must produce seven statements, not an empty list."""
    seed(fake_db)
    result = adoption.generate_adoption_profile(foster_id=FOSTER_ID)
    assert result["missing"] == NOTHING_LOGGED


def test_gaps_are_sentences_not_field_names(fake_db):
    """PH-19's finding, applied here: a bare token reads as "nothing there"."""
    seed(fake_db)
    for gap in adoption.generate_adoption_profile(foster_id=FOSTER_ID)["missing"]:
        assert " " in gap, f"{gap!r} is a field name, not a gap"


def test_fully_logged_has_nothing_missing(fake_db):
    seed(
        fake_db,
        dog={**BARE_DOG, "weight_lbs": 41, "needs": ["Slow feeder bowl"]},
        foster={
            "adoptionNote": "She is the calmest dog I have fostered.",
            "journal": [
                {"kind": "photo", "photoUrl": "https://example.test/juno.jpg"},
                {"kind": "note", "text": "Slept through the night."},
            ],
            "careSchedule": [{"items": [{"label": "First weigh-in", "done": True}]}],
        },
        care_log=[{"type": "weigh_in", "value": "41 lbs"}],
    )
    assert adoption.generate_adoption_profile(foster_id=FOSTER_ID)["missing"] == []


def test_partially_logged_reports_exactly_the_subset(fake_db):
    """Photos and a weigh-in logged; notes, ticks, the foster's note and needs not.

    The weigh-in discharges two entries at once -- the medical one and the
    weight one -- which is the join most likely to be got wrong.
    """
    seed(
        fake_db,
        foster={
            "journal": [
                {"kind": "photo", "photoUrl": "https://example.test/juno.jpg"},
                {"kind": "note", "text": "   "},
            ],
        },
        care_log=[{"type": "weigh_in", "value": "41 lbs"}],
    )
    assert adoption.generate_adoption_profile(foster_id=FOSTER_ID)["missing"] == [
        "the foster never wrote a journal note",
        "no care-plan item was ever ticked off",
        "the foster has not written their own note for the adoption page",
        "the shelter recorded no care needs for this dog",
    ]


def test_shelter_weight_alone_leaves_the_medical_gap_open(fake_db):
    """An intake figure is a weight; it is not a weigh-in and not a vet visit."""
    seed(fake_db, dog={**BARE_DOG, "weight_lbs": 41})
    missing = adoption.generate_adoption_profile(foster_id=FOSTER_ID)["missing"]
    assert "no weigh-in or vet visit was ever logged" in missing
    assert "this dog has no recorded weight, from the foster or the shelter" not in missing


def test_a_vet_visit_is_not_a_weight(fake_db):
    seed(fake_db, care_log=[{"type": "vet_visit", "note": "Booster shot."}])
    missing = adoption.generate_adoption_profile(foster_id=FOSTER_ID)["missing"]
    assert "no weigh-in or vet visit was ever logged" not in missing
    assert "this dog has no recorded weight, from the foster or the shelter" in missing


def test_raw_materials_still_come_back(fake_db):
    """`missing` is an addition; the three sources the prompt reads are unchanged."""
    seed(fake_db, foster={"intake": {"living_arrangement": "apartment"}})
    result = adoption.generate_adoption_profile(foster_id=FOSTER_ID)
    assert result["dog"]["name"] == "Juno"
    assert result["foster_intake"] == {"living_arrangement": "apartment"}
    assert result["care_log"] == []


def test_no_matched_dog_is_an_error_not_an_empty_profile(fake_db):
    fake_db.collection("fosters").document(FOSTER_ID).set({"id": FOSTER_ID, "intake": {}})
    with pytest.raises(ValueError):
        adoption.generate_adoption_profile(foster_id=FOSTER_ID)


def test_send_records_who_wrote_the_paragraph(fake_db):
    seed(fake_db)
    adoption.send_adoption_profile_to_shelter(
        foster_id=FOSTER_ID, dog_id=DOG_ID, profile_text="Juno is a calm, watchful terrier mix."
    )
    dog = fake_db.docs[f"dogs/{DOG_ID}"]
    assert dog["adoption_profile_source"] == "agent"
    assert dog["adoption_profile"] == "Juno is a calm, watchful terrier mix."
    assert dog["status"] == "ready_for_adoption"
    assert dog["name"] == "Juno", "update() must not replace the rest of the record"
    assert fake_db.docs[f"fosters/{FOSTER_ID}"]["phase"] == "complete"


def test_send_reports_the_write_and_the_capability_separately(fake_db, monkeypatch):
    """`notified_shelter` is true because a write landed, never because Arcade exists."""
    seed(fake_db)
    monkeypatch.setattr(adoption.arcade_tools, "available", lambda: False)
    result = adoption.send_adoption_profile_to_shelter(
        foster_id=FOSTER_ID, dog_id=DOG_ID, profile_text="Juno is a calm terrier mix."
    )
    assert result["notified_shelter"] is True
    assert result["notified_via"] == "shelter_roster"
    assert result["arcade_messaging_available"] is False


def test_send_refuses_an_unknown_dog(fake_db):
    seed(fake_db)
    with pytest.raises(PermissionError):
        adoption.send_adoption_profile_to_shelter(
            foster_id=FOSTER_ID, dog_id="d-nope", profile_text="..."
        )


def test_send_requires_the_profile_text(fake_db):
    seed(fake_db)
    with pytest.raises(ValueError):
        adoption.send_adoption_profile_to_shelter(foster_id=FOSTER_ID, dog_id=DOG_ID)


def test_send_defaults_to_the_matched_dog(fake_db):
    seed(fake_db)
    result = adoption.send_adoption_profile_to_shelter(
        foster_id=FOSTER_ID, profile_text="Juno is a calm terrier mix."
    )
    assert result["dog_id"] == DOG_ID
    assert fake_db.docs[f"dogs/{DOG_ID}"]["adoption_profile_source"] == "agent"


# --- withdrawing it again (PH-21) -------------------------------------------------
#
# A retraction is a write, not an erasure. Since RS-12 the paragraph *is* the notification,
# so clearing the field would leave the dog in `ready_for_adoption` with a "Back from foster"
# card and nothing in it -- the arrival surviving while its content vanishes, which is worse
# for the staff member deciding than either the paragraph or no card. These four cases pin
# the three properties that makes it: it writes, it says who, and it leaves `status` alone.


def test_withdrawing_writes_a_sentence_rather_than_clearing(fake_db):
    seed(fake_db)
    adoption.send_adoption_profile_to_shelter(
        foster_id=FOSTER_ID, dog_id=DOG_ID, profile_text="Juno has never had an accident indoors."
    )
    adoption.withdraw_adoption_profile(
        foster_id=FOSTER_ID, dog_id=DOG_ID, reason="she did have accidents, twice in week one"
    )
    dog = fake_db.docs[f"dogs/{DOG_ID}"]
    assert dog["adoption_profile"], "the field must not go blank -- the shelter reads it"
    assert "accidents, twice in week one" in dog["adoption_profile"]
    assert "never had an accident indoors" not in dog["adoption_profile"]
    assert dog["adoption_profile_source"] == "foster_withdrawn"


def test_withdrawing_leaves_the_dog_back_from_foster(fake_db):
    """`ready_for_adoption` is RS-12's arrival state, not a claim about the paragraph."""
    seed(fake_db)
    adoption.send_adoption_profile_to_shelter(
        foster_id=FOSTER_ID, dog_id=DOG_ID, profile_text="Juno is a calm terrier mix."
    )
    result = adoption.withdraw_adoption_profile(
        foster_id=FOSTER_ID, dog_id=DOG_ID, reason="the breed is wrong"
    )
    assert fake_db.docs[f"dogs/{DOG_ID}"]["status"] == "ready_for_adoption"
    assert fake_db.docs[f"dogs/{DOG_ID}"]["name"] == "Juno", "update() must not replace the record"
    assert result["status_unchanged"] is True


def test_withdrawing_refuses_an_unknown_dog(fake_db):
    seed(fake_db)
    with pytest.raises(PermissionError):
        adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, dog_id="d-nope", reason="wrong dog")


def test_withdrawing_requires_a_reason(fake_db):
    """A retraction with no reason is a blank where a sentence has to be."""
    seed(fake_db)
    with pytest.raises(ValueError):
        adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, dog_id=DOG_ID, reason="   ")


# --- only the foster's own dog (PH-27) --------------------------------------------
#
# `dogs/{id}` is shared by every foster and owned by a shelter, and these tools write it
# through the Admin SDK, around `firestore.rules`. Their screen twin renders only for the
# foster's `matchedDogId`, so any other dog is a write no screen this foster can reach makes.
# The approval modal does not cover it: the person approving is the one the agent acts for.

OTHER_ID = "d-200"
OTHER_DOG = {
    "id": OTHER_ID,
    "name": "Pepper",
    "status": "foster",
    "adoption_profile": "A paragraph another foster's agent wrote.",
    "adoption_profile_source": "agent",
}


def seed_other(fake_db) -> dict:
    fake_db.collection("dogs").document(OTHER_ID).set(dict(OTHER_DOG))
    return dict(OTHER_DOG)


def test_send_refuses_another_fosters_dog_and_writes_nothing(fake_db):
    seed(fake_db)
    before = seed_other(fake_db)
    with pytest.raises(PermissionError):
        adoption.send_adoption_profile_to_shelter(
            foster_id=FOSTER_ID, dog_id=OTHER_ID, profile_text="Pepper is ready."
        )
    assert fake_db.docs[f"dogs/{OTHER_ID}"] == before
    assert fake_db.docs[f"fosters/{FOSTER_ID}"].get("phase") != "complete"


def test_withdraw_refuses_another_fosters_dog_and_writes_nothing(fake_db):
    seed(fake_db)
    before = seed_other(fake_db)
    with pytest.raises(PermissionError):
        adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, dog_id=OTHER_ID, reason="not true")
    assert fake_db.docs[f"dogs/{OTHER_ID}"] == before


def test_a_foster_with_no_matched_dog_can_send_or_withdraw_nothing(fake_db):
    fake_db.collection("fosters").document(FOSTER_ID).set({"id": FOSTER_ID, "intake": {}})
    before = seed_other(fake_db)
    with pytest.raises(ValueError):
        adoption.send_adoption_profile_to_shelter(
            foster_id=FOSTER_ID, dog_id=OTHER_ID, profile_text="Pepper is ready."
        )
    with pytest.raises(ValueError):
        adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, dog_id=OTHER_ID, reason="not true")
    assert fake_db.docs[f"dogs/{OTHER_ID}"] == before
    assert "phase" not in fake_db.docs[f"fosters/{FOSTER_ID}"]


def test_withdraw_refuses_when_there_is_no_assistant_profile(fake_db):
    """Nothing to withdraw is an error, not a note saying the foster withdrew it."""
    seed(fake_db)
    with pytest.raises(ValueError):
        adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, dog_id=DOG_ID, reason="wrong")
    assert "adoption_profile" not in fake_db.docs[f"dogs/{DOG_ID}"]


def test_withdraw_refuses_over_a_profile_a_human_wrote(fake_db):
    seed(
        fake_db,
        dog={**BARE_DOG, "adoption_profile": "Written by shelter staff.", "adoption_profile_source": "shelter"},
    )
    with pytest.raises(ValueError):
        adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, dog_id=DOG_ID, reason="wrong")
    assert fake_db.docs[f"dogs/{DOG_ID}"]["adoption_profile"] == "Written by shelter staff."


def test_withdraw_defaults_to_the_matched_dog(fake_db):
    seed(fake_db)
    adoption.send_adoption_profile_to_shelter(foster_id=FOSTER_ID, profile_text="Juno is calm.")
    result = adoption.withdraw_adoption_profile(foster_id=FOSTER_ID, reason="she is not calm")
    assert result["dog_id"] == DOG_ID
    assert fake_db.docs[f"dogs/{DOG_ID}"]["adoption_profile_source"] == "foster_withdrawn"
