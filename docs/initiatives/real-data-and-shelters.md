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

## Where this actually stands (re-verified against `main` 2026-08-29)

- **The offline import pipeline is built, for one shelter, with a manual
  trigger on purpose.** `scripts/import_dogs.py` + `scripts/shelters/sfspca.py`
  + `data/enrichment.json` → `data/dogs.json`, reviewed and committed, never
  fetched at runtime; `--plan` diffs before writing and the real push replaces
  rather than appends (PR #13). `.github/workflows/import-dogs.yml` runs it via
  `workflow_dispatch` only — *"the roster should change when someone decides it
  should, not because a file moved."* Extend this pattern; don't replace it.
- **The roster is one shelter deep.** Every dog carries
  `shelter_id: "sfspca-mission"`. `web/src/lib/shelters.ts` lists six orgs; the
  other five (`acc`, `muttville`, `coppers`, `wonder`, `rocket`) have zero dogs
  and no import path — decorative until M3. The id `"sfspca-mission"` is
  canonical everywhere and guarded by `web/src/lib/shelters.test.ts`.
- **`shelters/sfspca-mission` now exists** in production Firestore with the repo
  owner's uid in `staffUids` (RS-2, PR #34), so `isStaff()` finally evaluates
  against a real document. `scripts/seed_shelter_staff.py` makes that write
  reproducible.
- **`match /dogs/{dogId}` is still `allow write: if false`** — re-read at
  `firestore.rules:12-18` on **2026-08-30**, the "Becomes isStaff(shelter_id) … (M3)"
  comment intact. That is RS-6's to change, nobody else's.
- **`applications`'s rules are about to be touched from the other side.** Reading
  `deleteAccount()` on 2026-08-30 turned up that the foster branch of
  `match /applications/{applicationId}`'s update rule
  (`firestore.rules:49-51`) pins no fields beyond the resulting status, so a
  withdraw write can also rewrite `checklist` — or `shelterId`, which is the field
  RS-5's inbox query filters on. PH-15 and PH-16 in
  [`production-hardening.md`](production-hardening.md) are the fix. RS-5 doesn't
  depend on them and shouldn't wait, but **whoever picks up RS-5 should read those
  two items first**: they are the other party editing this collection's rules, and
  the `withdrawn` + redacted-`fosterName` row PH-15 produces is a state RS-5's list
  has to render.
- **`firestore.indexes.json` deploys, and the `applications` composite index
  (`shelterId` ASC, `createdAt` DESC) exists** — RS-7 (PR #38, #39) wired the target,
  RS-9 supplied the IAM grant it needed, run 33243275175 deployed it green, and
  `gcloud firestore indexes composite list` reports it `READY`. RS-5's query has a
  serving index to run against.
- **RS-2's `staff` and `notStaff` states are still unverified live.** Named as a
  check for this run by RS-2's own ledger row; still outstanding, because both
  need a real Google popup sign-in that an unattended run cannot drive. Carried
  forward deliberately rather than quietly dropped — see RS-8.

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
  shelter that isn't SF SPCA, with zero scraping risk. RS-2 shipped the gate;
  RS-5 and RS-6 are the remaining two thirds. Build from the queue items, not
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

## The design question this run answered: RS-5's query has two ways to fail, and neither shows up before runtime

RS-5 wants the shelter's inbox — `where("shelterId", "==", <their id>)`,
**newest first**. That innocuous "newest first" is the whole problem, and
checking it turned up a repo-wide gap.

**(1) It needs a composite index, and this repo has never needed one before.**
One equality filter plus an `orderBy` on a *different* field
(`createdAt desc`) is precisely the shape Firestore cannot serve from its
automatic single-field indexes. It fails at runtime with `failed-precondition`
and a console link — not at build time, not in CI, not in any test. Every
Firestore query shipped so far has been a single equality with no ordering
(PH-6's export query, RS-2's `array-contains`), which is why nothing has hit
this yet.

**(2) `firestore.indexes.json` is wired up everywhere except the one place that
matters.** Verified 2026-08-29 by reading the file and the workflow, not by
assuming:

- `firebase.json` declares `"firestore": { "indexes": "firestore.indexes.json" }`.
- `firestore.indexes.json` is `{"indexes": [], "fieldOverrides": []}` and has
  been untouched since the initial commit (`git log` on that path returns
  exactly one commit, `7288418`).
- `.github/workflows/deploy-frontend.yml:10-11` **triggers** the deploy on
  changes to `firestore.rules` *and* `firestore.indexes.json` —
- …but the deploy command at `:69` is
  `firebase deploy --only hosting,firestore:rules`. **`firestore:indexes` is
  not in the target list.**

So a composite index committed to that file would be diffed, reviewed, merged,
and would trigger a deploy that silently does not deploy it. This is the same
shape of failure as DC-3's inert token guard: a mechanism that looks wired up,
reports success, and has never done its job — the difference being that nobody
has noticed here because no query has needed it yet. RS-5 is the first one that
will. That's RS-7 below, and it lands before RS-5.

*(This whole section retires to a Ledger line once RS-7 and RS-5 have shipped —
it is long because it is live, not because it is history. Working core is ~295
lines against the README's ~250 guidance; that is where the slack goes back.)*

**(3) A hazard for RS-5 to test, not a conclusion.** `applications`'s read rule
is an `||` —
`resource.data.fosterId == request.auth.uid || isStaff(resource.data.shelterId)`
(`firestore.rules:41-44`). Rules are not filters: a `list` query is allowed only
if the engine can *prove* it safe from the query's own constraints. The staff
branch pins `shelterId` via the `where` clause and should be provable (the same
reasoning that made RS-2's `array-contains` work with no rules change), but the
`fosterId` branch is unconstrained in this query, and an unprovable disjunct
inside an `||` is a classic way a "should be fine" query comes back
`permission-denied`. There is no emulator configured in `firebase.json`, so this
cannot be settled offline — **run the query for real before building the UI on
top of it, and do not widen `firestore.rules` if it fails.** If it fails, the fix
is a narrower rule shape or a differently-shaped query, and that is a decision to
write down here, not to paper over.

## Task queue

RS-2's original scope — "shelter sign-in, application list, and add/retire a
dog" — was one queue item covering three surfaces, which cannot land as one
atomic PR without leaving the repo half-working. **Split 2026-08-26 into
RS-2 / RS-5 / RS-6, in that order**, with the design questions it left open
answered below rather than left to whoever picked it up. (RS-4 was already
taken by the M4 drift check, which is unrelated and independent of these.)

### Decisions that apply to all three (Sharang, 2026-08-26)

- **Both sides are device-agnostic.** The shelter side is desk-shaped work, so
  it is built responsive and does **not** live inside the 430px `.phone` frame —
  while still being genuinely usable on a phone, because a staff member
  approving one application from their pocket is a real case. The foster side
  becoming responsive is a separate item (DC-5 in `design-consistency.md`).
- **Staff-ness is resolved by query, never by a document read.** Shipped that
  way in RS-2; the derivation (why `getDoc` collapses "not staff" and "no such
  shelter" into one indistinguishable `permission-denied`, and why
  `where("staffUids", "array-contains", uid)` needs no rules change) is in the
  archive. Don't re-derive it, and don't "fix" it by loosening
  `firestore.rules`.

### The items

- **RS-7 — shipped 2026-08-29.** `firestore:indexes` is now in
  `deploy-frontend.yml`'s deploy target and the `applications` composite index
  (`shelterId` ASC, `createdAt` DESC) is in `firestore.indexes.json`. See the
  Ledger — including which half of the verification is still outstanding.

- **RS-5 `[large]` — the shelter's application inbox. This item is a complete
  execute run.** Ungated since 2026-08-28 and unstarted ever since, because it
  kept losing every run to smaller, tidier items; the README's 2026-08-31
  re-rank exists to stop that. Take the whole run on it, span as many files as
  it needs, ship one coherent PR. The index hazard is discharged (RS-9): the
  `applications` composite index is `READY`. The shelter's inbox is
  `where("shelterId", "==", <their id>)`, newest first.

  **The blocking precondition is removed, and here is what replaces it.** This
  item used to say the `||`-rule list-query question had to be answered by
  running the query as the seeded staff uid *before any UI is written*. That
  gate held the item still for four days, and it was never clearable by this
  loop: the only sign-in is a Google popup. Worse, it wouldn't have worked
  anyway — the `applications` collection has **zero documents** (checked
  2026-08-31), and Firestore evaluates a `list` rule *per candidate document*, so
  the query would have come back clean while proving nothing. A test that passes
  because it never ran is the README's standing lesson, not a verification.

  So: **build the screen, and make the rules question answer itself as part of
  building it.**
  - **Seed fixtures first, in the same PR.** Add
    `scripts/seed_test_applications.py`, modelled on the committed
    `scripts/seed_shelter_staff.py`, writing 2–3 `applications` rows for
    `sfspca-mission` against real dog ids from `data/dogs.json` — varied
    `status`, a real `createdAt`, an obviously-fake `fosterName` such as
    `"Test Foster (fixture)"` so nobody mistakes one for a real person. Commit
    the script; it makes the write reproducible instead of a one-off curl.
  - **Then the query tells you the answer.** With rows present, the inbox either
    renders them or comes back `permission-denied` — which *is* the `||`-rule
    result, obtained by building rather than by ceremony. Write whichever
    happened into this doc. If it is denied, stop at that point, write down the
    options, and do **not** widen `firestore.rules` to make it pass.
  - Row: foster name (`fosterName` is denormalised onto the application for
    exactly this), dog name, `status`, age of the application. A `withdrawn` row
    whose name reads `"(deleted account)"` is a real state now (PH-15) — render
    it, don't special-case it away.
  - Detail: the `checklist`, with `owner: "shelter"` items tickable and the
    foster's own items read-only — `web/src/checklists.ts` already carries
    `owner`, so filter on it rather than re-listing ids. Status moves
    `submitted → in_review → approved | declined`. `withdrawn` is the foster's to
    set, not the shelter's (`firestore.rules:49-51`).
  - States, all four required: loading; **empty** ("No applications yet" — the
    expected state for a real shelter on day one, not an error); populated; error
    with retry. The error state must distinguish `failed-precondition` (an index
    still building — retry genuinely helps) from `permission-denied` (retry never
    helps); those are the two realistic failures and they want different copy.
  - Built responsive and outside the 430px `.phone` frame, per RS-2's
    `ShelterLayout` and the device-agnostic decision. Tokens only, no colour
    literals — the DC-6 guard is live and will fail the build.
  - Use the shelters already resolved by `useMyShelters` (RS-2's context) — don't
    re-run the `array-contains` query that already let this screen through the
    gate.
  - Do **not** write back to `fosters/{uid}`. The application document is the
    source of truth for status/checklist/pickup per `shelter-integration.md`; the
    foster's read-through fields are M2's deferred migration, not this item's job.
  - Verify what can be verified without a popup sign-in: `npm run build`, `test`,
    `lint` green; the screen renders its empty and error states; the seeded rows
    are present in Firestore. The signed-in staff path stays unverified until
    there is a human to drive it — say so plainly in the ledger row rather than
    implying more, and do not let that stop the item shipping.
- **RS-6 (gated on RS-5) — add and retire a dog.** The second source adapter
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

- **RS-9 — DONE 2026-08-29, by Sharang, in-session.** Kept here rather than
  deleted because the sequence is worth not re-deriving. RS-7's target ran and was
  refused: `403, The caller does not have permission` (run 33240631397) — the deploy
  service account had `roles/datastore.user`, which reads and writes documents but
  cannot create composite indexes. Sharang granted
  **`roles/datastore.indexAdmin`** to
  `github-deploy@pawthway-hackathon.iam.gserviceaccount.com` and asked for it to be
  applied in-session; the invocation is in the runbook note below. Re-ran
  `deploy-frontend.yml` (run 33243275175): the `Deploy Firestore indexes` step is
  green and logs *"deployed indexes in firestore.indexes.json successfully for
  (default) database"*. Then waited out the asynchronous build and confirmed the
  index actually **serves** — `gcloud firestore indexes composite list` went
  `CREATING` → `READY` for `shelterId, createdAt, __name__` on the `(default)`
  database. That last check is the one this initiative kept saying was outstanding;
  it is now done, and by reading the index's real state rather than a deploy's exit
  code. **RS-5 is unblocked.**

  For the record, since "pull the key from GitHub and do it" was the first idea:
  **a GitHub Actions secret cannot be read back.** `gh secret list` returns names
  only — that's GitHub's design, not a permissions problem — so there is no path
  where CI's `GCP_SA_KEY` gets pulled down to do a one-off admin action, and
  wanting one is a smell. Use a human's own `gcloud` credentials, which is what
  happened.

- **RS-8 — PARKED 2026-08-31, not pending. Confirm RS-2's `staff` and `notStaff`
  states on the deployed app.**
  Two of RS-2's three states have never been seen working, because both need a
  real Google popup sign-in. Not queued for execute, which cannot drive one.
  Parked rather than pending, per the README's "nobody uses this app yet" section:
  there are no shelter partners and no users, so this confirms behaviour nobody is
  currently blocked by. It gets cleared in one sitting alongside PH-13 and PH-15b
  when there is a real shelter — and RS-5 will likely have answered half of it by
  then, since building the inbox exercises the same gate. Do not re-queue it.
  When the time comes: sign in as the uid seeded in `shelters/sfspca-mission` and
  open `https://pawthway-hackathon.web.app/shelter` — expect the staff
  dashboard shell; then sign in with any other account and expect the "isn't on
  a shelter's staff list" copy. Two minutes, and RS-5 is being built on the
  assumption that it works. Record the result here when done.

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

*(Status as of 2026-08-29: still no evidence this conversation has happened —
no commit, no doc edit from Sharang, no note anywhere in the repo. Re-checked,
not carried over. Recorded so a future run doesn't mistake the passage of time
for progress.)*

## Ledger

*(Rows are compressed to one line each; each one's full text — including RS-7's
in-place correction of its own verification claim — is preserved verbatim in the
[ledger archive](archive/real-data-and-shelters-ledger-2026-08-30.md).)*

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed
  descriptions, diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules added
  to `firestore.rules` in `shelter-integration.md`'s shape, and
  `createApplication()` opening a document from both apply sites using the dog's own
  `shelter_id`. Deliberately left `fosters/{uid}`'s read-through fields alone —
  that migration is still open — and seeded no shelter documents, since a real staff
  uid was RS-2's to add.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id in `shelters.ts` corrected to
  `"sfspca-mission"` to match the scraper and the roster, `petsun` (a second campus
  of the same org) and `familydog` (closed) removed, `shelters.test.ts` added as the
  guard. Corrected a stale claim in this doc along the way: the id mismatch never
  broke browsing, because every real dog carries its own denormalized `shelter`
  object that `normalizeDog()` already prefers — it mattered for `isStaff()`, not
  for the reason originally written down.
- 2026-08-28 — RS-2 — PR #34 — Staff resolution, the `/shelter` route shell and the
  gate: `useStaffShelters` runs the `array-contains` query and returns a
  discriminated `loading | notStaff | error | staff`, a context hands the resolved
  shelters to the screens behind the gate, and `/shelter` is a **sibling** of the
  foster layout with its own `ShelterLayout` outside the 430px cap. Seeded the first
  `shelters/{id}` document through the Firestore REST API with a `gcloud` token
  (no local ADC), with `scripts/seed_shelter_staff.py` committed so the write is
  reproducible rather than a curl someone ran once. **Verification is partial and
  that is an open item, not a discharged disclaimer**: the `staff` and `notStaff`
  states have never been seen, because both need a real Google popup sign-in — now
  tracked as RS-8.
- 2026-08-29 — RS-7 — PR #38 — `firestore.indexes.json` now actually deploys
  (`--only ...,firestore:indexes`), plus the `applications` composite index RS-5
  needs. An index committed to that file had previously been diffed, reviewed,
  merged and deployed by a run that silently did not deploy it. **This row's
  original verification sentence was wrong and is corrected in place in the
  archive** — it claimed a deploy log that had not run yet; what the log actually
  said was `403, The caller does not have permission`.
- 2026-08-29 — RS-7 (follow-up) — PR #39 — Split `firestore:indexes` into its own
  step **after** hosting and rules, so a missing IAM grant stops taking the site's
  deploy down with it. Deliberately not `continue-on-error` and deliberately not
  dropping the target: the step stayed red on every deploy until RS-9 landed, which
  was the point.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted
  to the deploy service account at Sharang's in-session instruction; the redeploy
  went green and the `applications` index reached **`READY`**, confirmed by reading
  the index's real state rather than a deploy's exit code. The invocation is in
  [`docs/runbook-gcp.md`](../runbook-gcp.md). Note for anyone tempted by the
  shortcut that started this: CI's `GCP_SA_KEY` **cannot** be read back out of
  GitHub, by design.
