# Real data, and the shelter side

The two evidence docs already did the research and the design:
[`docs/shelter-integration.md`](../shelter-integration.md) (the
`applications` collection, `shelters/{id}` with `staffUids`, the rules
sketch) and [`docs/real-data-sourcing.md`](../real-data-sourcing.md) (why
Petfinder is dead, why scraping-then-reviewing beats a live feed for a
two-person team, the source-adapter shape). This doc is the milestone
sequence that turns those into shipped PRs, plus what has changed since
they were written.

**What "make it real" actually means here:** automated where a machine can
be trusted (pulling and normalizing listing data), human-approved where a
real animal's status is on the line (a shelter confirms their own roster
changed, a foster's application is reviewed by an actual person). Neither
half is optional — a fully automated shelter side ships a stale or wrong
listing to someone hoping to foster a specific dog; a fully manual one never
scales past one shelter.

**Archived 2026-08-29, and repeatedly since.** This doc keeps arriving at the README's
~400-line threshold, so settled sections are snapshotted verbatim into
[`archive/`](archive/) and compressed here to a decision plus a pointer. The 2026-08-29
snapshot holds the settled M1 / M2 / M4 narrative and the "where this stands" section as
they stood; the [2026-09-03 one](archive/real-data-and-shelters-2026-09-03.md) holds the
application round-trip design section and RS-10's full ledger row. Read the archive for the reasoning
behind a settled decision; read this file for what is open.

## Where this actually stands (verified against `main`; each line dated by the run that checked it)

Nothing here is carried over from a previous wording — a line is re-read or it is re-dated.
Unless a bullet says otherwise it was last confirmed **2026-09-01**.

