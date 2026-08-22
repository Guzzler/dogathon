"""One-time seed: load data/dogs.json into Firestore and create the demo
foster record (fosters/annie).

Usage:
    GOOGLE_CLOUD_PROJECT=pawthway-hackathon uv run python scripts/seed_firestore.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent.firestore_client import db  # noqa: E402

DOGS_JSON = Path(__file__).resolve().parents[1] / "data" / "dogs.json"


def seed_dogs() -> None:
    dogs = json.loads(DOGS_JSON.read_text())
    batch = db().batch()
    for dog in dogs:
        ref = db().collection("dogs").document(dog["id"])
        batch.set(ref, dog)
    batch.commit()
    print(f"Seeded {len(dogs)} dogs.")


def seed_foster() -> None:
    ref = db().collection("fosters").document("annie")
    if ref.get().exists:
        print("fosters/annie already exists, leaving it alone.")
        return
    ref.set(
        {
            "name": "Annie",
            "phase": "onboarding",
            "intake": {},
            "likedDogIds": [],
            "passedDogIds": [],
            "matchedDogId": None,
            "approvalChecklist": [],
            "prepChecklist": [],
            "careChecklist": [],
            "pickup": None,
            "readyForAdoption": False,
        }
    )
    print("Seeded fosters/annie.")


if __name__ == "__main__":
    seed_dogs()
    seed_foster()
