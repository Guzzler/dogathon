"""Build the dog roster, once, offline, from the SF SPCA.

This is a demo, so the roster is scraped, reviewed, and committed rather than fetched live:
nothing calls out at runtime, there is no per-user cost, and nothing can fail on stage.

Why scraping and not an API: Petfinder decommissioned theirs in December 2025,
RescueGroups needs a key granted by a human, and both carry only adoption listings. The
SF SPCA's own pages are server-rendered, the write-ups are by staff who know the dog, and
they say which dogs are in a foster home -- which no aggregator does.

    uv run python scripts/import_dogs.py --dry-run     # data/dogs.json only, no credentials
    uv run python scripts/import_dogs.py --plan        # ...and report the Firestore diff
    uv run python scripts/import_dogs.py               # ...and actually write it
    uv run python scripts/import_dogs.py --from-cache  # any of the above, without re-scraping

Firestore writes replace rather than append -- see _push_to_firestore. Running this is the
only thing that updates a deployed roster; the committed data/dogs.json only covers
LOCAL_MODE and guest browsing.

The descriptive fields are not generated. They are written by hand into
data/enrichment.json from each write-up, validated on the way in, and committed -- so what
ships is reviewed rather than regenerated, and no model key is needed to build the roster.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from shelters import enrich as enrich_mod   # noqa: E402
from shelters import sfspca                 # noqa: E402

DOGS_JSON = ROOT / "data" / "dogs.json"
ENRICHMENT = ROOT / "data" / "enrichment.json"
RAW = ROOT / "data" / "shelter_descriptions.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="write data/dogs.json and skip Firestore entirely (needs no credentials)")
    ap.add_argument("--plan", action="store_true",
                    help="connect to Firestore and report the diff, but write nothing")
    ap.add_argument("--from-cache", action="store_true",
                    help="re-bake from the last scrape instead of hitting the site again")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests")
    args = ap.parse_args()

    # ---- scrape ----------------------------------------------------------------
    cache = RAW.with_name("sfspca_scrape.json")
    if args.from_cache and cache.exists():
        raw = json.loads(cache.read_text())
        print(f"re-baking {len(raw)} dogs from {cache.name}")
    else:
        print("scraping sfspca.org…")
        raw = sfspca.scrape(delay=args.delay)
        cache.write_text(json.dumps(raw, indent=2) + "\n")
        print(f"  {len(raw)} dogs")

    dogs = [sfspca.to_dog(r) for r in raw]
    descriptions = {sfspca.to_dog(r)["id"]: r["description"] for r in raw}

    # ---- enrichment ------------------------------------------------------------
    enrichment = json.loads(ENRICHMENT.read_text()) if ENRICHMENT.exists() else {}
    applied = 0
    for d in dogs:
        extra = enrich_mod.apply_enrichment(d, enrichment.get(d["id"]))
        if extra:
            d.update(extra)
            applied += 1
    print(f"  {applied}/{len(dogs)} enriched from data/enrichment.json")

    missing = [d["id"] for d in dogs if not d.get("notes")]
    for d in dogs:
        if not d.get("notes"):
            d["notes"] = enrich_mod.fallback_notes(d)
    if missing:
        print(f"  {len(missing)} without a written note (using the plain fallback): {missing[:5]}")

    # The shelter's own words, kept so the enrichment can be written and checked from them.
    RAW.write_text(json.dumps(
        {d["id"]: {"name": d["name"], "breed": d["breed"], "description": descriptions[d["id"]]}
         for d in dogs}, indent=2) + "\n")

    # ---- write -----------------------------------------------------------------
    DOGS_JSON.write_text(json.dumps(dogs, indent=2) + "\n")
    print(f"wrote {len(dogs)} dogs -> data/dogs.json ({DOGS_JSON.stat().st_size / 1024:.0f} KB)")

    if args.dry_run:
        print("dry run: Firestore untouched")
    else:
        _push_to_firestore(dogs, plan_only=args.plan)

    _summarise(dogs)


def _push_to_firestore(dogs: list[dict], plan_only: bool) -> None:
    """Replace the `dogs` collection with this roster.

    Replace, not append: earlier runs and the original hand-written seed left documents
    here that this scrape doesn't produce. Without removing those, an import adds the real
    roster *alongside* the dummy one -- which is exactly why production kept showing
    invented dogs long after data/dogs.json became real.

    `plan_only` still connects and still reads, so a preview proves the credentials work
    and shows the true diff. Only the writes are skipped.
    """
    from agent.firestore_client import db

    client = db()
    collection = client.collection("dogs")

    new_ids = {d["id"] for d in dogs}
    existing_ids = {doc.id for doc in collection.list_documents()}
    stale_ids = existing_ids - new_ids

    # Never delete a dog someone is partway through fostering. Match, Care Plan and Post
    # Foster all resolve the dog by `matchedDogId`, so removing it drops that foster onto a
    # "no foster yet" screen with no route back. A dog adopted off the shelter's site falls
    # out of the scrape, so this is reachable in normal use, not just in theory.
    matched = {
        (snap.to_dict() or {}).get("matchedDogId")
        for snap in client.collection("fosters").stream()
    }
    matched.discard(None)
    spoken_for = stale_ids & matched
    stale_ids -= spoken_for

    print(f"\nfirestore plan  ({len(existing_ids)} docs live now)")
    print(f"  write   {len(dogs)}")
    print(f"  delete  {len(stale_ids)}" + (f"  {sorted(stale_ids)[:6]}" if stale_ids else ""))
    if spoken_for:
        print(f"  keep    {len(spoken_for)} stale but matched to a foster: {sorted(spoken_for)}")

    if plan_only:
        print("  (plan only -- nothing written)")
        return

    for start in range(0, len(sorted(stale_ids)), 400):   # Firestore caps a batch at 500 ops
        batch = client.batch()
        for doc_id in sorted(stale_ids)[start : start + 400]:
            batch.delete(collection.document(doc_id))
        batch.commit()

    for start in range(0, len(dogs), 400):
        batch = client.batch()
        for d in dogs[start : start + 400]:
            batch.set(collection.document(d["id"]), d)
        batch.commit()
    print(f"  done: {len(dogs)} written, {len(stale_ids)} deleted")


def _summarise(dogs: list[dict]) -> None:
    """The fill rates are the check that the scrape actually worked."""
    if not dogs:
        print("\nno dogs imported")
        return
    n = len(dogs)
    print("\nfill rates")
    for key in ("age_years", "weight_lbs", "size", "energy_level", "traits", "needs", "photo_urls"):
        print(f"  {key:<14} {sum(1 for d in dogs if d.get(key) is not None) * 100 // n}%")
    for key in ("good_with_kids", "good_with_dogs", "good_with_cats"):
        print(f"  {key:<14} {sum(1 for d in dogs if d.get(key) is not None) * 100 // n}% recorded")
    print(f"  in foster      {sum(1 for d in dogs if d.get('in_foster_home'))} dogs")


if __name__ == "__main__":
    main()
