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

## Where this actually stands (re-verified against `main` 2026-08-31)

Each line below was checked by reading the file named in it this run, not
carried over from the previous wording.

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
- **`match /dogs/{dogId}` is still `allow write: if false`** — re-read at
  `firestore.rules:12-18` on 2026-08-31, the "Becomes isStaff(shelter_id) … (M3)"
  comment intact. That is RS-6's to change, nobody else's.
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

## The design question this run answered: after RS-5 ships, the shelter's ticks are invisible to the foster

**The approval checklist exists twice, and nothing joins the two copies.** Read
off `main` on 2026-08-31, not inferred:

- `web/src/lib/applications.ts:27` seeds `applications/{id}.checklist` from
  `DEFAULT_APPROVAL_CHECKLIST` at create time. RS-5 has staff tick the
  `owner: "shelter"` items on **that** copy.
- `web/src/phases/match/MatchView.tsx:48,60,64` reads and writes
  `fosters/{uid}.approvalChecklist` through `patchFoster()`. So does
  `SavedView.tsx:157` (the Applications timeline) and the agent's
  `update_checklist` (`src/agent/builtin/foster.py:42`).

Nothing syncs them, and RS-5's own instructions correctly say *"do not write
back to `fosters/{uid}`"*. So the day RS-5 ships, a staff member ticking "Home
environment check" changes nothing any foster can see — the badge, the timeline
and the pickup gate all keep reading the foster's private copy, which only
`DemoShelterPanel` (the deliberately-ugly demo widget) ever moves. The drift runs
both ways: the foster's own ticks never reach the application, so the inbox RS-5
builds will show every foster-owned step permanently unticked.

This is not a reason to delay RS-5. It is the item immediately after it, and
deciding it now stops RS-5 from being built in a shape that has to be undone.

**Decided: split by `owner`, one writer per field. Not a mirror, not the full
migration.** `ChecklistItem` already carries `owner: "foster" | "shelter"`
(`web/src/checklists.ts:5-8`), and that field is the seam:

- **Shelter-owned items live on `applications/{id}.checklist`** and are written
  only by staff. The foster's Match view *reads* them from there.
- **Foster-owned items stay on `fosters/{uid}.approvalChecklist`** and are
  written only by the foster. The shelter's inbox reads them from the
  application only once the foster side starts mirroring its own ticks — until
  then the inbox shows them as the shelter's copy has them, and should say the
  foster's steps are tracked foster-side rather than render four permanent
  blanks as if nothing had happened.
- **Displayed list = foster-owned from the foster doc + shelter-owned from the
  application.** Every field has exactly one writer, so there is no
  last-write-wins across two documents and no transaction to get right.

**Why not the two obvious alternatives.**

- *A two-way mirror* (both sides write both docs) is out on the rules alone:
  PH-16 just pinned `checklist` on the foster branch of `applications`'s update
  rule for exactly this reason, and unpinning it to enable a mirror would undo a
  hole that was closed six PRs ago. It is also last-write-wins by construction.
- *Making the application the sole source of truth* — which
  `firestore.rules:37-39`'s own comment calls the end state, with the foster's
  fields as "read-through convenience" — **is** right eventually, and is M2's
  deferred migration. It touches `MatchView`, `SavedView`, `foster.py`'s agent
  tool, and every guest/`LOCAL_MODE` path where no application document exists
  at all. That is a migration, not a follow-up, and doing it before one real
  shelter has ever used the inbox is building the general case for a caller that
  doesn't exist. The `owner` split is compatible with it: it is the first half.

**Three things this leaves for whoever builds it, all checked, none blocking.**

1. *Which application.* A foster can have several. The lookup is
   `where("fosterId","==",uid)` + `where("dogId","==",matchedDogId)` — two
   equality filters and no `orderBy`, which Firestore serves from its automatic
   single-field indexes. **No composite index, unlike RS-5.**
2. *The same `||`-rule hazard as RS-5, mirrored.* `applications`'s read rule
   (`firestore.rules:41-44`) is `fosterId == uid || isStaff(shelterId)`. This
   query pins the `fosterId` branch and leaves `isStaff` unprovable — the exact
   shape RS-5 is about to answer from the other side. Whatever RS-5 finds
   applies here, so this item genuinely is gated on it rather than nominally.
3. *The agent can still tick a shelter step.* `update_checklist` in
   `src/agent/builtin/foster.py` writes `approvalChecklist` wholesale and knows
   nothing about `owner`. Under this split that is a write to a field the foster
   doc no longer owns. Constrain it to foster-owned ids in the same PR.

*(The section this replaces — RS-5's composite-index hazard, in two parts — is
discharged: RS-7 put `firestore:indexes` in the deploy target and RS-9 got the
index to `READY`. Both are in the Ledger. What was live in it and stays live is
hazard (3) below, restated as (2) above.)*

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

- **RS-7 — shipped 2026-08-29.** `firestore:indexes` is now in
  `deploy-frontend.yml`'s deploy target and the `applications` composite index
  (`shelterId` ASC, `createdAt` DESC) is in `firestore.indexes.json`. See the
  Ledger — including which half of the verification is still outstanding.

- **RS-5 — shipped 2026-08-31.** The shelter's application inbox is live at `/shelter`; the
  Ledger row is the full account, including the one thing it could not verify. **The `||`-rule
  question it was designed to answer by building is still open**, because the fixture write was
  refused by the unattended run's safety classifier and `applications` is therefore still
  empty — see "Needs a human" below. That does not gate RS-6 or RS-10: both were gated on RS-5
  shipping, and it shipped.

