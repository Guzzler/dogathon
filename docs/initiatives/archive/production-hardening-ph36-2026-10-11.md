# PH-36 `[large]` spec — archived verbatim 2026-10-11, at ship time

Moved out of `production-hardening.md`'s Task queue when PH-36 shipped. The Ledger row there is
what actually shipped; read it for where the build differs from this spec.

- [ ] **PH-36 `[large]` — a second foster starts with a clean journal (queued by plan 2026-10-11, at
  `5467778`).** RS-22 made the end of a journey routine — the shelter closes the application, and
  `releasesFoster("completed")` lets the foster apply again, as does `phase: "complete"`. Walking
  the foster's document into that **second** journey: nothing on `fosters/{uid}` that describes a
  foster period is keyed by dog. Every line re-read against `main`:
  - `Foster` (`web/src/types.ts:218-240`) holds one `journal`, `careSchedule`, `adoptionNote`,
    `adoptionHighlights`, `pickup`, `prepChecklist`, `careChecklist`, `approvalChecklist`,
    `readyForAdoption`; `CareLogEntry` (`:242-249`) has no `dogId`.
  - Both apply sites change only the pointer: `DogDetailView.tsx:77-81` and `SavedView.tsx:140`
    patch `matchedDogId` + `phase`. So does withdraw (`SavedView.tsx:230`) and **Change answers**
    (`HubView.tsx:157`).
  - So dog B's Care Plan opens on dog A's journal and schedule; `buildAdoptionProfile` prints dog
    A's weigh-ins, photos and the foster's note *about dog A* under dog B's name, and **Publish**
    (PH-32) puts them on dog B's public page; the Hub's `MatchedDogCard` (`HubView.tsx:74`) and
    `MatchChatView.tsx:30-45` state dog A's pickup date for dog B; `CarePlanView.tsx:99` counts days
    from it. The agent's `get_care_log` (`care.py:19-35`) and `generate_adoption_profile`
    (`adoption.py:87-113`) read the same unscoped data, so the paragraph sent to the shelter is
    built from the wrong animal. This is PH-17's test failing whole: *a record about a specific
    animal* attributed to a different one.

  **Design answer: a journey's records belong to the dog they were written about, and the moment
  the pointer moves is the moment they are filed.** Not a re-key of every per-journey field under
  `journeys/{dogId}` — that rewrites ~20 call sites to protect against one transition. The current
  journey stays on `fosters/{uid}` exactly as today; leaving it *archives then resets*, in one
  helper, at every site that moves `matchedDogId` off a dog. Nothing is deleted (a foster's notes
  about a dog they loved are theirs), and nothing is carried.

  **Spec.**
  1. `types.ts`: `CareLogEntry.dogId?: string`; new `JourneyArchive` — `dogId`, `archivedAt`, and
     the nine fields above as they stood.
  2. New `web/src/lib/journey.ts`: `JOURNEY_FIELDS` (the nine), `hasJourney(foster)` (any of them
     non-empty/non-default), and `leaveJourney(foster)` — if `foster.matchedDogId` and
     `hasJourney`, write `fosters/{uid}/journeys/{auto-id}` (a dog can be fostered twice, so not
     keyed by dog id), stamp every **untagged** `careLog` entry with the old `dogId` in one batch,
     then return the reset patch: `journal: []`, `pickup: null`, `readyForAdoption: false`, the three
     checklists from `checklists.ts`' defaults, and `careSchedule` / `adoptionNote` /
     `adoptionHighlights` **removed** (named with no value — PH-25's `mergeFields` convention; read
     `hooks/useFoster.ts:50-80` first). `LOCAL_MODE` mirrors it into a localStorage key in
     `lib/localMode.ts`; `clearGuestData()` clears that key too.
  3. Call it at all four pointer moves — both apply sites when the new dog differs from
     `matchedDogId`, withdraw, and **Change answers** — merging the reset into the existing
     `patchFoster`. Re-applying to the *same* dog writes nothing extra.
  4. Tag on write: `log_care_entry` (`care.py:39-71`) sets `dogId` from the foster's
     `matchedDogId`; `addCareLogEntry` (`useCareLog.ts:40`) and `appendLocalCareLog` take it too.
     **Filter on read** with one predicate, *untagged or equal to `matchedDogId`*: `useCareLog`
     (takes the dog id), `get_care_log`. Untagged entries are the current journey's until the first
     `leaveJourney` stamps them — honest, because before this ships no foster could have
     *completed* a second journey with care-log entries on the first.
  5. `firestore.rules`: `match /journeys/{id}` under `fosters/{uid}`, owner-only, like `careLog`.
     `auth.ts`: deletion removes `journeys` (beside `careLog`, `:195`), export includes them (`:227-238`).

  **Not in scope:** a *Past fosters* screen reading `journeys` (the archive exists so nothing is
  lost and export carries it; surfacing it is the next lead); PH-32's published page for dog A,
  which lives at `adoptionProfiles/{dogA}` and is unaffected. **A lead found on the way, not an
  item:** `addCareLogEntry` has **no caller** under `web/src` — PH-27 called it `log_care_entry`'s
  screen twin, but no screen calls it, so by PH-26's rule the agent tool is the only live writer of
  `careLog`. **Verify:** vitest — `leaveJourney` with a fake foster writes the archive, stamps only
  untagged entries and returns the reset; same-dog re-apply and a foster with no journey write
  nothing; both apply sites, withdraw and Change answers call it (render tests on `SavedView` /
  `DogDetailView` with `patchFoster` mocked); `buildAdoptionProfile` fed dog A's tagged entries
  for dog B prints none of them. pytest — `get_care_log` drops another dog's entries and keeps
  untagged; `log_care_entry` writes `dogId`. `firebase deploy --only firestore:rules --dry-run`,
  `tsc -b`, build, lint at `main`'s 8. Signed-in half is **PH-36b**, parked below.
