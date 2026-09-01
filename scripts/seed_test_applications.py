"""Seed a few obviously-fake `applications` rows so the shelter inbox has something to render.

The `applications` collection is empty in production (checked 2026-08-31), and RS-5's real
question -- does the staff branch of `applications`'s `||` read rule actually serve a
`where("shelterId","==",...)` list query? -- cannot be answered against an empty collection:
Firestore evaluates a list rule *per candidate document*, so a query over nothing comes back
clean no matter what the rule says. Rows have to exist first.

Committed rather than run as a one-off curl, for the same reason `seed_shelter_staff.py` is:
the write should be reproducible by whoever needs it next.

Every row carries a deliberately fake `fosterName` ("Test Foster (fixture)") and a
`fosterId` prefixed `fixture-`, which is not a real Firebase Auth uid and never will be --
so a fixture can never be mistaken for a person, and no real foster's screens can pick one up.

Usage:
    GOOGLE_CLOUD_PROJECT=pawthway-hackathon uv run python scripts/seed_test_applications.py
    ... --dry-run   # print what would be written, touch nothing
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

SHELTER_ID = "sfspca-mission"
FIXTURE_NAME = "Test Foster (fixture)"

# Mirrors DEFAULT_APPROVAL_CHECKLIST in web/src/checklists.ts and
# src/agent/builtin/foster.py -- the third copy, and the reason all three say to keep
# them in sync. Duplicated rather than imported so this script stays runnable on its own.
CHECKLIST = [
    {"id": "application", "label": "Foster application submitted", "done": True, "owner": "foster"},
    {"id": "home-check", "label": "Home environment check", "done": False, "owner": "shelter"},
    {"id": "reference-check", "label": "Reference check", "done": False, "owner": "shelter"},
    {"id": "orientation", "label": "Foster orientation completed", "done": False, "owner": "foster"},
]

# Three rows covering the three states the inbox has to render differently: a fresh one, one
# a shelter has started on, and a withdrawn one whose name has been redacted by account
# deletion (PH-15) -- that last is a real state, not an edge case to special-case away.
FIXTURES = [
    {"suffix": "a", "status": "submitted", "age_days": 0, "name": FIXTURE_NAME, "ticked": []},
    {"suffix": "b", "status": "in_review", "age_days": 3, "name": FIXTURE_NAME, "ticked": ["home-check"]},
    {"suffix": "c", "status": "withdrawn", "age_days": 11, "name": "(deleted account)", "ticked": []},
]


def dog_ids(n: int) -> list[str]:
    dogs = json.loads((ROOT / "data" / "dogs.json").read_text(encoding="utf-8"))
    ids = [d["id"] for d in dogs if d.get("shelter_id") == SHELTER_ID]
    if len(ids) < n:
        raise SystemExit(f"data/dogs.json has only {len(ids)} dogs for {SHELTER_ID}, need {n}.")
    return ids[:n]


def build_rows() -> list[tuple[str, dict]]:
    now = datetime.now(timezone.utc)
    rows = []
    for fixture, dog_id in zip(FIXTURES, dog_ids(len(FIXTURES))):
        created = now - timedelta(days=fixture["age_days"])
        checklist = [
            {**item, "done": item["done"] or item["id"] in fixture["ticked"]} for item in CHECKLIST
        ]
        rows.append(
            (
                # A fixed document id, so re-running this replaces the fixtures instead of
                # piling up a fourth and fifth copy of the same test row.
                f"fixture-{SHELTER_ID}-{fixture['suffix']}",
                {
                    "fosterId": f"fixture-foster-{fixture['suffix']}",
                    "fosterName": fixture["name"],
                    "dogId": dog_id,
                    "shelterId": SHELTER_ID,
                    "status": fixture["status"],
                    "checklist": checklist,
                    "pickup": None,
                    "createdAt": created,
                    "updatedAt": created,
                },
            )
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print the rows, write nothing")
    args = parser.parse_args()

    rows = build_rows()
    for doc_id, data in rows:
        print(f"applications/{doc_id}: {data['status']} - {data['fosterName']} - dog {data['dogId']}")
    if args.dry_run:
        print(f"\nDry run: {len(rows)} row(s) not written.")
        return

    from agent.firestore_client import db  # noqa: PLC0415 -- import only when actually writing

    col = db().collection("applications")
    for doc_id, data in rows:
        col.document(doc_id).set(data)
    print(f"\nWrote {len(rows)} fixture application(s) for {SHELTER_ID}.")


if __name__ == "__main__":
    main()
