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
- **2026-09-02 — the checklist halves are joined; the status round trip is not.** RS-10 shipped
  `composeApprovalChecklist()` and `useApplication.ts`, so the shelter's ticks on
  `applications/{id}.checklist` now reach the foster's Match view and Saved timeline. The
  application's **`status`** still goes nowhere on the foster side and `withdrawn` is still never
  written by the withdraw button — that is RS-11, now ungated and the only `[large]` item here.
- **2026-09-03 — the round trip is closed; the design section below is now a description of
  shipped code.** RS-11 landed `approvalDecision()` / `releasesFoster()` / `approvalBadge()` and
  threaded the application's status into `activeApplication()`. What is *not* closed is that no
  human has ever driven it end to end, because there is still no `applications` row (RS-5b).
- **2026-09-03 — three signals now mean "approved", and RS-11 has to rank them.** Confirmed off
  `MatchView.tsx:62-65` and `SavedView.tsx:161-164`: `shelterApproved` (shelter-owned items done)
  drives the badge, `approved` (all items, both owners) drives the pickup scheduler and both
  timelines, and `application.status` is read on the foster side nowhere at all. The precedence is
  the design section below; the work stays RS-11.
- **2026-09-04 — `applications` is no longer empty, and the read rule is proven.** Three
  `fixture-` rows written with Sharang present; the inbox renders them signed in as staff, and
  both staff writes (a checklist tick, `Mark approved`) succeed. RS-5b is discharged; the
  README's "zero documents in the `applications` collection" line is now stale.

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

## Settled 2026-08-31, built 2026-09-02 — RS-10: the two approval checklists join by `owner`

**One writer per field.** Shelter-owned items live on `applications/{id}.checklist`, foster-owned
ones stay on `fosters/{uid}.approvalChecklist`, and each view composes the displayed list out of
both — not a mirror (PH-16 pinned `checklist` on the foster branch precisely to stop that, and a
mirror is last-write-wins by construction) and not the full migration to the application as sole
source of truth, which is M2's deferred work. The `owner` split is that migration's first half.
Shipped as `composeApprovalChecklist()`; the full original spec, its two rejected alternatives
and its three hazards are in the
[RS-10 archive](archive/real-data-and-shelters-rs10-2026-09-02.md).

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

