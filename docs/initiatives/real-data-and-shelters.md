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

## Where this actually stands (re-verified against `main` 2026-09-01)

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

## The design question this run answered: where a hand-entered dog's photo comes from

RS-6 lets a staff member add a dog by hand, and its spec says the form should mirror
what `scripts/shelters/sfspca.py`'s `to_dog()` produces, so that a typed dog and a
scraped one are the same shape downstream. That holds for every field except one, and
it was unanswered: **there is nowhere for a photo to go.** Read off `main` this run,
not inferred:

- `Dog` carries `photo_urls?: string[]` — "real photos from the source"
  (`web/src/types.ts:89`) — and every row in `data/dogs.json` holds an external CDN
  link (`g.petango.com/…`), hotlinked, never copied.
- `dogPhoto()` (`web/src/lib/dog.ts:85`) falls back to
  `https://placedog.net/800/1000?id=<n>` when `photo_urls` is empty.
- **Firebase Storage is not in this stack.** `storageBucket` is passed through in
  `web/src/firebase.ts:9` only because it arrives in the config blob; nothing calls
  `getStorage`, `firebase.json` has no `storage` block, and there are no storage rules
  to deploy. Adding uploads is not a form field — it is a new SDK surface, a new rules
  file, a new deploy target, and a new class of thing staff can put into the project.

**Decided: the form takes a photo URL — the same field the scraper already writes. No
uploads in RS-6.** A hand-entered dog and a scraped one are then genuinely identical
downstream, which is the entire point of RS-6 as "the second source adapter". It costs
nothing to build and nothing to run, and it introduces no practice the app isn't
already doing: every dog on the site today is a hotlinked third-party image.

Two consequences, both accepted on purpose:

- A pasted URL can rot, and loading it leaks the viewer's IP to whoever serves it.
  Both are already true of all 19 committed dogs. Validate the shape (`https`, and an
  `<img>` that fails falls back to the no-photo state rather than a broken-image
  icon); don't try to solve permanence.
- **The placedog fallback must not fire for a hand-entered dog.** A stock photo of
  some other animal on a real adoptable dog is exactly the "unknown is not a claim"
  failure `CLAUDE.md` describes, and it is worse on a shelter-entered record than on a
  seeded one, because the staff member who typed it will reasonably read a photo
  appearing as "mine uploaded". RS-6 ships a real empty state — a neutral,
  obviously-not-a-photograph tile — for a dog with no `photo_urls`, and leaves the
  placedog path exactly where it is for the seeded roster.

**If uploads are wanted later, that is its own item and not a widening of RS-6.** It
needs a `storage` block in `firebase.json`, rules scoped by `isStaff`, a size and
content-type cap, and a deletion path for when a dog is retired. None of that belongs
in the PR that first lets a shelter add a dog.

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

- **RS-6 `[large]` (ungated 2026-08-31 — RS-5 shipped; marked large 2026-09-01) — add
  and retire a dog. A complete execute run.** The second source adapter
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
  - **Photos: a URL field, not an upload.** The design section above is the reasoning —
    Storage isn't in this stack, and the scraper's own `photo_urls` is already a list of
    external links. Write the entered URL into `photo_urls` so a typed dog is the same
    shape as a scraped one, and render a neutral empty tile — never the placedog
    fallback — when it is blank.
  - Verify: a dog added through the form appears in foster-side discovery
    with the right shelter card; retiring it removes it from discovery
    without breaking an existing application; staff at one shelter cannot
    write a dog carrying another shelter's `shelter_id` — the rules should
    reject that, so test it rather than assuming. A dog saved with the photo
    field left blank must render the empty tile, not a placedog stand-in.

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
