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

## Where this actually stands (verified against `main`, not the evidence docs' dates)

- **The low/no-cost update mechanism is already built, for one shelter.**
  `scripts/import_dogs.py` scrapes SF SPCA (`scripts/shelters/sfspca.py`),
  merges in hand-written descriptions from `data/enrichment.json`
  (`scripts/shelters/enrich.py`), and writes `data/dogs.json` — reviewed and
  committed, not fetched at runtime. `--plan` reports the Firestore diff
  before anything writes; the real push **replaces** the roster rather than
  appending (PR #13 fixed silent duplication). This is the pattern to
  extend, not replace.
- **It has a manual trigger, deliberately not a schedule.**
  `.github/workflows/import-dogs.yml` (added same day as M1, after this doc's
  first draft) runs it via `workflow_dispatch` with a `--plan`-by-default
  preview and an explicit re-scrape opt-in, using the same service account
  the deploys use. Its own comment states the reasoning: "the roster should
  change when someone decides it should, not because a file moved." That's
  a real design position, not an oversight — M4 below is about deciding
  whether to keep it manual-only or add a proposal-only schedule, not about
  assuming a schedule is obviously better.
- **The roster is one shelter deep.** Every dog in `data/dogs.json` carries
  `shelter_id: "sfspca-mission"`. `web/src/lib/shelters.ts` lists **six**
  organizations — re-counted against `main` 2026-08-26; this line previously
  said eight, which was true when written but stale the moment RS-3 (PR #24)
  removed `petsun` and `familydog`. The remaining five (`acc`, `muttville`,
  `coppers`, `wonder`, `rocket`) have zero dogs and no import path — they're
  decorative until M3.
- **`shelters.ts` drift — fixed 2026-08-25 (RS-3, PR #24); settled, see the
  Ledger for the full account.** The one thing worth carrying forward: the SF
  SPCA id is `"sfspca-mission"` everywhere, and `web/src/lib/shelters.test.ts`
  guards it. That is the id RS-2 must seed its `shelters/{id}` doc at.
- **`applications` rules exist; shelter accounts and `dogs` writes do not.**
  Updated 2026-08-25 against `firestore.rules` on `main`: RS-1 (PR #21)
  added `isStaff()`, `match /applications/{applicationId}`, and
  `match /shelters/{shelterId}`, and `web/src/lib/applications.ts` now
  writes an application doc from both apply() sites. What is still true:
  `match /dogs/{dogId}` remains `allow write: if false` (with a comment
  marking it as M3's job), **no `shelters/{id}` document has actually been
  created**, and no uid is in any `staffUids` — so `isStaff()` currently
  evaluates against nothing and no shelter can edit its own listing. RS-2
  is what makes those rules load-bearing.
  **Re-verified 2026-08-28 against `firestore.rules` on `main`, not against
  this paragraph's own prior wording:** `match /dogs/{dogId}` is still
  `allow write: if false` at `:12-17`, with the "Becomes isStaff(shelter_id)
  … (M3)" comment intact. Nothing has moved here since 2026-08-25 — the four
  merges in between (#27, #28, #29, #30) were all production-hardening or
  docs. The queue below is unchanged and still accurate.

**Doc size watch (2026-08-28):** this file is ~350 lines, against the
README's ~400-line archive threshold, and it is the only doc close to it. The
next `plan` run that adds material here should first move the settled M1/M2/M4
narrative into `docs/initiatives/archive/` per the README's rule, rather than
appending and quietly blowing through the limit.

## Milestones

**M1 — done.** Offline, reviewed, committed dog data for one shelter, with a
diff-before-write import path. (`scripts/import_dogs.py`,
`data/enrichment.json`, PRs #6, #13, #14.)

**M2 — done (2026-08-24, PR #21), with one part deferred.** The
`applications/{id}` write path and the `applications`/`shelters` rules
shipped, in `shelter-integration.md`'s shape. Deferred to M3 on purpose, and
still open: seeding a real `shelters/{id}` doc and relaxing the `dogs` write
rule, both of which need a staff uid that didn't exist yet. Those are now
RS-2 and RS-6 respectively.

**M3 — shelter accounts and the admin add/edit surface.** The "approved via
shelter admins" half: staff sign in with the existing Google auth (uids added
to `staffUids` by hand at first, no self-serve org signup), see their own
shelter's applications, and add or retire their own dogs. Manual entry
through this UI becomes the second source adapter — proving the pipeline
works for a shelter that isn't SF SPCA, with zero scraping risk and no
third-party approval needed. **Fully specified as RS-2 → RS-5 → RS-6 in the
Task queue below**, including the device decision, the staff-resolution
query, every required state, and the navigation model; that's the detail to
build from, not this paragraph.

**M4 — decide on a cadence, and reconcile drift. Decision made 2026-08-26.**

The `shelters.ts` drift half is **done** (RS-3, PR #24 — cut to six verified
entries rather than re-verifying all eight).

The cadence half was the open question, and the answer is: **yes to a
cadence, no to Cloud Scheduler, and the deliverable is the notification, not
the schedule.** Reasoning, grounded in the workflow as it actually exists:

- **No Cloud Scheduler.** `import-dogs.yml` is already a GitHub Actions
  workflow with the GCP service account wired in; a `schedule:` trigger adds
  a cadence in the file that already does the work, with nothing new to
  provision, authenticate, or pay for. Cloud Scheduler would mean a second
  system holding a second credential to invoke the first one.
- **Plan-only, permanently.** The workflow's `plan_only` input already
  defaults to `true`, and `--plan` still connects and reads (per
  `import_dogs.py:111`), so a scheduled run proves the credentials work and
  prints a real diff while writing nothing. Automated *proposal*, human
  *approval* — the workflow's own stated philosophy, unchanged.
- **The scheduled run must `--rescrape`, and this is the part that's easy to
  get wrong.** The workflow's other input defaults to `rescrape: false`,
  which replays `data/sfspca_scrape.json` from cache. A scheduled drift check
  running off the cache would diff the committed data against itself and
  report "no drift" **forever** — worse than no check at all, because it
  looks like a working signal. Drift detection means comparing against the
  shelter's live page, so the scheduled path is the one case where
  re-scraping is mandatory rather than opt-in.
- **Weekly.** The source is a shelter's adoptable-dogs page, not a feed.
- **The actual gap is that nobody reads Actions logs.** A plan-only run whose
  diff dies in a log nobody opens is not a drift check. What makes the
  cadence worth anything is failing loudly — or opening/updating an issue —
  *only* when the diff is non-empty. Silence when nothing changed.

Known constraints for whoever builds it: scheduled workflows only run from
the default branch, and GitHub disables them after 60 days of repo
inactivity. Neither is a blocker; both are worth a comment in the file.
Queued as RS-4.

**M5 — a second automated source, gated on demonstrated need.**
`real-data-sourcing.md` already picked RescueGroups.org as the one open API
worth a second look (free, terms explicitly permit caching, refresh cadence
stated) — but getting a key and confirming Bay Area coverage is unstarted.
Don't build this until M3 has at least one real shelter using the admin
surface; a second automated source before the manual path is proven just
adds a second thing that can drift.

## Task queue

RS-2's original scope — "shelter sign-in, application list, and add/retire a
dog" — was one queue item covering three surfaces, which cannot land as one
atomic PR without leaving the repo half-working. **Split 2026-08-26 into
RS-2 / RS-5 / RS-6, in that order**, with the design questions it left open
answered below rather than left to whoever picked it up. (RS-4 was already
taken by the M4 drift check, which is unrelated and independent of these.)

### Decisions that apply to all three (Sharang, 2026-08-26)

- **Both sides are device-agnostic.** The shelter side is desk-shaped work —
  lists, review, data entry — so it is built responsive and does **not** live
  inside the 430px `.phone` frame. It must still be genuinely usable on a
  phone: a staff member approving one application from their pocket is a real
  case, not an afterthought. The foster side becoming responsive too is a
  separate item (DC-5 in `design-consistency.md`) — don't do it here.
- **Staff-ness is resolved by query, never by a document read** — see below.
  That's a fix to a real bug in the previous spec, not a style preference.

### The staff-resolution bug, and the fix

The obvious implementation — `getDoc(doc("shelters", id))`, then check
`staffUids` — **cannot work**, and would produce exactly the blank screen the
original RS-2 said to avoid. `firestore.rules:57` reads:

```
allow read: if request.auth != null && request.auth.uid in resource.data.staffUids;
```

A non-staff user's read is therefore **denied** — and a *missing*
`shelters/{id}` doc denies identically, since `resource.data` is null. Those
two collapse into one indistinguishable `permission-denied` at the client:
no way to tell "you aren't staff" from "that shelter doesn't exist", which
want different screens and different fixes. (Offline is at least a distinct
`unavailable` code, so it isn't part of the ambiguity — but it does mean the
happy path ends up branching on error codes rather than on data, which is
the deeper smell.)

**Resolve staff-ness with a collection query instead:**

```ts
query(collection(firestore, "shelters"), where("staffUids", "array-contains", uid))
```

Firestore permits this against the rule exactly as it already stands — the
rules engine can prove every matching document is readable, which is the
documented secure-query pattern — so it needs **no rules change**. Do not
touch `firestore.rules` for this. The result is unambiguous:

| Result | Meaning | Screen |
| --- | --- | --- |
| resolves, 0 docs | signed in, not staff anywhere | "not staff" state |
| resolves, ≥1 doc | staff — and you get the shelter(s) | dashboard |
| rejects | a genuine error (offline, misconfig) | retry state |

It also handles multi-shelter staff for free, which the doc-read approach
couldn't express at all.

### The items

- **RS-2 (rescoped 2026-08-26) — staff resolution, the `/shelter` route
  shell, and the gate.** No application list and no dog editing yet. This
  item is purely: a staff member can reach a shelter surface that knows who
  they are, and a non-staff visitor is told so clearly.
  - Seed the first `shelters/{id}` document by hand — id
    **`sfspca-mission`** (settled by RS-3; matches `data/dogs.json` and
    `scripts/shelters/sfspca.py`'s `CAMPUS["id"]`), shape
    `{ name, address, staffUids: [<a test uid>] }` per
    `shelter-integration.md`. Until it exists every rule check evaluates
    against nothing. `shelters/{id}` is `allow write: if false` on purpose —
    create it from the Firebase console or an Admin-SDK one-off, not from the
    client, and say which in the ledger row.
  - Add `useStaffShelters()` in `web/src/hooks/` implementing the
    array-contains query above. Return a discriminated result —
    `{ state: "loading" | "notStaff" | "error" | "staff", shelters }` — so
    callers can't accidentally collapse "not staff" into "error".
  - Route: `/shelter` as a **sibling** of the foster
    `<Route element={<Layout/>}>` in `App.tsx`, not nested inside it. That
    route *is* the phone frame (`.shell > .phone`, `max-width:430px`), so
    nesting would trap the dashboard inside it. Give it its own
    `ShelterLayout`.
  - Gate with a `StaffGate` mirroring the existing `AuthGate`/
    `OnboardingGate` pattern in `App.tsx`: `loading` → the existing
    `<Boot/>`; signed out → `SignInView` (reuse it, don't build a second
    sign-in); `notStaff` → plain copy, "This is the shelter side of Pawthway.
    Your account isn't on a shelter's staff list," and a link back to `/`;
    `error` → a retry.
  - **Discoverability is deliberately none.** No tab, no link from the foster
    app — staff reach `/shelter` by URL. A visible entry point is a decision
    for after a real shelter is using it (see "The part that's a
    conversation" below).
  - Verify: a uid in `staffUids` reaches the shell; a signed-in uid that
    isn't gets the "not staff" copy rather than a blank screen or a spinner;
    a signed-out visitor to `/shelter` gets sign-in and lands back on
    `/shelter` afterwards. Check all three at 390px wide and at 1440px.
- **RS-5 (gated on RS-2) — the application list and review.** The shelter's
  actual inbox: `where("shelterId", "==", <their id>)`, newest first.
  - Row: foster name (`fosterName` is denormalised onto the application for
    exactly this), dog name, `status`, age of the application.
  - Detail: the `checklist`, with `owner: "shelter"` items tickable and the
    foster's own items read-only — `web/src/checklists.ts` already carries
    `owner`, so filter on it rather than re-listing ids. Status moves
    `submitted → in_review → approved | declined`. `withdrawn` is the
    foster's to set, not the shelter's (`firestore.rules:49-51`).
  - States, all four required: loading; **empty** ("No applications yet" —
    the expected state for a real shelter on day one, not an error);
    populated; error with retry.
  - Do **not** write back to `fosters/{uid}`. The application document is the
    source of truth for status/checklist/pickup per `shelter-integration.md`;
    the foster's read-through fields are M2's deferred migration, not this
    item's job.
  - Verify: staff at `sfspca-mission` see only their own shelter's
    applications; ticking a shelter-owned item persists; a foster-owned item
    isn't tickable from this side.
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

All three ship to test accounts only until Sharang has actually spoken to a
shelter, per the section below.
- **RS-4 (2026-08-26, from the M4 decision above — read that section before
  building; the reasoning there is the spec).** Add a weekly scheduled drift
  check to `.github/workflows/import-dogs.yml`. Add a `schedule:` trigger
  (weekly) alongside the existing `workflow_dispatch`, keeping every manual
  input and its current default exactly as-is. The scheduled path must run
  **plan-only** and **with a re-scrape** — the opposite of the manual
  default on the rescrape flag, and the single most important detail in this
  task: a cached replay diffs the committed data against itself and reports
  "no drift" forever. Since the two triggers need different argument
  defaults, read `github.event_name` to build the arg list rather than
  relying on the input defaults, which are empty on a `schedule` event.
  Then make the result visible: the run should be quiet when the diff is
  empty and loud when it isn't. Prefer opening (or updating, don't spam a
  new one weekly) a GitHub issue with the diff body — that needs
  `issues: write` in the job's `permissions:`, which is currently
  `contents: read`; failing the run with `::error::` and the diff is an
  acceptable simpler fallback, say which you chose in the ledger row. The
  existing `concurrency: import-dogs` group already prevents a scheduled run
  from overlapping a manual one — leave it. Add a comment noting that
  scheduled workflows only run from the default branch and are disabled
  after 60 days of repo inactivity. **Nothing here may write to Firestore:**
  do not add a path where a scheduled run drops `--plan`. Verify: trigger it
  by hand via `workflow_dispatch` first to confirm the workflow still parses
  and the manual path is unchanged, then confirm the scheduled branch of the
  arg-building logic resolves to plan + rescrape (echo the final `ARGS` in
  the run log and read it back).

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

*(Status as of 2026-08-26: no evidence this conversation has happened — no
commit, no doc edit from Sharang, no note anywhere in the repo. Recorded so a
future run doesn't mistake the passage of time for progress.)*

## Ledger

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed
  descriptions, diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` + `shelters/{id}` rules
  added to `firestore.rules` (isStaff(), create/read/update sketch from
  shelter-integration.md, verbatim). `web/src/lib/applications.ts`'s
  `createApplication()` opens an application doc from both apply() sites
  (`SavedView.tsx`, `DogDetailView.tsx`) using the dog's own `shelter_id`
  (not `shelterFor()`'s hash-fallback id, so it's unaffected by RS-3's
  mismatch). `fosters/{uid}.matchedDogId`/`approvalChecklist`/`pickup` left
  untouched as read-through fields, per the task's own migration note.
  Did not seed real `shelters/{id}` docs or change the `dogs` write rule —
  both need a real staff uid to add by hand, which is RS-2/M3's job, not
  M2's; `isStaff()` is safe to ship with no shelter docs existing yet since
  nothing calls it until RS-2 lands.
- 2026-08-25 — RS-3 — PR #24 — `web/src/lib/shelters.ts`'s SF SPCA id
  changed `"sfspca"` -> `"sfspca-mission"` (matches `data/dogs.json` and
  `scripts/shelters/sfspca.py`'s `CAMPUS["id"]`, cheaper than re-scraping);
  removed `petsun` (a second campus of the same SF SPCA, not a distinct
  org) and `familydog` (closed at the address shown, no verified current
  one to replace it with). Added `web/src/lib/shelters.test.ts` as the
  regression guard. Found and corrected a stale claim in this doc's own
  "where this stands" section along the way: the mismatch never actually
  broke the live browsing surface, because every real dog carries its own
  denormalized `shelter` object that `normalizeDog()` already prefers over
  the hash fallback — the fix still mattered for RS-2's `isStaff(shelterId)`
  matching a real `shelters/{id}` doc, just not for the reason originally
  written down.
