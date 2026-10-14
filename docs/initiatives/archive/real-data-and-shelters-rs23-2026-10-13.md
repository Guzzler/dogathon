# RS-23 spec, archived verbatim 2026-10-13 at ship time

From `real-data-and-shelters.md`'s Task queue. The Ledger row there is what shipped.

- [ ] **RS-23 — queued 2026-10-13: the importer deletes a dog Pawthway still has records about.
  Ship as PH-37's rider** (it is what lets that screen name its dogs); alone, it is a small run.
  **Grounding, re-read at `9d153f6`:** `push()` in `scripts/import_dogs.py:166-185` deletes every
  stale scraped dog except hand-entered ones and those in some `fosters/*.matchedDogId`. That
  predicate was complete while a foster's pointer never moved. RS-22 and PH-36 made it move: the
  moment a foster applies for a second dog, the first leaves `matched` — and a dog adopted after
  its foster is exactly the one that falls off sfspca.org. The next real import then deletes it,
  and with it: the subject of a `completed` application in `/shelter`'s inbox, the dog document
  `/adoption/{dogId}` renders from (PH-35's *has been adopted* line never shows), and the name on
  the foster's archived journey. **Design answer: *a scraped dog is the importer's to delete only
  while nothing in Pawthway has been written about it.*** Extend `matched` to the union of
  `fosters/*.matchedDogId`, `applications/*.dogId` (every status), `adoptionProfiles` doc ids, and
  `collection_group("journeys")` `dogId`s. The `available` → `retired` delist rule is unchanged;
  `_preserve_decisions` already keeps `adopted`. Rename the plan line to `keep N stale but
  referenced in Pawthway: [...]` and keep the `(delisted: [...])` suffix — PH-28b reads it.
  **Verify:** `tests/test_import_dogs.py`'s fake gains `applications`, `adoptionProfiles` and a
  `collection_group`; one test per source keeping a stale dog, one that a dog with none is still
  deleted, the existing `d-026` cases green; `uv run pytest`. No Firestore run — that is a person
  unticking *plan only* (RS-13b).