- **The offline import pipeline is built, for one shelter, with a manual trigger
  on purpose.** `scripts/import_dogs.py` + `scripts/shelters/sfspca.py` +
  `data/enrichment.json` → `data/dogs.json`, reviewed and committed, never fetched
  at runtime; `--plan` diffs before writing and the real push replaces rather than
  appends (PR #13). `import-dogs.yml` is `workflow_dispatch` only — *"the roster
  should change when someone decides it should, not because a file moved."* Extend
  this pattern; don't replace it.
- **The roster is one shelter deep.** Every dog carries
  `shelter_id: "sfspca-mission"`. `web/src/lib/shelters.ts` lists **six** orgs
  (re-counted 2026-09-04 off the `id:` literals); the other five have zero dogs and no import path —
  decorative until M3. `shelters.test.ts` guards the canonical id.
- **`shelters/sfspca-mission` exists** in production Firestore with the repo
  owner's uid in `staffUids` (RS-2, PR #34), so `isStaff()` evaluates against a
  real document. `scripts/seed_shelter_staff.py` makes that write reproducible.
- **`match /dogs/{dogId}` is no longer `allow write: if false`** — RS-6 (2026-09-01) split it
  into `create: isStaff(request.resource.data.shelter_id)`, `update: isStaff(resource.data.shelter_id)
  && shelter_id unchanged`, and `delete: if false`. That was the one relaxation M3 called for
  and it is spent; nothing else about dogs changed, and the pinned `shelter_id` on update is
  what stops staff at one shelter reaching another's roster.
- **`applications`'s update rule is now tight, and one field is deliberately
  loose.** PH-15 and PH-16 shipped (PRs #48, #49): the foster branch pins
  `fosterId`, `shelterId`, `dogId`, `createdAt` and `checklist`, leaving
  `fosterName` free so account deletion can redact it. Read
  `firestore.rules:45-62` before touching that branch. Two consequences for RS-5:
  a `withdrawn` row whose `fosterName` reads `"(deleted account)"` is a state the
  inbox has to render, and the `shelterId` its query filters on can no longer be
  rewritten out from under it.
- **The `applications` composite index (`shelterId` ASC, `createdAt` DESC) is
  `READY`** — RS-7 (PRs #38, #39) wired the deploy target, RS-9 supplied the IAM
  grant. RS-5's query has a serving index to run against.
- **2026-09-03 — the application round trip is closed in both directions, and the design
  sections that specified it are now descriptions of shipped code.** RS-10 joined the two
  checklist halves by `owner`; RS-11 threaded `application.status` into the foster side under
  the `declined` > `withdrawn` > `approved` > checklist precedence and made withdrawing write
  `withdrawn` back. Both are compressed into the settled-design block below. What is *not*
  closed is that no human has driven it end to end.
- **2026-09-04 — `applications` is no longer empty, and the read rule is proven.** Three
  `fixture-` rows written with Sharang present; the inbox renders them signed in as staff, and
  both staff writes (a checklist tick, `Mark approved`) succeed. RS-5b is discharged; the
  README's "zero documents in the `applications` collection" line is now stale.
- **2026-09-05 — both halves of that gap are closed (RS-12).** The paragraph the agent writes
  at the end of a journey now renders in full in a **Back from foster** group at the top of
  `ShelterRosterView`, and a returned dog is offered **List for adoption** / **Mark adopted**
  instead of the wrong verb. `rosterActions()` (plural) and `groupRoster()` decide both in
  `web/src/lib/shelterDog.ts`, unit tested across all six `DogStatus` values. No rules change was
  needed — RS-6's `update` rule already permits a status-only write on your own shelter's dog.
  `send_adoption_profile_to_shelter`'s `notified_shelter` is now `True` because that write landed,
  with Arcade reported separately as `arcade_messaging_available`. Nothing signed-in was verified:
  see RS-12b.


## Milestones (compressed; full narrative in the archive)

- **M1 — done.** Offline, reviewed, committed dog data for one shelter with a
  diff-before-write import path. PRs #6, #13, #14.
- **M2 — done 2026-08-24 (PR #21).** `applications/{id}` writes and the
  `applications`/`shelters` rules, in `shelter-integration.md`'s shape. Its two
  deferred halves became RS-2 (shipped, PR #34) and RS-6 (open).
- **M3 — shelter accounts and the admin add/edit surface. In progress.** Staff
  sign in with the existing Google auth, uids added to `staffUids` by hand, see
  their own shelter's applications, and add or retire their own dogs. Manual
  entry becomes the second source adapter — proving the pipeline works for a
  shelter that isn't SF SPCA, with zero scraping risk. RS-2 shipped the gate and
  RS-5 the inbox; RS-6 is the remaining third. Build from the queue items, not
  from this paragraph.
- **M4 — decided 2026-08-26; queued as RS-4.** Yes to a cadence, no to Cloud
  Scheduler (a `schedule:` trigger on the workflow that already holds the
  credential), plan-only permanently, weekly, and the scheduled path **must**
  `--rescrape` — a cached replay diffs the committed data against itself and
  reports "no drift" forever. The deliverable is the notification, not the
  schedule. Full reasoning and the known constraints are in the archive and
  restated where they matter in RS-4.
- **M5 — a second automated source (RescueGroups.org), gated on demonstrated
  need.** Don't build it until M3 has one real shelter using the admin surface;
  a second automated source before the manual path is proven just adds a second
  thing that can drift.

## Settled design, all three shipped — compressed 2026-09-04

Three design sections used to sit here in full: **RS-6**'s photo source (a pasted URL into
`photo_urls`, no uploads, and `dogPhotoOrNull()` keyed off `source` so the placedog fallback
never fires for a hand-entered dog), **RS-10**'s checklist join (one writer per field — shelter
items on `applications/{id}.checklist`, foster items on `fosters/{uid}`, each view composing
both, never mirroring), and **RS-11**'s round trip plus the precedence that resolves it
(`declined` > `withdrawn` > `approved` > checklist-derived; `approved` replaces the badge but
never unlocks pickup; an absent application must never render as a decline). All three are now
descriptions of shipped code, so per the README's 2026-09-02 rule they are the longer of two
tellings and the ledger rows are the shorter. Full text, verbatim, in the
[2026-09-04 archive](archive/real-data-and-shelters-2026-09-04.md); RS-10's original spec and
its rejected alternatives remain in the
[RS-10 archive](archive/real-data-and-shelters-rs10-2026-09-02.md).

## Settled — "notify the shelter" means the dashboard (2026-09-04, shipped 2026-09-05)

PH-1 had said since 2026-08-24 that a real notification path was *downstream of M3*; M3
finished while nobody re-read that sentence. The answer, once someone did: **the
notification is a surface, not a message.** Not email and not Arcade — wiring either would
mean choosing an address for an organization Pawthway has no relationship with, which is
the conversation this doc keeps saying is Sharang's to have. A shelter that signs in to
`/shelter` has already told us where it reads. So the dog comes back **on the shelter's own
roster, with the agent's profile rendered in full**, `ready_for_adoption` is an arrival that
sits above `available` rather than a resting state, and the offered action is **List for
adoption** / **Mark adopted** rather than the untruthful `retire`. `notified_shelter` is
then true because a write landed somewhere a shelter demonstrably reads (RS-5b), not
because a capability exists. Shipped as RS-12 (PR #63), which discharges PH-1. Full text of
the specification, verbatim, in the
[2026-09-05 design archive](archive/real-data-and-shelters-2026-09-05.md); what the build
found that the spec hadn't is RS-12's ledger row.

## Task queue

RS-2's original scope — "shelter sign-in, application list, and add/retire a
dog" — was one queue item covering three surfaces, which cannot land as one
atomic PR without leaving the repo half-working. **Split 2026-08-26 into
RS-2 / RS-5 / RS-6, in that order**, with the design questions it left open
answered below rather than left to whoever picked it up. (RS-4 was already
taken by the M4 drift check, which is unrelated and independent of these.)

### Decisions that apply to all three (Sharang, 2026-08-26)

- **Both sides are device-agnostic.** The shelter side is desk-shaped work, built
  responsive and **outside** the 430px `.phone` frame — while staying usable on a
  phone, because a staff member approving one application from their pocket is a
  real case. The foster side is DC-5 in `design-consistency.md`, separately.
- **Staff-ness is resolved by query, never a document read.** Shipped that way in
  RS-2; the derivation is in the
  [2026-08-29 archive](archive/real-data-and-shelters-2026-08-29.md). Don't
  re-derive it, and don't "fix" it by loosening `firestore.rules`.

### The items

- **RS-6 — shipped 2026-09-01 (PR #54); Ledger row is the full account.** **M3's third surface
  is built**, so the milestone's remaining work is the two round trips between the sides —
  RS-10 (checklist) and RS-11 (status) — not another screen.

- **RS-10 `[large]` — shipped 2026-09-02 (PR #56); Ledger row is the full account.** The design
  section above is the compressed decision; the spec and queue item are archived verbatim in
  [`archive/real-data-and-shelters-rs10-2026-09-02.md`](archive/real-data-and-shelters-rs10-2026-09-02.md).
  It ungates RS-11, which now sits at the top of this queue.

- **RS-11 `[large]` — shipped 2026-09-03 (PRs #58, #59); Ledger rows are the full account.**
  The round trip is closed in both directions. The `[large]` slot it emptied is refilled by
  RS-12 below — the first time in four runs that re-reading the queue did *not* produce one
  (see the README's 2026-09-04 note).

- **RS-12 `[large]` — shipped 2026-09-05 (PR #63); the Ledger row is the full account.** Its
  spec was compressed to a pointer on 2026-09-05, the same run that backfilled this number.
  **PH-1 is discharged by this**, not by anything in `production-hardening.md`. One thing the
  spec hadn't named: `rosterAction` had to become plural, because a returned dog wants two
  moves and the singular signature couldn't say so. The signed-in half is RS-12b under
  "Needs a human".

- **This queue holds no `[large]` item, and that is a finding rather than a gap (2026-09-05;
  re-checked and unchanged 2026-09-06 and 2026-09-07).**
  The README asks for one at the top of the highest-priority doc at all times, and for four
  runs the answer was found by re-reading this queue rather than inventing. This run it was
  not, and re-reading the gated notes — the 2026-09-04 fallback — did not produce one either,
  because the gates that are still shut are shut on a person, not on code:
  - **M3 is finished.** Its three surfaces (RS-2, RS-5, RS-6) and both round trips (RS-10,
    RS-11) shipped, RS-5b proved a real staff account reads and writes the inbox, and RS-12
    closed the last claim the app was making falsely.
  - **M5 is gated on demonstrated need** — "don't build it until M3 has one real shelter using
    the admin surface" — and M3 has none, because the conversation below has not happened.
  - **RS-4 is small by construction**, and inflating a workflow trigger into a run would be
    dishonest about its size.
  - So the repo's `[large]` slot is **DC-5 in `design-consistency.md`**, the second-priority
    doc, for the first time since the 2026-08-31 re-rank. That is recorded in the README as a
    consequence of the ranking's premise expiring, not as a re-rank — this doc goes back to the
    top the moment a shelter says yes, and the honest reading is that the top doc has run out
    of buildable work before it has run out of *work*.
  - **2026-09-06 — DC-5 shipped and the same question was asked again with the same answer.**
    Both fallbacks were re-run against this doc rather than carried over: re-reading the queue
    found only RS-4, and re-reading the gated notes found no gate that had opened (RS-12b,
    RS-6b and RS-8 all still want a signed-in human; M5 still wants a shelter). So the
    `[large]` slot stays outside this doc for a second consecutive run — and it was found a
    **third** way, by measuring `web/src/` rather than by reading either the queue or the
    notes. That is DC-7 in `design-consistency.md`; the README records the new fallback.
  - **2026-09-07 — a third consecutive run, same answer, and the measurement itself was the
    thing that moved.** All three fallbacks were re-run against this doc rather than carried
    over: the queue still holds only RS-4, and no gate has opened (RS-12b, RS-6b and RS-8 all
    still want a signed-in human; M5 still wants a shelter; the conversation below still has no
    evidence behind it — `git log --all --since=2026-09-05` is six commits, every one this
    loop's own). The `[large]` slot stays in `design-consistency.md` for a third run as DC-8.
    Worth recording here rather than only there: DC-8 exists because re-measuring found
    **DC-7's own measurement was incomplete** — it missed the repo's largest stylesheet. That
    is a caution for this doc too, whose "Where this actually stands" section is a list of
    dated measurements of exactly the same kind.

- **RS-4 (2026-08-26) — the weekly drift check.** The M4 bullet above *is* the
  spec; the archive carries the full reasoning. Add a weekly `schedule:` trigger
  to `.github/workflows/import-dogs.yml` alongside the existing
  `workflow_dispatch`, leaving every manual input and default exactly as-is.
  - The scheduled path runs **plan-only with `--rescrape`** — the opposite of
    the manual rescrape default, and the one detail that decides whether this
    task is worth doing at all: a cached replay diffs the committed data against
    itself and reports "no drift" forever, which is worse than no check.
  - Inputs are empty on a `schedule` event, so build the arg list from
    `github.event_name` rather than relying on input defaults.
  - Quiet on an empty diff, loud otherwise. Prefer opening (or **updating** —
    don't spam a new one weekly) a GitHub issue with the diff body, which needs
    `issues: write` in the job's `permissions:` (currently `contents: read`);
    failing with `::error::` and the diff is an acceptable simpler fallback.
    Say which you chose in the ledger row.
  - Leave the existing `concurrency: import-dogs` group alone — it already stops
    a scheduled run overlapping a manual one. Add a comment noting that
    scheduled workflows only run from the default branch and are disabled after
    60 days of repo inactivity.
  - **Nothing here may write to Firestore.** Do not add a path where a scheduled
    run drops `--plan`.
  - Verify: `workflow_dispatch` it by hand first to confirm the file still
    parses and the manual path is unchanged, then echo the final `ARGS` in the
    run log and read back that the scheduled branch resolves to plan + rescrape.

All of these ship to test accounts only until Sharang has actually spoken to a
shelter, per the section below.

- **RS-7 (PR #38/#39) and RS-5 (PR #52) — shipped, and RS-5's one open question is now
  answered.** Whether the `||` read rule actually serves the staff list query was settled on
  2026-09-04 by seeding three fixtures and reading them signed in as staff: it does. See RS-5b
  under "Needs a human", which is DONE.

### Needs a human, not a queue item

- **RS-9 — DONE 2026-08-29, by Sharang, in-session.** The `applications`
  composite index is `READY`; RS-5 is unblocked. RS-7's deploy had failed
  `403` because the deploy service account could write documents but not create
  indexes, and Sharang granted `roles/datastore.indexAdmin` (invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md)). Full account, including why CI's
  `GCP_SA_KEY` cannot be read back out of GitHub by design, in the
  [2026-08-31 archive](archive/real-data-and-shelters-2026-08-31.md).

- **RS-5b — DONE 2026-09-04, with Sharang present. The `||` rule serves the staff list query.**
  Three `fixture-` rows seeded with `scripts/seed_test_applications.py`; **all three render** at
  `https://pawthway-hackathon.web.app/shelter` signed in as the uid in `shelters/sfspca-mission`,
  with no `permission-denied` — so the staff branch of `applications`'s read rule does serve
  `where("shelterId","==",id)` + `orderBy("createdAt","desc")` against the RS-7/RS-9 index. This
  was the question RS-5 shipped unable to answer, and it could not be answered against an empty
  collection, because Firestore evaluates a list rule per candidate document. Ticking a
  shelter-owned item and pressing **Mark approved** both wrote, so the staff *update* branch
  works too, and the `(deleted account)` fixture renders as an ordinary withdrawn row — the
  PH-15 redaction state the inbox was built for and had never been shown. The three fixtures
  are still in production; they have fixed ids, so re-running the seeder resets rather than
  duplicates. Full original wording of the item in the
  [2026-09-04 archive](archive/real-data-and-shelters-2026-09-04.md).

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

## The part that's a conversation, not a PR

Both evidence docs already say this, and it's worth repeating in the
operational doc precisely so a future run of `plan` doesn't queue around
it: the app names real organizations it has no relationship with. M3 makes
that concrete — a "shelter admin" surface with nobody from SF SPCA actually
signed up is decoration, not a feature. **Sharang needs to have the actual
conversation with SF SPCA (or whichever shelter goes first) before M3 ships
to anyone but the two of them testing it.** Nothing in this queue depends on
that conversation happening first — the surface can be built and verified
with a manually-added test uid — but nothing should be represented as live
to a real user until it has.

*(Status as of 2026-09-07: re-checked this run — `git log --all` and a grep across `docs/`
turn up no commit, no doc edit from Sharang and no note anywhere in the repo saying this has
happened — `git log --all --since=2026-09-05` is six commits, every one of them this loop's
own. Re-checked, not carried over. Recorded so a future run doesn't mistake the passage of
time for progress. It is worth saying plainly now that M3 is finished: the shelter side is
complete enough that this is the only thing standing between it and a real user. **As of
2026-09-05 that has a second consequence** — it is also the only thing standing between this
doc and its next `[large]` item, per the queue note above. The loop cannot route around it,
and should stop looking for a way to.)*

## Ledger

*(Every row through RS-5b is compressed to one line. The full text — RS-6's account of the two
things its spec hadn't seen, RS-10's mirroring hazard, RS-11's required-argument signature
change, and RS-5b's fixture write — is preserved verbatim in the
[2026-09-05 ledger archive](archive/real-data-and-shelters-ledger-2026-09-05.md), which
supersedes the [2026-08-31](archive/real-data-and-shelters-ledger-2026-08-31.md) and
[2026-08-30](archive/real-data-and-shelters-ledger-2026-08-30.md) ones.)*

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed descriptions,
  diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules, plus
  `createApplication()` from both apply sites.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id corrected to `"sfspca-mission"`; `shelters.test.ts`
  added as the guard.
- 2026-08-28 — RS-2 — PR #34 — staff resolution by `array-contains` query, the `/shelter` route,
  first `shelters/{id}` document seeded. Verification partial on purpose — now RS-8, parked.
- 2026-08-29 — RS-7 — PRs #38, #39 — `firestore.indexes.json` actually deploys, in its own step
  after hosting and rules.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted; the
  `applications` index reached **`READY`**. Invocation in [`docs/runbook-gcp.md`](../runbook-gcp.md).
- 2026-08-31 — RS-5 — PR #52 — **the shelter's application inbox**, live at `/shelter`. Pure half
  in `web/src/lib/applicationView.ts`, 8 unit tests, no Firebase config needed. Shipped unable to
  verify its own read rule against an empty collection — that became RS-5b.
- 2026-09-01 — RS-6 `[large]` — PR #54 — **add and retire a dog** at `/shelter/dogs`. Split
  `match /dogs/{dogId}`'s blanket `allow write: if false` into create/update (both `isStaff`,
  `shelter_id` pinned) + `delete: if false`; **no new index**. Two things the spec hadn't seen and
  this fixed: the importer would have deleted every hand-entered dog, and `DogStatus` had no
  honest value for "retired".
- 2026-09-02 — RS-10 `[large]` — PR #56 — **the two approval checklists join by `owner`**, one
  writer per field. `composeApprovalChecklist()` overlays the shelter's `done` onto the foster
  document's list; MatchView keeps `stored` (writable) and `approval` (displayable) separate —
  **don't collapse them back**.
- 2026-09-03 — RS-11 `[large]` — PRs #58, #59 — **the round trip closes in both directions.**
  `approvalDecision()` + `approvalBadge()` under the `declined` > `withdrawn` > `approved` >
  checklist precedence; withdrawing writes `withdrawn` back, **no rules change**.
  `activeApplication()` became `(foster, status)` with the second argument **required**, so two
  call sites cannot disagree. 13 unit tests, plus six rendered cases in `MatchView.test.tsx`
  (`renderToStaticMarkup`, no jsdom, no new dependency).
- 2026-09-04 — RS-5b — no PR (a production fixture write + a signed-in check) — **the staff branch
  of `applications`'s read rule serves the list query.** Three fixtures seeded, all three render at
  `/shelter`, both staff write paths succeed. It could not be answered against an empty collection
  because Firestore evaluates a list rule per candidate document.
- 2026-09-05 — RS-12 `[large]` — PR #63 — **the dog comes back, and the shelter sees it — which
  is what "notify the shelter" now means.** `adoption_profile` had been written by the agent
  since the first Post Foster turn and read by **nothing** — the app's most expensive turn
  produced a paragraph that reached no human but the foster who watched it stream. It now lands
  in a **Back from foster** group at the *top* of `ShelterRosterView`, rendered in full with no
  clamp. `rosterAction` (singular) became **`rosterActions` (plural)**, because
  `ready_for_adoption` is the one status wanting two moves — the shape change the item implied
  and didn't name. **No rules change**, confirmed before writing one: both actions are
  status-only writes on a dog the shelter already owns. `notified_shelter` is now `True`
  *because the write landed on a surface RS-5b proved staff read*, with `notified_via:
  "shelter_roster"` and Arcade demoted to `arcade_messaging_available` — two claims, two fields.
  `server.py`'s system prompt moved with it. This discharges **PH-1**. Nothing signed-in was
  verified; that half is RS-12b. Full 35-line row verbatim in the
  [2026-09-06 ledger archive](archive/real-data-and-shelters-ledger-2026-09-06.md).
