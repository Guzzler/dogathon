# RS-20 — spec as queued (verbatim snapshot, archived 2026-10-02 when it shipped)

Snapshotted from `real-data-and-shelters.md`'s Task queue in the same PR that shipped it, per the
README's doc-size rule. The Ledger row in the working doc is what actually shipped.

- [ ] **RS-20 `[large]` — a dog off the roster is not a pickup to confirm, and its applicants are
  told (queued 2026-10-02).** *Grounded against `main` at `0d5dde4`.* Retiring a dog
  (`ShelterRosterView.tsx` → `retireDog()`, `shelterRoster.ts:50`) reads no applications, so every
  live application on it stays `submitted`/`approved` and nothing changes for anyone. In the inbox,
  `canConfirmPickup()` (`applicationView.ts:352`) is status-and-slot only, so a **retired or adopted**
  dog's application still offers **Confirm pickup** — under RS-17's muted *{dog} is marked retired —
  confirming won't change that* (`ShelterApplicationsView.tsx:431`). Pressing it stamps
  `pickupConfirmedAt`, `handoffStatus()` (`shelterDog.ts`) leaves `retired` alone by design, and the
  foster's Match reads *confirmed* and unlocks Care Plan for a dog the shelter took down. On the
  foster side `placedElsewhere()` keys on `foster` only, so a retired dog's applicant sees an
  in-progress journey with a live scheduler indefinitely.
  **Design answer (this run's question): *staff's earlier decision about a listing outranks a
  request made against it — a dog not listed is not confirmable, and its applicants are told the
  listing, not a verdict.*** RS-17's muted line was right for `medical_hold` (a pause; a slot after it
  is a fair thing to agree) and wrong for `retired`/`adopted`, which PH-31 already treats as *not
  appliable*; confirming is a stronger act than applying, so it can't be looser. And retiring does
  **not** decline anybody — the same rule as RS-18, *answerable, not answered*: a bulk decline is
  the shelter speaking to N people with one click, and RS-11 forbids rendering an absent answer as a
  decline.
  **Spec.** (1) `applicationView.ts`: a pure `offRoster(dogStatus)` — true for `retired` and
  `adopted` only (not `medical_hold`, `foster`, `ready_for_adoption`); and `unlisted(application,
  dogStatus)` — live application, `offRoster(dogStatus)`, and *not* the application's own confirmed
  stamp on an `adopted` dog (that is the holder's finished journey, not a notice). (2) Inbox detail:
  when `offRoster(dog.status)`, no **Confirm pickup** and no **Ask for another time**; in their
  place *{dog} is marked {retired|adopted} on your roster. Relist it to confirm a pickup, or answer
  the application below.* — the status buttons stay. The row pill reads *Dog not listed* (reuse
  `shelter__pill--dog`, as RS-18 did; no new modifier). RS-17's *won't change that* line survives
  for `medical_hold` only. (3) Roster: `DogRow`'s **Retire** (and `ReturnedDog`'s **Mark adopted**)
  shows, when the dog has live applications, *{n} open application(s) — they stay open, and each
  foster will see {dog} isn't listed. Answer them in Applications.* above the buttons; reading
  `useShelterApplications(active.id)` once in `ShelterRosterView` and passing a per-dog count down —
  no second subscription per row. Count with `isLive`. Retiring still takes one click; this is a
  statement, not a confirm dialog. (4) Match and Saved: when `unlisted(...)`, a notice *{dog} isn't
  listed by {shelter} right now. They haven't answered your application yet.* (name via
  `shelterName()`, PH-28); the scheduler and **Change request** are hidden (a request nobody can
  confirm is not one to offer — unlike RS-19's `foster` case, where the holder needs them), any
  existing request text stays read-only, and **Withdraw** stays. Not the `declined` screen and not
  the badge. Relisting the dog brings everything back, because it is all derived.
  **Not in scope:** a rules-level guard (rules can't read the dog from an application update without
  a `get()` the inbox doesn't need); a confirmed holder whose dog is then retired (lead (b)'s
  family — note it in the row if found); `medical_hold` behaviour; bulk decline.
  **Verify:** vitest for `offRoster`/`unlisted` (each `DogStatus`, live vs withdrawn, own confirmed
  stamp on `adopted`); extend `ShelterApplicationsView.test.tsx` — a retired dog's live application
  with a pickup shows no **Confirm pickup**, no **Ask for another time**, the *Relist it* line and
  the pill, and a `medical_hold` dog's still shows RS-17's line and the button;
  `ShelterRosterView.test.tsx` — a dog with two live and one withdrawn application shows *2 open
  applications*; a Match test where the dog is `retired` renders the notice, no scheduler, and
  **Withdraw**, and where it is `available` renders neither. `npm run test`, `tsc`, `build`, `lint`
  green. Signed-in half is RS-14b's step (10) — say so in the row.
