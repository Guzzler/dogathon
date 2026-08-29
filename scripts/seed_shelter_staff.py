"""One-time seed: create the first shelters/{id} document by hand.

`shelters/{id}` is `allow write: if false` on purpose (firestore.rules) --
staff accounts aren't self-serve yet (M3 in docs/initiatives/real-data-and-shelters.md),
so this Admin-SDK one-off is the only way to create one. RS-2 needs this to exist before
isStaff()/useStaffShelters() has anything to match against.

Usage:
    GOOGLE_CLOUD_PROJECT=pawthway-hackathon uv run python scripts/seed_shelter_staff.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent.firestore_client import db  # noqa: E402

# Matches data/dogs.json and scripts/shelters/sfspca.py's CAMPUS["id"] (RS-3).
SHELTER_ID = "sfspca-mission"

# The repo owner's own Firebase Auth uid (via `firebase auth:export`), used as the first
# test staff account until a real SF SPCA conversation happens (see
# docs/initiatives/real-data-and-shelters.md, "The part that's a conversation, not a PR").
TEST_STAFF_UID = "XyyPs5ZB7GSv0uyLwbP2T4dG4Uy1"


def seed_shelter() -> None:
    ref = db().collection("shelters").document(SHELTER_ID)
    if ref.get().exists:
        print(f"shelters/{SHELTER_ID} already exists, leaving it alone.")
        return
    ref.set(
        {
            "name": "SF SPCA Mission Campus",
            "address": "201 Alabama St, San Francisco",
            "staffUids": [TEST_STAFF_UID],
        }
    )
    print(f"Seeded shelters/{SHELTER_ID} with staffUids=[{TEST_STAFF_UID}].")


if __name__ == "__main__":
    seed_shelter()