`applications/{id}` is a two-owner record whose round trip is missing in both directions:
`setApplicationStatus()` has exactly one caller (the shelter inbox, `ShelterApplicationsView.tsx:260`
— re-verified 2026-09-03) and no foster surface reads `status`, so a declined foster goes on seeing
*"⏳ Waiting for approval"* indefinitely; and `SavedView`'s `withdraw` clears the foster document
without ever writing `status: "withdrawn"`, so the row stays live in the inbox forever. **This is one
flow and it is RS-11**, gated behind RS-10 rather than merged into it, because both halves need
`useApplication.ts` and bundling them produces the single PR that leaves the repo half-working if it
stalls. Two rules the build must not reopen — `declined` is not a phase change (release
`activeApplication()`, don't move anyone), and the withdraw write is best-effort and must not block
the local clear — are restated in full in RS-11's queue item, which is why the reasoning behind them
now lives in the [2026-09-03 archive](archive/real-data-and-shelters-2026-09-03.md).

## Settled 2026-09-03 — three things now mean "approved", and only one of them is the decision

RS-11 will trip over this on its first screen, so it is answered here rather than left to whoever
builds it. Read off `MatchView.tsx:62-65` and `SavedView.tsx:161-164` this run, the foster side is
about to have **three** independent signals called approval:

1. `shelterApproved` — every *shelter-owned* checklist item done. Drives the Match badge.
2. `approved` — every item, both owners, done. Drives the pickup scheduler and `activeIdx` on both
   timelines.
3. `application.status === "approved"` — a staff member clicked Approve in the inbox. Read nowhere
   on the foster side today.

They are not three views of one fact. **The checklist answers "is the paperwork finished"; `status`
answers "did the shelter say yes."** A shelter can decide before the boxes are ticked, and the boxes
can be ticked by a foster whose application was never accepted. So:

- **`declined` overrides everything**, at any checklist state. The case that makes this
  non-negotiable already renders wrong today: a fully-ticked checklist on a declined application
  shows *"✓ Approved — schedule pickup"*, which is the app inviting someone to book a pickup for a
  dog they were refused.
- **`approved` does not unlock pickup and does not tick anyone's boxes.** Scheduling stays gated on
  the full composed checklist. Approving early means the decision is made and the paperwork isn't;
  a scheduler at that moment books a slot for a home visit that hasn't happened.
- **`approved` does replace the badge**, because the badge is the outcome and the outcome is now
  known. `shelterApproved` stays the badge's source only while `status` is undecided.
- **Precedence is `declined` > `withdrawn` > `approved` > checklist-derived**, and **no application
  document falls all the way through to today's behaviour.** A guest, a `LOCAL_MODE` foster and
  every pre-RS-5 record have no row at all; absence must never render as a decline.
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

- **RS-11 `[large]` — shipped 2026-09-03 (PR #__); Ledger row is the full account.** The
  round trip is closed in both directions: the foster reads `application.status` through the
  precedence the design section above settles, and withdrawing writes `withdrawn` back.
  **This doc now has no open `[large]` item** — see the README's `[large]` slot rule before
  inventing one; RS-4 is the only thing left in this queue.

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

- **RS-5b — DONE 2026-09-04, with Sharang present. The `||` rule serves the staff list query.**
  Sharang ran `gcloud auth application-default login` and signed in to the deployed app; the
  session then wrote the three fixtures with `scripts/seed_test_applications.py` and opened
  `https://pawthway-hackathon.web.app/shelter` as the uid in `shelters/sfspca-mission`.
  **All three rows rendered** — no `permission-denied` — so the staff branch of `applications`'s
  read rule does serve `where("shelterId","==",id)` + `orderBy("createdAt","desc")` against the
  RS-7/RS-9 index. The `(deleted account)` fixture renders as an ordinary withdrawn row, which
  is the PH-15 redaction state the inbox was built to handle and had never actually been shown.
  Ticking a shelter-owned item and pressing **Mark approved** both wrote successfully, so the
  staff *update* branch works too. `applications` now holds three `fixture-`-prefixed documents
  in production; they have fixed ids, so re-running the seeder resets them rather than
  duplicating, and nothing but a manual delete removes them.
  *The old text of this item, for reference:*

- **RS-5b (original) — Seed the fixtures and settle the `||`-rule question.**
  Two commands and one sign-in, and it retires the last open question under RS-5:
  `GOOGLE_CLOUD_PROJECT=pawthway-hackathon uv run python scripts/seed_test_applications.py`
  (committed, `--dry-run` first if you want to see the three rows), then open
  `https://pawthway-hackathon.web.app/shelter` signed in as the uid in
  `shelters/sfspca-mission`. Either the rows render — the staff branch of `applications`'s read
  rule serves the list query — or it comes back `permission-denied`, which the inbox now has
  its own copy for. **Write down which happened.** If it is denied, that is a finding to queue,
  **not** licence to widen `firestore.rules`. The unattended run could script this but not run
  it: writing to production Firestore is blocked for a session with nobody present to approve it.

- **RS-6b — PARTIALLY DONE 2026-09-04; the write half is still open.** In the same signed-in
  sitting as RS-5b: `/shelter/dogs` loaded and listed all **19** SF SPCA dogs for the staff
  account, and the add-a-dog form renders and accepts input — so the staff *read* path over
  `dogs` works. **Not exercised, and still needing a human:** actually submitting the form
  (a real write to the live `dogs` collection that fosters would see in Discovery), retiring a
  dog, and the console `updateDoc` test that a different `shelter_id` is refused. The session
  deliberately filled the form and stopped rather than write a real animal into the production
  roster without being asked to. The three checks below are what remains.

- **RS-6b (remaining) — the `dogs` write rule, signed in.**
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
- 2026-09-02 — RS-10 `[large]` — PR #56 — **The two approval checklists join by `owner`**, one writer
  per field. `composeApprovalChecklist()` overlays the shelter's `done` from
  `applications/{id}.checklist` onto the foster document's list; `useApplication.ts` fetches it with
  two equalities, **no new index**. The hazard it had to solve concretely: MatchView wrote its
  toggles from the array it rendered, which after composition would have mirrored the shelter's ticks
  into `fosters/{uid}` — it now keeps `stored` (writable) and `approval` (displayable) separate, so
  **don't collapse them back**. Two judgement calls beyond the spec: a shelter-owned item absent from
  the foster document is **appended** rather than dropped, and `DemoShelterPanel` now renders only
  when there is no application. **Unverified, honestly:** the two-party signed-in path needs a real
  shelter account and a real `applications` row, and neither exists (RS-5b). Full row in the
  [2026-09-03 archive](archive/real-data-and-shelters-2026-09-03.md).
- 2026-09-03 — RS-11 `[large]` — PR #__ — **The application round trip closes in both directions.**
  The foster now reads `application.status`: `approvalDecision()` collapses five statuses to the
  three that are news plus `null`, and `approvalBadge()` layers that over each surface's own
  checklist-derived badge (Match tracks shelter-owned steps, Saved tracks the whole list — they
  keep disagreeing on purpose, and the decision wins on both). A declined application replaces the
  checklist and the scheduler on both surfaces with what happened and one way forward. Withdrawing
  from `SavedView` now calls `setApplicationStatus(id, "withdrawn")` before the local clear,
  best-effort inside a `catch` — **no rules change**; PH-16's foster branch already permitted
  exactly that field.
  **The load-bearing edit was the signature**, as the queue item predicted: `activeApplication()`
  is now `(foster, status)` with the second argument **required**, not optional. An optional one
  would have let `DogDetailView` and `SavedView` disagree about whether a declined foster is still
  blocked, which is the one bug this item exists to prevent — so both call sites gained a
  `useApplication(foster?.matchedDogId)` keyed to the *matched* dog rather than the dog on screen.
  Two things the spec didn't specify, decided here: `withdrawn` releases the block as well as
  `declined` (an application the foster ended is no more live than one the shelter ended), and a
  declined foster gets **no** button that clears `matchedDogId` — applying elsewhere overwrites it,
  and the design section forbids moving them, so "Browse other dogs" just navigates.
  13 new unit tests over the four statuses, absence, and the declined-with-matchedDogId-intact case.
  **Unverified, honestly:** exactly what RS-10's row said, for the same reason — the two-party
  signed-in path needs a real shelter account and a real `applications` row, and neither exists
  (RS-5b). Nothing here was exercised against a live document; the pure layer and the call-site
  wiring are what the tests cover.
- 2026-09-03 — RS-11 (follow-up) — PR #__ — **The two RS-11 screens a walkthrough can't reach are
  now rendered in a test.** Driving the app end to end (guest → onboarding → apply → shelter ticks →
  pickup → Care Plan, in `LOCAL_MODE` against the committed roster) exercises exactly **one** of the
  four statuses — absence — because `status` only ever arrives from Firestore and a guest journey has
  no application document. It did confirm two things off the queue item: absence renders as
  "⏳ Waiting on shelter review" rather than a decline, and withdraw still works with no application
  row (`matchedDogId` cleared, no console error). `MatchView.test.tsx` covers the rest with
  `renderToStaticMarkup` and three mocked hooks — **no jsdom, no new dependency**, following
  `lib/markdown.test.tsx`. Six cases; the two that matter are a declined application removing the
  scheduler and the Care Plan hand-off, and an `approved` status leaving `🔒 Schedule pickup` locked.
  **Both were negative-controlled** — neutering `approvalDecision`'s declined branch fails exactly
  the two declined cases, and letting `approved` unlock the scheduler fails exactly that one — so
  they are not passing vacuously. Still unverified: the two-party signed-in path (RS-5b).
- 2026-09-04 — RS-5b — no PR (a production fixture write + a signed-in check) — **The staff
  branch of `applications`'s read rule serves the list query.** Three fixtures seeded, all three
  render at `/shelter`, and both staff write paths succeed. This was the question RS-5 shipped
  without being able to answer, and it could not be answered against an empty collection because
  Firestore evaluates a list rule per candidate document.

