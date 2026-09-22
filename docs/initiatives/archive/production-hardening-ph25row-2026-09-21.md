# production-hardening.md — PH-25's Ledger row, verbatim (archived 2026-09-21)

Moved out of the working doc's Ledger when PH-27 was queued, to keep it under the README's ceiling. Text unchanged.

- 2026-09-19 — PH-25 `[large]` — PR #93 — **a retake of the questionnaire no longer keeps the
  answers the foster took back.** `patchFoster()` writes
  `setDoc(..., { mergeFields: keys.map(k => new FieldPath(k)) })` instead of `{ merge: true }`:
  every key in the patch is now replaced whole, and keys the patch never mentions are untouched.
  That is one line of behaviour and it fixes all three symptoms the spec listed, two of them
  without being touched:
  - **The fix is at the helper, and the two call sites are now correct as already written.**
    `HubView.reset()`'s `patchFoster({ intake: {} })` was a **no-op** under nested merge — "Change
    answers" cleared the phase, the swipes and the match and left every answer in place, with a
    comment saying the opposite. It is now a real clear, so only the comment changed.
    `DiscoveryView`'s "Retake the questionnaire" clears nothing and did not need to: `finish()`
    writes a full `intake` over the old one. The spec said to check that before changing the line;
    checked, and the line stands.
  - **`mergeFields` over `updateDoc`, and a `FieldPath` per key.** `updateDoc` would also replace a
    map, but it fails on a document that does not exist — and `fosters/{uid}` does not exist for a
    foster whose first write is onboarding. `mergeFields` still creates it. The keys are wrapped in
    `new FieldPath(k)` because `mergeFields` parses a bare string as a **dotted path**; the test's
    fake throws on a string rather than accepting one, so that stays true.
  - **Replacing every key, not just `intake`, and why that is not wider than the item.** The spec's
    census held: `intake` is the only nested map written partially, `pickup` is written whole or
    `null`, `adoptionHighlights` writes all three keys every time, everything else is a scalar or
    an array, and arrays were already replaced. So "replace the listed keys" and "merge the listed
    keys" differ on exactly one key today — and the uniform rule is the one that makes
    `writeLocalFoster()`'s shallow spread and Firestore the *same function*, which is the
    acceptance bar the design section set. A no-key patch now returns before either branch, so the
    two layers agree on the empty patch too.
  - **The tests are an outcome, not a call shape, and the guest half is real.** 13 new tests in
    `web/src/hooks/useFoster.test.ts` drive **one fixture** — a first pass with both sliders moved,
    then PH-24's retake with neither — through **both layers** and assert the stored `intake` equals
    the second pass exactly. The Firestore half is a fake that models both `SetOptions` (deep merge
    vs. replace-listed); the guest half is the real `localMode` code over a `localStorage` shim.
    The first test asserts the **old** semantics directly, so the suite is known to be able to see
    the defect — and it can: reverting the one line turns **5 of the 13 red and leaves 8 green**,
    and the 8 are precisely the guest cases plus that model, which is the spec's claim that
    LOCAL_MODE was already right, observed rather than reasoned about.
  - **The `time_availability` backfill question, answered as the spec asked.** There is no
    migration and none is needed: a true replacement takes a pre-PH-24 `time_availability` with it
    on the foster's next retake, and a test asserts exactly that on both layers. A foster who never
    retakes keeps it, and `get_foster()` will keep reading it — which is a **stale** claim rather
    than an invented one, so it is left rather than rewritten.
  - **What is *not* verified**: nothing was driven against real Firestore. The changed branch is the
    signed-in one, so observing it needs a Google sign-in and two passes through onboarding on the
    deployed app — parked under "Needs a human" as **PH-25b** rather than queued. The merge
    semantics are modelled from Firestore's documented behaviour; per the README's rule, what this
    was measured against is part of the claim.
