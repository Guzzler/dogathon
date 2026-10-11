# RS-22 spec — archived verbatim 2026-10-10, the day it shipped

From `real-data-and-shelters.md`'s Task queue, as execute read it.

- [ ] **RS-22 `[large]` — a foster that ended is history, not a hold (queued by plan 2026-10-09,
  at `8e0e0ab`; re-verified 2026-10-10 at `03e308e`, after PH-32 merged under it — every citation
  holds, the staff branch of `applications` is still unconditional, so "no rules change" stands;
  PH-35 is its natural rider).** RS-21's predicate read against the one state its spec didn't walk: the dog
  *coming back*. Every line re-read against `main`:
  - `confirmedHolder()` (`lib/applicationView.ts:406`) is *live + stamped*, and nothing ever moves
    a finished foster's application out of `approved`. **Mark journey complete** writes only
    `fosters/{uid}.phase` (`PostFosterView.tsx:145`); the agent's send flips only the dog; the
    roster's **List for adoption** / **Mark adopted** are dog-only writes (`applyRosterAction`,
    `lib/shelterRoster.ts:58`).
  - So the end of *every* journey: the dog arrives under *Back from foster*, `rosterActions
    ("ready_for_adoption", held)` (`lib/shelterDog.ts:219`) still offers **List for adoption**,
    staff press it — and the dog is `available` and **held**. `rosterActions` returns `[]`, the
    row reads *Going home with {the foster who just brought it back}*, Discovery lists it, and
    `pickupHolder()` refuses **Confirm pickup** to every new applicant, forever. The one escape is
    pressing **Undo confirmation** on a finished foster's application, which says the wrong thing.

  **Design answer: the shelter ends a foster by acknowledging the dog's return, in the same write.**
  Not on **Mark journey complete** and not on the agent's send — both are the foster's claim, and
  rules only let a foster write `withdrawn`. The shelter's acknowledgement is the moment it has
  the dog back, and it already exists as a button. The stamp stays (it is history); the status
  is what stops it holding.

  **Spec.**
  1. `types.ts`: `ApplicationStatus` gains `"completed"`; `Application` gains optional
     `completedAt`. `applicationView.ts`: `STATUS_LABELS.completed = "Fostered"`,
     `staffTransitions("completed")` → `[]`, `isActionable` false for it, `LIVE` unchanged (so
     `confirmedHolder`/`pickupHolder` release it with no edit). `approvalDecision("completed")`
     → `"approved"` — a finished foster never renders as a decline or a withdrawal; `tsc` on the
     `Record` finds every other switch, and each gets an explicit case.
  2. `lib/shelterRoster.ts`: `applyRosterAction(dogId, action, holder: Application | null = null)`
     — for `list`/`adopted` with a holder, one `writeBatch`: the dog's status and
     `applications/{holder.id}` `{ status: "completed", completedAt, updatedAt }`. Every other
     action stays the single dog write. **No rules change**: the staff branch of `applications`
     already admits it, and `dogs` update is unchanged.
  3. `ShelterRosterView.tsx`: `ReturnedDog` passes its `holder` through `useRosterWrite`, and
     says above the buttons *Fostered by {fosterName}. Listing or marking adopted closes their
     application.* (in `shelter__open-note`).
  4. Inbox: a `completed` row's pill reads *Fostered*; its detail offers no status buttons, no
     **Undo confirmation**, no **Ask for another time** — check each `canConfirmPickup`-style
     gate is `isLive`-based rather than `!== "withdrawn"`.
  5. Foster side: Saved's Applications timeline shows every stage done for `completed`;
     `activeApplication()` already returns `null` at `phase: "complete"`.

  **Not in scope:** a dog relisted *before* this ships keeps its stale holder (only `fixture-`
  rows exist; **Undo confirmation** is the manual escape); the foster's withdraw branch doesn't
  check the *prior* status, so a foster could rewrite `completed` → `withdrawn` — harmless (neither
  holds) and **not** to be closed by pinning prior status, because `deleteAccount()` redacts
  `fosterName` through that branch on every application the uid has, declined and completed
  included. **Verify:** vitest — `confirmedHolder` ignores `completed`; `rosterActions("available",
  false)` after the batch offers **Retire**; `applyRosterAction` with a holder batches both writes
  and without one writes the dog alone; a roster render of a returned dog with a holder shows the
  new line, and of a relisted dog whose application is `completed` shows **Retire** and no *Going
  home with*; an inbox render of a `completed` row offers nothing. `tsc -b`, build, lint at
  `main`'s 8. Signed-in half is RS-14b's step (12). **Interlocks with PH-32**, whose publish gate
  is written to admit `completed` — a finished foster's page must stay up exactly when the dog is
  relisted for adoption.

