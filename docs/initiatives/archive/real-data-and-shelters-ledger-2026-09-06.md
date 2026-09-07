# Archive — `real-data-and-shelters.md` ledger, RS-12's row (snapshotted 2026-09-06)

Verbatim snapshot, taken the run after RS-12 shipped, because the working doc had
returned to 394 lines and this row was 35 of them. Archives are append-only: if
something here turns out to be wrong, correct the working doc and say so there.

- 2026-09-05 — RS-12 `[large]` — PR #63 — **the dog comes back, and the shelter sees it — which is
  what "notify the shelter" now means.** `adoption_profile` had been written by the agent since the
  first Post Foster turn and read by **nothing**: `grep -rn adoption_profile web/` found only the
  `types.ts` declaration. The app's most expensive turn (Opus, by `model_for_surface`) produced a
  paragraph that reached no human but the foster who watched it stream. It now lands in a **Back
  from foster** group at the *top* of `ShelterRosterView`, rendered in full — `.shelter__profile`
  has no clamp and the test negative-controls the profile's *last* clause, because truncating the
  one artifact of a whole foster journey would be its own kind of lie.
  - **The pure layer moved first, as queued.** `rosterAction` (singular, `"retire" | "relist" |
    null`) became **`rosterActions` (plural, an array)** — the shape change the item implied but
    didn't name, because `ready_for_adoption` is the one status wanting *two* moves. With it,
    `ROSTER_ACTION_STATUS` (action → `DogStatus`, so no view spells a status) and
    `rosterGroup`/`groupRoster`, replacing three inline `filter` calls. 5 new pure cases, one
    walking **all six** `DogStatus` values (the item said five; the union has six).
  - **No rules change, confirmed before writing one.** Both new actions are status-only writes on
    a dog the staff member's shelter already owns, so RS-6's `update: isStaff(resource.data.shelter_id)
    && shelter_id unchanged` (`firestore.rules:20-25`) already permits them. `applyRosterAction()`
    is the single write path; `retireDog`/`relistDog` stay as its named callers.
  - **The agent's claim is now true for the reason it says.** `notified_shelter` was
    `arcade_tools.available()` — honest when PR #19 wrote it, but reporting a *capability*, and
    `False` in production forever because no `ARCADE_API_KEY` exists. It is now `True` **because
    the Firestore write landed on a surface a shelter demonstrably reads** (RS-5b proved staff
    read this dashboard), with `notified_via: "shelter_roster"` naming which, and Arcade demoted
    to `arcade_messaging_available` under its own name rather than collapsed in. The two claims
    are separate fields, which is the distinction the item asked for rather than the hardcoded
    `True` PR #19 removed. **`server.py`'s system prompt had to move with it** — it instructed the
    model to say "no one was notified automatically" when the field was false, which after this
    change would never fire and, worse, was the wrong thing to say. This discharges **PH-1**.
  - **Verified:** `npm run build` / `test` / `lint` green (98 tests, 9 lint warnings — the same 9
    as `main`, checked by stashing); backend imports clean. Five new rendered cases in
    `ShelterRosterView.test.tsx`, same `renderToStaticMarkup` pattern as RS-11's, covering the
    ordering, the untruncated profile, the two actions, the missing-profile state, and a roster
    with no returned dog rendering **no heading at all**. **Not verified, honestly:** nothing
    signed-in. A `ready_for_adoption` dog is only ever written by the Admin SDK at the end of a
    completed foster journey, so no unattended run can produce one — that half is RS-12b, below.
