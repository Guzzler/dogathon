# RS-16 spec — archived verbatim 2026-09-30, the day it shipped

From `real-data-and-shelters.md`'s Task queue. The Ledger row there is what shipped.

- [ ] **RS-16 — the import writes the shelter's listing, not the shelter's decisions (queued
  2026-09-28).** Found by reading a real run's output, not the code first: the 2026-09-28 weekly
  check reached sfspca.org (see "Where this stands") and planned `write 26`. `_push_to_firestore()`
  does that as `batch.set(collection.document(d["id"]), d)` (`scripts/import_dogs.py:210`) — a
  **whole-document replace** — and `sfspca.to_dog()` hard-codes `"status": "available"`. Since
  RS-6, RS-12 and PH-21, other writers put fields on those same scraped `dogs/{id}` documents that
  the scrape never carries: **staff** (`shelterRoster.ts:47` — `status` for retire / relist /
  adopted, plus `updatedAt`) and **the agent** (`adoption.py:150`, `:168` — `status:
  "ready_for_adoption"`, `adoption_profile`, `adoption_profile_source`; since RS-12 that write *is*
  the notification). So the first manual import after a foster finishes turns a **Back from
  foster** dog back into `available` and deletes the paragraph staff were meant to read; a dog
  staff retired or marked adopted reappears in Discovery and — through PH-31's `isListable()` —
  becomes appliable again. *Reasoned from the code, not observed:* nobody has run a writing import
  since RS-6, and an unattended run can't read production `dogs` to say whether any live document
  carries such a field today. With no users, probably none; the hazard is the next import.

  **Design answer (this run's question — who owns a field on a document two pipelines write?).**
  RS-10's *one writer per field*, applied to the dog: **the scrape owns what the shelter's public
  page says; Pawthway's writers own what happened inside Pawthway.** `status` on a document that
  already exists belongs to whoever last decided it, unless it is still `available`, which the
  scrape merely restates. `adoption_profile`, `adoption_profile_source` and `updatedAt` are never
  the scrape's. **Not `merge=True`:** PH-25 found `{ merge: true }` keeps keys a writer meant to
  remove, and a listing that stops stating a weight must lose `weight_lbs`, not keep the old one.
  So: build the scraped record, overlay the preserved keys off the snapshot already read at `:152`,
  and `set()` the result — no extra reads.

  1. `import_dogs.py`: `PAWTHWAY_OWNED = ("adoption_profile", "adoption_profile_source",
     "updatedAt")`, commented with the writer of each. In the write loop, a dog whose id is in
     `existing` gets those keys copied over when present, and keeps `existing[id]["status"]` when
     that is present and not `"available"`.
  2. The plan output gains `  keep status  n  {id: status, …}` (first 6), same shape as the `keep`
     lines above it, so whoever unticks *plan only* sees which decisions survive.
  3. Rider, `import-dogs.yml`: when an open `roster-drift` issue exists, `gh issue edit "$existing"
     --title "$TITLE"` before commenting. #96 is still titled *could not reach sfspca.org* under a
     comment saying it did.

  **Not in scope:** writing `status: "foster"` (a lead below); re-baking the roster and writing
  enrichment for the new dogs (a person's — RS-13b); `data/dogs.json` (it carries no
  Pawthway-owned field, so `--dry-run --from-cache` must produce it byte-identical). **Verify:**
  pytest in `tests/test_import_dogs.py` against PH-28's fake Admin client — a scraped dog live as
  `ready_for_adoption` with a profile keeps status, profile and source; one live as `retired` stays
  `retired`; one live as `available` is rewritten; a field absent from this scrape (`weight_lbs`)
  is **gone** afterwards; a new dog is written as scraped; `plan_only` writes nothing and prints the
  keep-status line. Existing importer tests green. The workflow rider is observable only on the
  next Monday run — say so in the row.
