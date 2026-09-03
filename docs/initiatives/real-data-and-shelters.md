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

**Archived 2026-08-29.** This doc was approaching the README's ~400-line
threshold, so the settled M1 / M2 / M4 narrative and the "where this stands"
section as they stood are preserved verbatim in
[`archive/real-data-and-shelters-2026-08-29.md`](archive/real-data-and-shelters-2026-08-29.md)
and compressed to one line each below. Read the archive for the reasoning
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
  (counted this run); the other five have zero dogs and no import path —
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
- **2026-09-02 — the `applications` round trip is one-way in both directions.**
  `setApplicationStatus()` has exactly one caller (the shelter inbox) and no foster surface reads
  `status`; `SavedView`'s withdraw never writes `withdrawn`. Read off the files this run — the
  finding and its decision are the design section below, the work is RS-11.
- **The `applications` collection still has zero documents.** RS-5 shipped the seed script
  (`scripts/seed_test_applications.py`, committed and dry-run verified) but could not run the
  real write — see RS-5b under "Needs a human".

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

## Settled 2026-08-31 — RS-10's spec: split the two approval checklists by `owner`

`applications/{id}.checklist` (written by staff, RS-5) and
`fosters/{uid}.approvalChecklist` (written by the foster and by the agent) are two
unjoined copies of the same list, so neither side can see the other's ticks. The
decision: **split by `ChecklistItem.owner`, one writer per field** — shelter-owned
items live on the application, foster-owned ones stay on the foster document, and
each view composes the displayed list out of both. Not a mirror (PH-16 pinned
`checklist` on the foster branch of the update rule precisely to stop that, and a
mirror is last-write-wins by construction) and not the full migration to the
application as sole source of truth — that is M2's deferred work and it touches every
guest/`LOCAL_MODE` path where no application document exists at all. The `owner` split
is the first half of that migration, not a detour around it. Full reasoning, the two
rejected alternatives and the three hazards it leaves for whoever builds it are in the
[2026-09-01 archive](archive/real-data-and-shelters-2026-09-01.md); the operative spec
is RS-10 in the queue below.

## Where a hand-entered dog's photo comes from — settled 2026-08-31, built 2026-09-01 (RS-6)

**The form takes a photo URL, written into the same `photo_urls` the scraper writes. No
uploads.** Firebase Storage is not in this stack, and every dog on the site is already a
hotlinked third-party image, so a pasted link introduces no practice the app isn't doing. The
consequence that mattered is built and unit-tested: `dogPhotoOrNull()` keys off `source`, so
**the placedog fallback never fires for a hand-entered dog** — a stock photo of some other
animal on a real adoptable record is indistinguishable from one the staff member believes they
supplied. Uploads, if ever wanted, are their own item (a `storage` block, rules scoped by
`isStaff`, a size cap, a deletion path), not a widening of RS-6. Full original reasoning in the
[2026-09-02 archive](archive/real-data-and-shelters-2026-09-02.md).

## Settled 2026-09-02 — the application document is written by both sides and read by only one each

RS-5 gave staff an inbox that can move an application to `approved` or `declined`, and RS-6 gave
them a roster. Reading both against `main` this run turned up something neither item claimed and
neither is a bug in: **`applications/{id}` is a two-owner record whose round trip is missing in
both directions.**

- **The shelter's decision never reaches the foster.** `setApplicationStatus()` has exactly one
  caller — `ShelterApplicationsView.tsx:260` — and `ApplicationStatus` is read on the shelter
  side only (`web/src/lib/applicationView.ts`). Grep the foster surfaces and the word `declined`
  does not appear. `MatchView.tsx:55` and `SavedView.tsx:158` both derive their status from
  `foster.approvalChecklist` alone, so a declined foster goes on seeing *"⏳ Waiting for
  approval"* and a pickup scheduler for a dog they will not get, indefinitely. That is the app
  telling a foster something untrue about a real animal — `production-hardening.md`'s framing,
  on `real-data-and-shelters.md`'s surface.