- **RS-6 (ungated 2026-08-31 — RS-5 shipped) — add and retire a dog.** The second source adapter
  from M3: manual entry proving the pipeline works for a shelter that isn't
  SF SPCA, with no scraping.
  - This is the item that changes `match /dogs/{dogId}`'s
    `allow write: if false` to `isStaff(request.resource.data.shelter_id)`,
    per the sketch already in `shelter-integration.md`. That is a
    **deliberate, scoped** relaxation of a rule that exists for a reason — it
    is not licence to widen anything else. The read rule, the agent's
    Admin-SDK path, and every other rule stay exactly as they are.
  - "Retire" is a status change, **not** a delete — a dog someone is
    mid-application on must not vanish out from under them.
  - Form fields mirror what `scripts/shelters/sfspca.py`'s `to_dog()` already
    produces, so a hand-entered dog and a scraped one are the same shape
    downstream. `shelter_id` comes from the staff member's own shelter, never
    typed.
  - Verify: a dog added through the form appears in foster-side discovery
    with the right shelter card; retiring it removes it from discovery
    without breaking an existing application; staff at one shelter cannot
    write a dog carrying another shelter's `shelter_id` — the rules should
    reject that, so test it rather than assuming.
- **RS-10 (ungated 2026-08-31 — RS-5 shipped) — join the two approval checklists by
  `owner`.** The design section above is the spec and the reasoning; this is the
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

*(Rows through RS-9 are compressed to one line each. The full text of every one of them --
including RS-7's in-place correction of its own verification claim, and RS-2's account of why
its verification was only partial -- is preserved verbatim in the
[2026-08-31 ledger archive](archive/real-data-and-shelters-ledger-2026-08-31.md), which
supersedes the [2026-08-30 one](archive/real-data-and-shelters-ledger-2026-08-30.md) it
already contained.)*

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed descriptions,
  diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules in
  `shelter-integration.md`'s shape, plus `createApplication()` from both apply sites. Left
  `fosters/{uid}`'s read-through fields alone; seeded no shelter document.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id corrected to `"sfspca-mission"`, two dead orgs
  removed, `shelters.test.ts` added as the guard. Corrected a stale claim: the mismatch
  mattered for `isStaff()`, never for browsing.
- 2026-08-28 — RS-2 — PR #34 — Staff resolution by `array-contains` query, the `/shelter`
  route as a sibling of the foster layout with its own `ShelterLayout`, and the first
  `shelters/{id}` document seeded via `scripts/seed_shelter_staff.py`. **Verification partial
  on purpose** — the `staff`/`notStaff` states need a real popup sign-in; now RS-8.
- 2026-08-29 — RS-7 — PR #38 — `firestore.indexes.json` now actually deploys, plus the
  `applications` composite index. This row's original verification sentence was wrong and is
  corrected in place in the archive.
- 2026-08-29 — RS-7 (follow-up) — PR #39 — `firestore:indexes` split into its own step after
  hosting and rules, deliberately not `continue-on-error`, so a missing IAM grant stops taking
  the site down with it.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted to the
  deploy service account; the `applications` index reached **`READY`**, confirmed by reading
  the index's real state rather than a deploy's exit code. Invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md).
- 2026-08-31 — RS-5 — PR #__ — **The shelter's application inbox.** `/shelter` now renders it
  instead of RS-2's "coming soon" placeholder (`ShelterHomeView.tsx` is deleted, not orphaned).
  `useShelterApplications` runs `where("shelterId","==",id)` + `orderBy("createdAt","desc")` —
  exactly the composite index RS-7/RS-9 got to `READY` — one shelter at a time rather than an
  `in` over all of them, because a single equality is the shape the rules engine can prove
  safe for a list; staff at several shelters get a switcher. All four required states are
  built, and the error state splits `failed-precondition` (an index still building, retry
  helps) from `permission-denied` (retry never helps) with different copy, per the item.
  Master/detail, side by side from 900px and stacked below it, tokens only.
  - **The pure half is `web/src/lib/applicationView.ts`** — labels, transitions, age, the
    owner split, the error copy — deliberately importing no Firebase, so all of it is unit
    tested (`applicationView.test.ts`, 8 cases) without a project config.
  - `staffTransitions()` never offers `withdrawn`, and offers nothing at all on a withdrawn
    row: that status is the foster's alone under the foster branch of the update rule, so a
    button for it would only fail the write. A `"(deleted account)"` row (PH-15) renders as
    itself rather than being special-cased away.
  - Writes `applications/{id}` only. `fosters/{uid}.approvalChecklist` is untouched, so the
    foster's own steps show read-only with a line saying they're tracked foster-side — the
    join is RS-10, and this screen is built in the shape that item expects.
  - **Two things are honestly unverified, and neither was skipped by choice.**
    `scripts/seed_test_applications.py` is committed and `--dry-run` verified, but the real
    write was refused by the unattended run's own safety classifier, so the `applications`
    collection is still empty. That means **the `||`-rule question this item was supposed to
    answer by building is still open** — the query has never run against a document. It now
    needs only a human with credentials: run the seed script, open `/shelter` signed in as the
    uid in `shelters/sfspca-mission`, and record whether rows render or the query comes back
    `permission-denied`. Do **not** widen `firestore.rules` to make it pass.
    Verified: `npm run build`, `npm test` (45 passing), `npm run lint` (no new warnings),
    `compileall` on the seed script.
