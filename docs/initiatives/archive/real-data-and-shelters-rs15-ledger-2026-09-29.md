# Archived 2026-09-29 from real-data-and-shelters.md — verbatim

The RS-15 Ledger row as execute wrote it (placeholder backfilled to PR #108 in the working doc), and the
`status: "foster"` lead that became RS-17 `[large]`, and three parked "Needs a human" items (RS-6b, RS-12b, RS-8).

## RS-15 Ledger row

- 2026-09-28 — RS-15 `[large]` — PR #__ — The handoff happens on the shelter's say-so. Staff's
  inbox detail gained **Ask for another time** (`askForAnotherTime()`: `pickupDeclinedAt` stamp,
  optional note ≤ 200 trimmed or `null`, slot left in place) and the row an "Asked for another
  time" pill in place of "Pickup requested". `pickupState()` gained `declined` under the same
  matching-slot fail-safe; the foster's card names the shelter, quotes the note *From {shelter}*
  (nothing when blank) and reopens the calendar; re-requesting clears both fields. New
  `agreedPickup(fosterPickup, application, loading)` gates *start Care Plan* (title: *Waiting for
  {shelter} to confirm pickup*) and anchors Hub's and Saved's countdowns — which also makes
  `SavedView:90` and `DogDetailView:244`'s "in your care" true, since `MatchView` is the only
  writer of `phase: "care_plan"`. **Differences from the spec:** (a) `loading` is a third input,
  because an application still loading returns `null` exactly like an absent one and would have
  briefly unlocked Care Plan; (b) `PostFosterView`'s `fosterWindow` caller was left alone — it
  reads only `win.total`, which no pickup date changes; (c) `setPickupConfirmed` also clears the
  decline, so the two answers never both stand; (d) **beyond the spec, the `create` rule** now
  requires all three answer fields null — a foster could otherwise open an application already
  carrying a note in the shelter's voice, which the update-branch change alone left open (RS-14b
  step 7). Verified: vitest 211 (new `pickupState` declined / re-requested / mismatch,
  `agreedPickup`, inbox pills, five rendered `MatchView` cases), tsc + build, lint at 8. Rules
  change **not** verified against Firestore — RS-14b (6)–(7).

## The lead

- **A lead, not an item (2026-09-28): nothing ever writes `status: "foster"`.** `DogStatus` has the
  value and `rosterActions` handles it, but no screen, tool or script sets it — so a dog whose
  pickup the shelter confirmed stays `available`, listed, and appliable by a second foster. RS-15
  makes the confirmation the handoff, which is where this belongs; RS-16 is what keeps it from
  being reset. Queue it once both ship, sized against whatever RS-15's row says. *(RS-15 shipped
  2026-09-28: `agreedPickup()` in `applicationView.ts` is the one place "the shelter confirmed" is
  decided — a `foster` status write belongs beside `setPickupConfirmed`, staff-side.)*

## RS-6b, RS-12b and RS-8 under "Needs a human" — verbatim as of 2026-09-29

- **RS-6b — PARTIALLY DONE 2026-09-04; the write half is still open.** Same sitting: `/shelter/dogs`
  loaded and listed all **19** SF SPCA dogs for the staff account and the add-a-dog form renders
  and accepts input, so the staff *read* path over `dogs` works. The session filled the form and
  deliberately stopped rather than write a real animal into the production roster unasked. Three
  checks remain, all needing a signed-in human, all one sitting with RS-8 and RS-12's signed-in
  half: (1) submit the form with the photo field blank — expect the dog in foster-side Discovery
  with a paw tile, **not** a placedog photo; (2) retire it — expect it to leave Discovery and stay
  readable by id; (3) from the console, `updateDoc` that dog with a different `shelter_id` and
  expect `permission-denied`. **Write down what happened.** A denial in (1) or (2) is a finding to
  queue, never licence to widen `firestore.rules`.


- **RS-12b — OPEN 2026-09-05. The signed-in half of RS-12.** One sitting with RS-6b and RS-8.
  A `ready_for_adoption` dog is written only by the Admin SDK at the end of a real Post Foster
  turn, so producing one at all is part of the check. Either run a foster journey to completion
  on a test account, or hand-write `status: "ready_for_adoption"` plus an `adoption_profile`
  string onto a `fixture-` dog from the console. Then, signed in as the uid in
  `shelters/sfspca-mission` at `/shelter/dogs`: (1) expect a **Back from foster** card *above*
  Listed, with the whole profile readable and no ellipsis; (2) press **List for adoption** —
  expect the dog to move into Listed and reappear in foster-side Discovery; (3) on a second
  returned dog press **Mark adopted** — expect it to move to the catch-all with **no button at
  all**, since `adopted` is terminal. A `permission-denied` on (2) or (3) is a finding to queue,
  never licence to widen `firestore.rules` — the write is status-only on a dog the shelter owns
  and RS-6's rule should already allow it. **Write down what happened.**

- **RS-8 — PARKED 2026-08-31, not pending. Confirm RS-2's `staff` and `notStaff`
  states on the deployed app.** Both need a real Google popup sign-in, which no
  unattended run can drive, and per the README's "nobody uses this app yet"
  section they gate behaviour nobody is currently blocked by. RS-5 will likely
  answer half of it in passing, since building the inbox exercises the same gate.
  Do not re-queue. When there is a human: sign in as the uid seeded in
  `shelters/sfspca-mission`, open `https://pawthway-hackathon.web.app/shelter`,
  expect the staff dashboard shell; then any other account, expect the "isn't on a
  shelter's staff list" copy. Two minutes. Record the result here.