- **The foster's withdrawal never reaches the shelter.** `SavedView.tsx:163`'s `withdraw` clears
  `matchedDogId` and `phase` on the foster document and stops. It never writes
  `status: "withdrawn"` — so the row stays live in the shelter's inbox forever, and a staff
  member reviews an application nobody is waiting on. The rules branch built for exactly this
  (PH-16's deliberately-narrow foster branch, `firestore.rules:57-62`) has **one** caller today,
  and it is account deletion (`auth.ts:173`), not the withdraw button.

**Decision: this is one flow, and it is a separate item from RS-10, not a widening of it.** Both
halves need `useApplication.ts`, which RS-10 builds, so RS-11 is gated on RS-10 shipping rather
than merged into it. Merging them would produce a single PR touching the hook, both foster
views, the shelter inbox, the agent tool and the rules-adjacent withdraw path at once — the
shape that leaves the repo half-working if it stalls. Sequencing beats bundling here precisely
*because* both items are large.

Two things the build must not do, decided here so RS-11 doesn't re-open them:

- **`declined` is not a phase change.** Do not auto-clear `matchedDogId` or push the foster back
  to `discovery` on a decline. A person finding out they were turned down for a specific dog
  should read it as a sentence on the screen they were already on, and choose to move on
  themselves — silently teleporting them to the swipe feed is the app deciding how they feel
  about it. `activeApplication()`'s one-foster-at-a-time block (`web/src/lib/foster.ts`) is what
  needs to release, and it should release on the *declined status*, not on a mutation.
- **The withdraw write must be best-effort, and the local clear must not depend on it.** A guest
  or `LOCAL_MODE` foster has no `applications` row at all, and a signed-in one may have a write
  refused. `withdraw` clearing the foster document is the part the user asked for; the
  application update is the part the shelter needs. Fire the second, don't block the first on it.
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

- **RS-10 `[large]` (ungated 2026-08-31 — RS-5 shipped; marked large 2026-09-02) — join the
  two approval checklists by `owner`. A complete execute run.** It was already this size and
  merely unlabelled — a hook, both foster views composed from two sources, an agent tool
  constrained, and a four-case test — which is the same labelling gap RS-6 had (README,
  "The `[large]` slot"). It is the only `[large]` item in the top-priority doc. The design section above is the spec and the reasoning; this is the
  work. Today `applications/{id}.checklist` and `fosters/{uid}.approvalChecklist`
  are two unjoined copies, so RS-5's inbox and the foster's Match view cannot see
  each other's ticks. Split by `ChecklistItem.owner` — one writer per field —
  rather than mirroring or migrating.
  - Add `web/src/hooks/useApplication.ts`: `where("fosterId","==",uid)` +
    `where("dogId","==",matchedDogId)`. Two equalities, no `orderBy`, **no
    composite index needed** — do not add one to `firestore.indexes.json`.
  - `MatchView.tsx` composes its list: `owner: "foster"` entries from
    `foster.approvalChecklist`, `owner: "shelter"` entries from the application's
    `checklist`. Use `checklistOwner(id)` (`web/src/checklists.ts:13`) for records
    predating the field, same as it does today. Foster ticks keep going through
    `patchFoster()`; nothing here writes `applications`.
  - **The badge and the pickup gate are the payoff, and they are different
    gates** (`CLAUDE.md`, "Match: who owns which approval step"). "Shelter
    approved you as a foster" now tracks real shelter action; pickup still
    unlocks on the whole list. Don't collapse them.
  - **No application, no change.** Guests and `LOCAL_MODE` have no
    `applications` row, and `DemoShelterPanel` must keep working — fall back to
    the foster doc's shelter-owned entries exactly as today.
  - Constrain `update_checklist` in `src/agent/builtin/foster.py` to foster-owned
    ids in the same PR: it writes `approvalChecklist` wholesale and would
    otherwise tick a step the foster doc no longer owns.
  - `SavedView.tsx:157`'s Applications timeline reads the same field and must not
    disagree with Match — route it through the same composition, don't duplicate
    it.
  - Verify: `npm run build`/`test`/`lint` green; a unit test over the composition
    covering all four cases (no application, foster-only ticks, shelter-only
    ticks, both); in `LOCAL_MODE` the Demo Shelter panel still moves the badge.
    The signed-in two-party path needs a real shelter account and stays
    unverified — say so in the ledger row.

- **RS-11 (2026-09-02) — GATED on RS-10 shipping — close the application round trip in both
  directions.** The design section above is the reasoning and the two things this must not do;
  this is the work. Gated only because it reads through `web/src/hooks/useApplication.ts`, which
  RS-10 builds — check that file exists before starting, don't rebuild it.
  - **Foster sees the decision.** `MatchView.tsx` and `SavedView.tsx`'s `AppliedCard` read
    `application.status` alongside the composed checklist. `approved` and `declined` are the two
    that change what is on screen; `submitted`/`in_review` render as they do today. Put the
    status strings in `web/src/lib/applicationView.ts` — `STATUS_LABEL` is already there and is
    the shelter's copy of the same vocabulary; don't write a second one.
  - **A declined application replaces the checklist and the pickup scheduler**, on both surfaces,
    with a plain statement of what happened and one way forward (browse other dogs). Per the
    design section: **do not** clear `matchedDogId` or change `phase` — release
    `activeApplication()` (`web/src/lib/foster.ts`) on the declined status instead, so the foster
    can apply elsewhere without being moved anywhere they didn't ask to go. That function is the
    one-foster-at-a-time block and is read by both apply paths; changing it is the load-bearing
    edit in this item.
  - **Withdraw writes back.** `SavedView.tsx:163`'s `withdraw` also calls
    `setApplicationStatus(id, "withdrawn")`. Best-effort: `catch` and continue, and clear the
    foster document regardless — a guest/`LOCAL_MODE` foster has no application row at all.
    `firestore.rules:57-62`'s foster branch already permits exactly this write and nothing else
    (PH-16); **no rules change is needed or allowed here.**
  - **The inbox already handles `withdrawn`** (`staffTransitions()` returns nothing for it) —
    verify that, don't rebuild it.
  - Verify: `npm run build`/`test`/`lint` green; unit tests over the four statuses the foster
    side now renders, plus one asserting a declined application leaves `matchedDogId` intact
    while `activeApplication()` returns null; in `LOCAL_MODE` withdraw still works with no
    application document present. The two-party signed-in path needs a real shelter account —
    say so in the ledger row rather than implying it was exercised.

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

- **RS-7 (PR #38/#39) and RS-5 (PR #52) — shipped; see the Ledger.** RS-5's one open question
  (whether the `||` read rule actually serves the staff list query) is still open, because the
  fixture write was refused unattended and `applications` is still empty — RS-5b under "Needs a
  human". It gates nothing here.

### Needs a human, not a queue item

- **RS-9 — DONE 2026-08-29, by Sharang, in-session.** The `applications`
  composite index is `READY`; RS-5 is unblocked. RS-7's deploy had failed
  `403` because the deploy service account could write documents but not create
  indexes, and Sharang granted `roles/datastore.indexAdmin` (invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md)). Full account, including why CI's
  `GCP_SA_KEY` cannot be read back out of GitHub by design, in the
  [2026-08-31 archive](archive/real-data-and-shelters-2026-08-31.md).

- **RS-5b — NEEDS A HUMAN, 2026-08-31. Seed the fixtures and settle the `||`-rule question.**
  Two commands and one sign-in, and it retires the last open question under RS-5:
  `GOOGLE_CLOUD_PROJECT=pawthway-hackathon uv run python scripts/seed_test_applications.py`
  (committed, `--dry-run` first if you want to see the three rows), then open
  `https://pawthway-hackathon.web.app/shelter` signed in as the uid in
  `shelters/sfspca-mission`. Either the rows render — the staff branch of `applications`'s read
  rule serves the list query — or it comes back `permission-denied`, which the inbox now has
  its own copy for. **Write down which happened.** If it is denied, that is a finding to queue,
  **not** licence to widen `firestore.rules`. The unattended run could script this but not run
  it: writing to production Firestore is blocked for a session with nobody present to approve it.

- **RS-6b — NEEDS A HUMAN, 2026-09-01. Exercise the new `dogs` write rule once, signed in.**
  Do it in the same sitting as RS-5b and RS-8; it is the same sign-in. Open
  `https://pawthway-hackathon.web.app/shelter/dogs` as the uid in `shelters/sfspca-mission` and
  (1) add a dog with the photo field blank — it should appear in foster-side Discovery with the
  SF SPCA card and a paw tile, not a placedog photo; (2) retire it — it should leave Discovery
  and stay readable by id; (3) from the console, try `updateDoc` on that dog with a different
  `shelter_id` and confirm `permission-denied`. **Write down what happened.** A denial anywhere
  in (1) or (2) is a finding to queue, never licence to widen `firestore.rules`.

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

*(Status as of 2026-08-31: re-checked this run, still no evidence this
conversation has happened —
no commit, no doc edit from Sharang, no note anywhere in the repo. Re-checked,
not carried over. Recorded so a future run doesn't mistake the passage of time
for progress.)*

## Ledger

*(Every row through RS-5 is compressed to one line. Their full text — including RS-7's
in-place correction of its own verification claim, RS-2's account of why its verification
was only partial, and RS-5's long entry on the two things it could not verify — is preserved
verbatim across the [2026-09-01 archive](archive/real-data-and-shelters-2026-09-01.md) and
the [2026-08-31 ledger archive](archive/real-data-and-shelters-ledger-2026-08-31.md), which
supersedes the [2026-08-30 one](archive/real-data-and-shelters-ledger-2026-08-30.md).)*

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed descriptions,
  diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules in
  `shelter-integration.md`'s shape, plus `createApplication()` from both apply sites.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id corrected to `"sfspca-mission"`, two dead orgs
  removed, `shelters.test.ts` added as the guard.
- 2026-08-28 — RS-2 — PR #34 — Staff resolution by `array-contains` query, the `/shelter`
  route with its own `ShelterLayout`, first `shelters/{id}` document seeded. Verification
  partial on purpose — now RS-8, parked.
- 2026-08-29 — RS-7 — PR #38 — `firestore.indexes.json` now actually deploys, plus the
  `applications` composite index.
- 2026-08-29 — RS-7 (follow-up) — PR #39 — `firestore:indexes` split into its own step after
  hosting and rules, so a missing IAM grant stops taking the site down with it.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted to the
  deploy service account; the `applications` index reached **`READY`**. Invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md).
