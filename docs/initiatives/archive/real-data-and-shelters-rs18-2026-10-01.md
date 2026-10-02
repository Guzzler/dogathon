# RS-18 spec, archived verbatim 2026-10-01 (the run that shipped it)

From [`../real-data-and-shelters.md`](../real-data-and-shelters.md)'s Task queue, as queued on 2026-09-30.

- [ ] **RS-18 `[large]` — one dog, one confirmed pickup, and the other applicants are told
  (queued 2026-09-30).** From RS-17's lead (a), read against `main` and found worse than the lead
  said. Once staff confirm foster A's pickup, the dog is `foster` and leaves Discovery (`isListable`,
  `lib/dog.ts:128`), but **foster B's earlier application is untouched**: B's Match view never reads
  the dog's `status`, so B can still request a pickup (`MatchView.tsx:106` → `requestPickup`), the
  inbox shows B's row as *Pickup requested*, and `canConfirmPickup` (`applicationView.ts:349`) checks
  only B's own status and slot. Staff pressing **Confirm pickup** on B is told, in muted text,
  *"{dog} is marked in foster — confirming won't change that"*
  (`ShelterApplicationsView.tsx:398-401`, a line RS-17 wrote for `medical_hold`/`retired`) and B's
  Care Plan unlocks. **Two fosters each holding a confirmed pickup for one dog** — reasoned from the
  code, not observed; nobody has two test fosters on one dog.

  **Design answer (this run's question — what does confirming one pickup do to the other
  applications on the same dog?).** **It makes them answerable; it does not answer them.**
  Auto-declining in the same batch would turn requests staff never opened into decisions — the
  exact move RS-15 ruled out (*only the party that answers a request can turn it into a fact*) — and
  a shelter keeping a second applicant in case the first falls through is ordinary practice, which
  RS-17's lead (b) shows happens. So: **one confirmed pickup per dog is a hard gate, everything else
  is information.** A pure check over data each side already loads, no new field and no rules change
  — rules can't query sibling applications, and a `heldBy` field on the dog would be a fourth writer
  of `dogs` to keep in sync (RS-10, RS-16). Staff are the only confirmers, so a UI gate on the one
  surface that confirms is the whole enforcement; the rules half is a lead, not part of this item.

  1. `applicationView.ts`: `heldByAnother(app, applications)` — true when some *other* application
     with the same `dogId` is in `LIVE` with a non-null `pickupConfirmedAt`. Pure; vitest it,
     including a withdrawn holder (not held) and the application itself (not "another").
  2. Inbox detail (`ShelterApplicationsView.tsx`): when `heldByAnother`, **Confirm pickup** is not
     offered (**Ask for another time** and **Decline** still are), and in place of the muted line:
     *"{dog} is going home with {holder's fosterName}. Decline this application, or take that
     confirmation back first."* The holder's name is a link that selects that row. The RS-17
     *won't change that* line stays for `medical_hold`/`retired`/etc. and **must not render** for a
     dog held here.
  3. Inbox list: a held-by-another live row gets one pill, **Dog placed with another foster**, styled
     as a state rather than an alarm (reuse an existing `shelter__pill--*` modifier if one reads
     right; DC's one-class-per-state note), so staff can find the rows to answer without opening each.
  4. Foster side, Match (and Saved's Applications tab, which reads the same timeline): when the
     application is live, has no `pickupConfirmedAt` of its own, and the matched dog's `status` is
     `foster`, say so — *"{dog} is now in another foster home. {shelterName} hasn't answered your
     application yet."* — through `shelterName()` (PH-28) and **not** as a decline (RS-11: an absent
     answer never renders as one). Pickup scheduling is withheld with that line as its reason; the
     foster keeps **Withdraw**. Their own confirmed application never shows it (`foster` is then
     *their* dog).

  **Not in scope:** a bulk *Decline the others* (one item, one answer at a time first); a rules-level
  guard; lead (b). **Verify:** vitest for `heldByAnother` and for the inbox (extend
  `ShelterApplicationsView.test.tsx`): with A confirmed and B live with a pickup, B's detail offers no
  **Confirm pickup**, shows the *going home with* line and not the *won't change that* line, and B's
  row carries the pill; A's detail is unchanged. A Match test where the dog is `foster` and the
  foster's application is unconfirmed renders the notice and no scheduler, and where it is confirmed
  renders neither notice nor change. `npm run test`, `tsc`, `build`, `lint` green. Signed-in half is
  RS-14b's step (9) — say so in the row.
