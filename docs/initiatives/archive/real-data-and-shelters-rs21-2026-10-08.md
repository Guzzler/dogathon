# RS-21 — spec as queued (archived verbatim 2026-10-08, the day it shipped)

Moved out of [`../real-data-and-shelters.md`](../real-data-and-shelters.md) when execute shipped it, to keep that doc under its ~400-line ceiling. The Ledger row there is what shipped.

- [ ] **RS-21 `[large]` — a confirmed pickup is taken back where it was given (queued 2026-10-08).**
  *Found by reading RS-20's Ledger deviation (3) against `main`* — "noted, not fixed". Grounding,
  each line re-read at `7f81d39`:
  - `rosterActions()` (`lib/shelterDog.ts:211`) is keyed on **status alone**: a `foster` dog gets
    `["relist", "retire"]` and a `medical_hold` dog `["retire"]`, whether or not a live application
    holds a confirmed pickup on it. RS-17 added them for the *withdrawn-after-handoff* case, but
    nothing restricts them to it, so **List again** puts a dog promised to a foster back into
    Discovery, and **Retire** takes it down, both without a word to the holder.
  - The roster already subscribes to the shelter's applications (`ShelterRosterView.tsx:48`, RS-20),
    so the holder is computable there at no extra read.
  - After a retire, the holder's Match is self-contradicting: `unlisted()` (`applicationView.ts:447`)
    excludes a confirmed stamp only for `adopted`, so the card says *"They haven't answered your
    application yet"* about an application staff **confirmed**, while `agreedPickup()` still returns
    the slot — Care Plan's start button stays enabled and Hub/Saved count down to a pickup for a dog
    the shelter took down. The inbox detail says nothing either (`notListed = !confirmed && …`,
    `ShelterApplicationsView.tsx:419`); only `handoffStatus` is already right (unconfirm on a
    `retired` dog writes no status, `shelterDog.ts:279`).

  **Design answer: a confirmed pickup is the shelter's answer, and only the surface that gave it
  can take it back.** RS-17 made the inbox the owner of the handoff; the roster's buttons are a
  second writer of the same fact that skips the person it was promised to. So the roster does not
  act on a dog a live confirmation holds — it names the holder and sends staff to the inbox, where
  **Undo confirmation** already relists and already tells the foster. Not a confirm dialog (RS-20's
  rule: a statement, not a prompt), and not a bulk decline. A returned dog (`ready_for_adoption`)
  and the terminal statuses are unaffected: the holder's stamp there is a finished handoff, not a
  hold. The foster side, for the state that can still exist (a retire that landed before this
  ships, or a direct console write), says both true things and agrees to nothing.

  **Spec.**
  1. `lib/applicationView.ts`: export `confirmedHolder(dogId, applications)` — the live application
     on that dog with `pickupConfirmedAt` — and have `pickupHolder()` call it (one predicate, not
     two). `unlisted()` returns false for **any** confirmed stamp; add `takenDownAfterConfirm(app,
     dogStatus)` = live, confirmed, dog `retired`. `agreedPickup()` gains an optional fourth input
     `dogStatus` and returns `null` when it is `retired` (not `adopted` — that is the finished
     journey); pass it at all three call sites (`MatchView.tsx:73`, `HubView.tsx:94`,
     `SavedView.tsx:189`).
  2. `lib/shelterDog.ts`: `rosterActions(status, held = false)` returns `[]` when `held` and `status`
     is `available`, `foster` or `medical_hold`; unchanged otherwise.
  3. `ShelterRosterView.tsx`: compute holders beside `openApplications` (same `ready` guard — a
     loading read holds nothing, so it falls back to today's buttons) and pass `held` to every
     `rosterActions` call. A held `DogRow` renders, in `shelter__open-note`, *Going home with
     {fosterName} · pickup {date}. To change that, take back the confirmation in Applications.*
     with **Applications** linking to `/shelter?app={id}` — no new class.
  4. `ShelterApplicationsView.tsx`: read `?app=` once as the initial `selectedId` (falls back to the
     newest as now). In the pickup detail, a confirmed application on a `retired` dog keeps **Undo
     confirmation** and gains the line *{dog} is retired on your roster, but this pickup is still
     confirmed — the foster still sees it. Undo the confirmation to tell them, or List {dog} again.*
  5. `MatchView.tsx` (and Saved's card): when `takenDownAfterConfirm`, a `role="status"` card reads
     *{shelter} confirmed your pickup, then took {dog} off its roster. Check with them before you go
     to collect {dog}.* and **I've got {dog}** is disabled (it follows `agreedPickup`, so this is
     step 1 doing its job). Never a decline (RS-11).

  **Not in scope:** a retire that happens *after* the foster is in Care Plan (status is still
  `foster`, so step 2 already blocks the roster path; a direct write is RS-17 lead (b)'s family);
  the withdraw-branch `hasOnly` lead below; any rules change. **Verify:** vitest — `rosterActions`
  held × each status; `confirmedHolder` ignores withdrawn/declined stamps and other dogs;
  `unlisted` false and `takenDownAfterConfirm` true for confirmed+`retired`; `agreedPickup` null for
  `retired`, the slot for `adopted`; extend `ShelterRosterView.test.tsx` so a held `foster` dog
  renders the holder line and no **List again**/**Retire**, and an unheld one still offers both;
  `?app=` selects in `ShelterApplicationsView.test.tsx`. `tsc -b`, build, lint at `main`'s 8. The
  signed-in half is RS-14b step (11).