- 2026-08-31 — RS-5 — PR #52 — **The shelter's application inbox**, live at `/shelter`,
  replacing RS-2's placeholder. `useShelterApplications` runs one shelter's
  `where("shelterId","==",id)` + `orderBy("createdAt","desc")` against the RS-7/RS-9 index;
  the pure half is `web/src/lib/applicationView.ts`, unit tested in 8 cases without needing
  a Firebase config. Writes `applications/{id}` only — the checklist join is RS-10. **Two
  things honestly unverified:** the fixture write was refused by the unattended run's own
  safety classifier, so `applications` is still empty and the `||`-rule question the item
  was meant to settle by building is still open — see RS-5b.
- 2026-09-01 — RS-6 `[large]` — PR #54 — **Add and retire a dog**, at `/shelter/dogs`, behind the
  same staff gate as the inbox. `match /dogs/{dogId}`'s blanket `allow write: if false` became
  `create: isStaff(request.resource.data.shelter_id)` + `update: isStaff(resource.data.shelter_id)`
  with `shelter_id` pinned across the write + `delete: if false`. `useShelterDogs` is one equality
  and no `orderBy`, so **no new index**. Two things the spec hadn't seen, both fixed here because
  leaving either would have made the feature wrong rather than incomplete: **the importer would
  have deleted every hand-entered dog** (replace-not-append computes staleness as "not in this
  scrape", which a typed dog never is — it now keeps `source: shelter-manual` rows), and
  **`DogStatus` had no honest value for "retired"** (writing `adopted` would be a claim about a
  real animal nobody made, so `retired` was added to the union and to the agent's `STATUSES`).
  **Unverified, honestly:** every check needing a signed-in staff account — the form writing,
  retire removing a dog from Discovery, the rules refusing another shelter's `shelter_id` — could
  not be run unattended; the rules change was never exercised against the emulator or production.
  That is RS-6b. Full row in the
  [2026-09-02 archive](archive/real-data-and-shelters-2026-09-02.md).
