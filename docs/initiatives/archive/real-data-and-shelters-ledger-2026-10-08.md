# real-data-and-shelters — Ledger rows RS-15 → RS-18, archived verbatim 2026-10-08

Moved out of the working doc by plan on 2026-10-08 to make room for RS-21's spec under the
~400-line ceiling. Each row below is exactly as it stood on `main` at `7f81d39`; the working doc keeps
a one-bullet compression pointing here.

- 2026-09-28 — RS-15 `[large]` — PR #108 — The handoff happens on the shelter's say-so: staff's
  **Ask for another time** (`askForAnotherTime()`, optional note ≤ 200 or `null`, slot left in place),
  `pickupState()`'s `declined`, and `agreedPickup(fosterPickup, application, loading)` gating Care
  Plan and anchoring Hub's and Saved's countdowns. Beyond the spec: `loading` as a third input (a
  loading application must not unlock Care Plan), `setPickupConfirmed` clears a decline, and the
  `create` rule requires all three answer fields null. vitest 211, tsc, build, lint 8; rules **not**
  verified against Firestore (RS-14b (6)–(7)). Full row verbatim in
  [`archive/real-data-and-shelters-rs15-ledger-2026-09-29.md`](archive/real-data-and-shelters-rs15-ledger-2026-09-29.md).
- 2026-09-29 — RS-17 `[large]` — PR #110 — The listing follows the handoff: `handoffStatus()` in
  `shelterDog.ts`; `setPickupConfirmed`, `askForAnotherTime` and `setApplicationStatus` take the dog
  and batch `dogs/{id}.status` with the application update; the inbox's muted *won't change that*
  line beside **Confirm pickup**, and a withdrawn-after-confirmation notice with **List again**;
  `rosterActions("foster")` is `["relist", "retire"]` and the roster has an **In foster** group.
  **One deviation from the table:** `handoffStatus` takes a third input, `confirmedHere` — *unconfirm*
  and *decline* relist only when this application held the confirmation, since otherwise declining
  one foster's application (or asking for another time on an unagreed slot) would relist a dog a
  different foster holds; the withdrawn notice likewise needs the application's own stamp. The
  foster's withdraw call passes no dog. vitest 226 (new `ShelterApplicationsView.test.tsx`), tsc,
  build, lint 8. **Not verified against Firestore or signed in** — RS-14b (8).
- 2026-09-30 — RS-16 — PR #111 — The import writes the shelter's listing, not the shelter's
  decisions: `PAWTHWAY_OWNED` (`adoption_profile`, `adoption_profile_source`, `updatedAt`) plus
  `_decided_status()` / `_preserve_decisions()` in `scripts/import_dogs.py` overlay the live
  document's Pawthway-owned keys onto the scraped record, then `set()` it whole — so a key the
  scrape stopped stating is still dropped (no `merge=True`). The plan gains `keep status  n  {…}`.
  Rider: `import-dogs.yml` retitles the open `roster-drift` issue to this week's outcome before
  commenting. pytest 83 (seven new, against PH-28's fake client, including one pinning that
  `data/dogs.json` carries no Pawthway-owned key); `--dry-run --from-cache` re-bake byte-identical.
  **Not verified against live Firestore** (no writing import run, as required), and the retitle is
  observable only on the next Monday run — #96 should then carry this week's title.
- 2026-10-01 — RS-18 `[large]` + RS-19 — PR #114 — One dog, one confirmed pickup: `pickupHolder()` /
  `heldByAnother()` / `placedElsewhere()` / `isLive()` in `applicationView.ts`, all pure. The inbox
  detail drops **Confirm pickup** when another live application holds the stamp and shows *{dog} is
  going home with {holder}* (the name a button that selects that row) under **Pickup**, in place of
  RS-17's *won't change that*; **Ask for another time** and the status buttons stay. Match withholds
  nothing: per **RS-19** (queued by plan mid-build, PR #113, and folded in here so the stranding
  version never deployed) Match and Saved say *{dog} is listed as in a foster home at {shelter}* and
  keep the scheduler and **Change request**. **Two choices the spec left open:** the row pill *replaces*
  *Pickup requested* / *Asked for another time* rather than sitting beside them, since *requested*
  invites the one action the row no longer has; and it reuses `shelter__pill--dog` (no new pill
  modifier), with one new `.shelter__link` rule for the holder's name. A legacy double-confirmed
  pair still shows **Undo confirmation** on both — the line says which to take back. vitest 237
  (11 new), tsc, build, lint 8 (unchanged); `another foster home` appears nowhere outside tests.
  **Not verified signed in or against Firestore** — RS-14b (9).
