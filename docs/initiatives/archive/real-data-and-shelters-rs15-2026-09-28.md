# RS-15's spec and design answer, verbatim (archived 2026-09-28, the run it shipped)

Snapshotted from `real-data-and-shelters.md`'s Task queue at the moment RS-15 shipped, so the
working doc keeps a one-line pointer instead. The Ledger row there is the account of what shipped
and how it differed; this is what was asked for.

- [ ] **RS-15 `[large]` — the handoff happens on the shelter's say-so (queued 2026-09-27).** RS-14
  made a pickup a *request* the shelter answers — but the shelter has one answer, **Confirm**, and
  the foster's journey never waits for it. Read on `main` at `e646a73`:
  - **The dog is "in your care" on a request.** `MatchView.tsx`'s *I've got {dog} → start Care
    Plan* is `disabled={!foster.pickup}` — any request, confirmed or not — and `goToCarePlan()`
    flips `phase: "care_plan"`, which Saved then renders as *"{dog} is in your care"*
    (`SavedView.tsx:90`). A foster can declare a handoff the shelter never agreed to.
  - **The countdown runs off an unanswered date.** `fosterWindow()` anchors on `foster.pickup.date`
    at all three callers (`HubView.tsx:89`, `SavedView.tsx:172`, `PostFosterView.tsx:50`) with no
    reference to `pickupState()`, so the Hub says "Pickup in 3 days" for a slot nobody confirmed.
  - **A shelter that can't make the slot has no way to say so.** The inbox detail
    (`ShelterApplicationsView.tsx:326-344`) offers Confirm / Undo confirmation. Not confirming is
    silence, and the foster's card says "Pickup requested" forever.

  **Re-verified 2026-09-28 at `a9ba673`, after PH-31:** all three hold; `SavedView`'s `fosterWindow`
  caller moved to `:188`. The census missed one reader of the phase — `DogDetailView.tsx:244`'s
  *"{dog} is in your care right now"* on the one-at-a-time sheet — which item 5's gate makes true
  along with `SavedView:90`, so no spec change; name it in the row.

  **Design answer (this run's question — who owns the handoff?).** The same rule RS-14 set, read
  one step further: **only the party that answers a request can turn it into a fact, and nothing
  downstream may treat the request as the fact.** So the shelter gets a second answer, and every
  screen that currently reads `foster.pickup` as "the dog is coming" reads `pickupState()` instead.
  A shelter-typed note is the shelter speaking as itself, so it is allowed — attributed, never
  paraphrased by a model. Where there is **no application** (`LOCAL_MODE`, the one path with nobody
  to answer), keep today's behaviour: gating a local demo on a confirmation that cannot arrive
  would strand it, and `pickupState()` already caps that case at `requested`.

  1. **Staff: "Ask for another time".** Beside Confirm in the inbox detail, on the same condition
     (`canConfirmPickup`). Writes `pickupDeclinedAt: serverTimestamp()`, `pickupConfirmedAt: null`,
     and an optional `pickupNote` (≤ 200 chars, trimmed, `null` if blank); leaves `pickup` as it is
     so the foster sees *which* slot was declined. Staff branch is `isStaff(...)` — no rules change
     for this half. New helper in `lib/applications.ts` beside `setPickupConfirmed`. Types:
     `Application` gains both fields, optional-nullable, same comment style as `pickupConfirmedAt`.
  2. **`pickupState()` gains `"declined"`** — `pickupDeclinedAt` set **and** `application.pickup`
     matches the foster's slot (`sameSlot`, the same fail-safe as `confirmed`). `activeStage()`
     treats it like `requested` (stage 3, not done). `pickupAwaitingShelter()` is false on it, so
     the inbox pill clears. The inbox row shows "Asked for another time" in its place.
  3. **Foster: the declined card.** `MatchView`'s pickup card says *"{shelterName(dog)} asked for a
     different time"*, renders the note attributed (*From {shelter}*, or nothing if `null` — no
     stand-in), and reopens `PickupScheduler`. Reuse the confirmed/requested card's one class per
     this doc's standing note — no fourth phrasing of a pickup state.
  4. **Re-requesting clears the answer.** `requestPickup()` writes `pickupDeclinedAt: null` and
     `pickupNote: null` alongside the new slot. **Rules:** the foster pickup branch's `hasOnly`
     gains both keys, and the foster may set each **only to `null`** — the same shape as
     `pickupConfirmedAt`. A foster must never be able to write a note in the shelter's voice.
  5. **Care Plan waits for the shelter.** The start button's condition becomes `pickup ===
     "confirmed"` when an application exists, `Boolean(foster.pickup)` when none does; its `title`
     says *"Waiting for {shelter} to confirm pickup"*. The countdown callers pass the pickup date
     only under the same condition (Hub and Saved already can: Saved has `useApplication`, Hub adds
     it), so an unanswered request shows the total commitment, as before any pickup.

  **Not in scope:** staff proposing a specific counter-slot (the note carries it in words; a second
  writer of `pickup` is the drift RS-14 designed out); a foster *already* in `care_plan` on an
  unconfirmed request before this ships (no users — leave them); `get_foster` reporting confirmation
  (still true from RS-14); PH-31 (its own item). **Verify:** vitest — `pickupState` declined /
  declined-then-re-requested (`requested`) / declined-slot-mismatch (`requested`); a rendered
  `MatchView` case each for the start button disabled on `requested`, enabled on `confirmed`,
  enabled with no application, and the declined card with and without a note
  (`MatchView.test.tsx`'s `renderToStaticMarkup` pattern); `fosterWindow` callers not started on
  `requested`. `./node_modules/.bin/tsc -b`, build, lint at `main`'s 8. The rules change cannot be
  verified unattended — it joins **RS-14b** below as its step (6).

