# real-data-and-shelters — RS-20 Ledger row, archived verbatim 2026-10-09

Moved out of `real-data-and-shelters.md` when RS-22's spec took the doc past ~400 lines. Verbatim:

- 2026-10-02 — RS-20 `[large]` — PR #116 — A dog off the roster is not a pickup to confirm:
  `offRoster()` (`retired`/`adopted` only) and `unlisted()` in `applicationView.ts`, pure. Inbox detail
  drops **Confirm pickup** and **Ask for another time** for an unconfirmed live application on an
  off-roster dog and says so; RS-17's *won't change that* now shows for `medical_hold` (and the
  other in-progress statuses) only; the row pill *Dog not listed* reuses `shelter__pill--dog` via a
  new `PickupPills` row component. `ShelterRosterView` subscribes to applications once and shows
  *{n} open application(s)* beside **Retire** / **Mark adopted** (one new `.shelter__open-note`
  rule). Match and Saved say *{dog} isn't listed by {shelter} right now* and hide the scheduler,
  the locked request button and **Change request**; an existing request stays as a read-only card.
  **Three deviations from the spec:** (1) `adopted` is terminal on the roster (`rosterActions`
  offers nothing), so the inbox line for it says *there's no pickup to confirm* rather than
  *Relist it*, which the roster can't do; `retired` says *List it again*, the roster's own label.
  (2) Match has no **Withdraw** button (it lives in Saved), so Match's notice points at Saved
  rather than rendering one. (3) The inbox gate excludes a pickup already confirmed (it keeps
  **Undo confirmation**), the confirmed-holder case the spec put out of scope — but `unlisted()`
  as specified still tells a confirmed holder of a *retired* dog, and Care Plan's start button
  stays enabled for them: lead (b)'s family, noted not fixed. vitest 252 (15 new), tsc, build,
  lint 8 (unchanged). **Not verified signed in or against Firestore** — RS-14b (10).
