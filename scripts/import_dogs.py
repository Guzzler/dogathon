"""Build the dog roster, once, offline, from the SF SPCA.

This is a demo, so the roster is scraped, reviewed, and committed rather than fetched live:
nothing calls out at runtime, there is no per-user cost, and nothing can fail on stage.

Why scraping and not an API: Petfinder decommissioned theirs in December 2025,
RescueGroups needs a key granted by a human, and both carry only adoption listings. The
SF SPCA's own pages are server-rendered, the write-ups are by staff who know the dog, and
they say which dogs are in a foster home -- which no aggregator does.

    uv run python scripts/import_dogs.py --dry-run     # scrape, write data/dogs.json only
    uv run python scripts/import_dogs.py               # ...and push to Firestore
    uv run python scripts/import_dogs.py --from-cache  # re-bake without re-fetching

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
    ap.add_argument("--dry-run", action="store_true", help="write data/dogs.json but not Firestore")
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
        from agent.firestore_client import db
        client = db()
        collection = client.collection("dogs")

        # Replace, not append. Earlier runs (and the original hand-written seed) left docs
        # in this collection that this scrape doesn't produce -- without deleting those, a
        # real import just adds the real roster alongside the dummy one instead of
        # replacing it, which is exactly the bug that left production showing fake dogs.
        new_ids = {d["id"] for d in dogs}
        existing_ids = {doc.id for doc in collection.list_documents()}
        stale_ids = existing_ids - new_ids
        if stale_ids:
            stale = sorted(stale_ids)
            for start in range(0, len(stale), 400):
                batch = client.batch()
                for doc_id in stale[start : start + 400]:
                    batch.delete(collection.document(doc_id))
                batch.commit()
            print(f"  removed {len(stale)} stale docs (no longer in the scrape): {stale[:5]}{'...' if len(stale) > 5 else ''}")

        for start in range(0, len(dogs), 400):     # Firestore caps a batch at 500 ops
            batch = client.batch()
            for d in dogs[start : start + 400]:
                batch.set(collection.document(d["id"]), d)
            batch.commit()
        print(f"wrote {len(dogs)} dogs -> Firestore")

    _summarise(dogs)


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
