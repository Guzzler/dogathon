# Archive — real-data-and-shelters, 2026-09-01

Verbatim snapshot taken by `dogathon-plan` on 2026-09-01 of two settled blocks from
[`../real-data-and-shelters.md`](../real-data-and-shelters.md): the 2026-08-31 design
answer that specified RS-10 (the approval-checklist join), and the whole Ledger through
RS-5. Both are compressed to pointers in the working doc. Append-only: if something here
turns out to be wrong, correct the working doc and say so there.

RS-5's row is reproduced below with its `PR #__` placeholder backfilled to **#52**, which
is the only edit made to the copied text.

---

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


---

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
- 2026-08-31 — RS-5 — PR #52 — **The shelter's application inbox.** `/shelter` now renders it
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
