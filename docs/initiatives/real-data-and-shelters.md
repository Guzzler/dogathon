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

**Archived 2026-08-29, and repeatedly since.** This doc keeps arriving at the README's ~400-line
threshold, so settled sections are snapshotted verbatim into [`archive/`](archive/) and compressed
here to a decision plus a pointer. Read the archive for the reasoning behind a settled decision;
read this file for what is open.

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
- **2026-09-03 / 09-04 / 09-05 — M3 is finished and its two round trips are closed.** RS-10
  joined the checklist halves by `owner`; RS-11 threaded `application.status` into the foster side
  and made withdrawing write `withdrawn` back; RS-5b proved the staff branch of `applications`'s
  read rule serves the list query (three `fixture-` rows, seeded with Sharang present, still in
  production); RS-12 landed the returned dog and the agent's paragraph on a surface staff
  demonstrably read. Each has a Ledger row, which is the account; the three dated bullets that
  used to restate them are verbatim in
  [`archive/real-data-and-shelters-settled-2026-09-17.md`](archive/real-data-and-shelters-settled-2026-09-17.md).
  What is *not* closed is that **no human has driven any of it end to end** — RS-6b, RS-12b and
  RS-8 under "Needs a human".
- **2026-09-17 — the roster's only staleness signal has still never run, and now says so.**
  RS-4's weekly `import-dogs.yml` schedule fired for the first time on 2026-09-14 and failed `403`
  scraping SF SPCA's sitemap from the GitHub runner; the same URL returns `200` from a residential
  IP with no `User-Agent`. RS-13 (shipped the same day) makes that outcome reportable rather than a
  skipped step — *drifted, clean, or could not look*. **M4 stays reopened**: the check is honest,
  and it still cannot look. RS-13b under "Needs a human" is the only thing that changes that.

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
- **M4 — decided 2026-08-26, shipped 2026-09-09 as RS-4 (PR #72), reopened 2026-09-17, and
  **still open after RS-13**.** The cadence exists, reports honestly, and has never once run to
  completion: the scrape 403s from a GitHub-hosted runner's IP range. RS-13 shipped the
  honest-reporting half (a week with no check files an issue saying the freshness is *unknown*);
  the other half is an unblocked address, which is infrastructure a person owns — **RS-13b**. The
  original reasoning (yes to a cadence, no to Cloud Scheduler; weekly, plan-only, always
  re-scraping) is in the archive and the outcome is the RS-4 Ledger row.
- **M5 — a second automated source (RescueGroups.org), gated on demonstrated
  need.** Don't build it until M3 has one real shelter using the admin surface;
  a second automated source before the manual path is proven just adds a second
  thing that can drift.

## Settled design, all three shipped — compressed 2026-09-04

Three invariants, kept because they are what a regression would break; the design sections that
argued them are the longer telling and are archived. **RS-6's photo source**: a pasted URL into
`photo_urls`, no uploads, `dogPhotoOrNull()` keyed off `source` so the placedog fallback never
fires for a hand-entered dog. **RS-10's checklist join**: one writer per field — shelter items on
`applications/{id}.checklist`, foster items on `fosters/{uid}`, each view composing both, **never
mirroring**. **RS-11's precedence**: `declined` > `withdrawn` > `approved` > checklist-derived;
`approved` replaces the badge but never unlocks pickup; an absent application must never render as
a decline. Full text in the [2026-09-04 archive](archive/real-data-and-shelters-2026-09-04.md) and,
for RS-10's rejected alternatives, the
[RS-10 archive](archive/real-data-and-shelters-rs10-2026-09-02.md).

## Settled — "notify the shelter" means the dashboard (2026-09-04, shipped 2026-09-05 as RS-12)

**The notification is a surface, not a message.** Not email and not Arcade — wiring either would
mean choosing an address for an organization Pawthway has no relationship with, which is the
conversation this doc keeps saying is Sharang's to have. A shelter that signs in to `/shelter` has
already told us where it reads, so the dog comes back on its own roster with the agent's profile
rendered in full, and `notified_shelter` is true because a write landed somewhere staff
demonstrably read (RS-5b), not because a capability exists. This discharges **PH-1**. Full
specification and the section that argued it, verbatim, in the
[2026-09-05 design archive](archive/real-data-and-shelters-2026-09-05.md) and
[`archive/real-data-and-shelters-settled-2026-09-17.md`](archive/real-data-and-shelters-settled-2026-09-17.md).

## Task queue

RS-2's original scope — "shelter sign-in, application list, and add/retire a
dog" — was one queue item covering three surfaces, which cannot land as one
atomic PR without leaving the repo half-working. **Split 2026-08-26 into
RS-2 / RS-5 / RS-6, in that order**, with the design questions it left open
answered below rather than left to whoever picked it up. (RS-4 was already
taken by the M4 drift check, which is unrelated and independent of these.)

### Decisions that apply to all three (Sharang, 2026-08-26)

Both are in the README's "already decided" list and a third telling here, so: **both sides are
device-agnostic** (the shelter side responsive and *outside* the 430px `.phone` frame, still usable
from a pocket; the foster side is DC-5), and **staff-ness is resolved by an `array-contains` query,
never a document read** (shipped in RS-2; derivation in the
[2026-08-29 archive](archive/real-data-and-shelters-2026-08-29.md)). Don't re-derive either, and
don't "fix" the second by loosening `firestore.rules`.

### The items

- **RS-13 — shipped 2026-09-17; the Ledger row is the full account.** The weekly check reports
  three outcomes instead of two, and the third says the roster's freshness is **unknown** rather
  than clean. `scripts/import_dogs.py` exits `75` (`EXIT_UNREACHABLE`) when it cannot reach the
  shelter, having written nothing; `import-dogs.yml`'s scheduled branch catches 75 and only 75 and
  files that as the same one `roster-drift` issue. Two things worth keeping out of the row: **the
  empty scrape is the same failure wearing different clothes** — `sfspca.scrape()` swallows
  per-page errors and returns `[]`, so a site refusing every request would have replaced the
  roster with nothing and reported the emptiness as drift — and **what RS-13 deliberately does not
  do is make the scrape work.** It cannot: the block is on the address range GitHub-hosted runners
  live in, so a cadence that can actually look needs a runner nobody in this repo owns. That is
  **RS-13b** under "Needs a human", and **M4 stays reopened** until it exists.

- **Every M3 item is shipped and each has a Ledger row, which is the account** — RS-6 `[large]`
  (PR #54, M3's third surface), RS-10 `[large]` (PR #56, the checklist join, which ungated RS-11),
  RS-11 `[large]` (PRs #58, #59, the round trip in both directions), RS-12 `[large]` (PR #63, which
  **discharges PH-1** — not anything in `production-hardening.md`), and RS-7/RS-5 (PRs #38, #39,
  #52, the deploy target and the inbox; RS-5's one open question was settled by RS-5b). These
  bullets had each become a third layer pointing at a Ledger row that points at an archive, so they
  are one line now. The signed-in halves are **RS-6b, RS-12b and RS-8** under "Needs a human".

- **RS-4 — shipped 2026-09-09 (PR #72), and its claim to have closed M4 did not survive its own
  first real run.** The weekly trigger, the plan-only-by-construction scheduled path and the
  one-reused-issue drift report all shipped exactly as specified — and the scrape 403s from a
  GitHub runner, so none of it has ever produced a report. **RS-13 above is the fix**; this bullet
  used to say "M4 is closed" and "this empties the last open item across all three initiative
  docs", and the second half was true.

All of these ship to test accounts only until Sharang has actually spoken to a
shelter, per the section below.

- **This doc has held no `[large]` item since 2026-09-05, and that is still a finding rather than
  a gap — re-checked this run and unchanged.** M3 is finished; M5 is gated on demonstrated need,
  which needs a real shelter, which needs the conversation below. RS-13 shipped (PR #88) and did not change it: it was a workflow honesty fix, small by
  construction. **Re-checked 2026-09-19 and unchanged for an eleventh run** — the repo's `[large]`
  slot is PH-25 in `production-hardening.md`, a tenth consecutive run in the third doc, which is
  routing for one run and not a re-rank. RS-13's half of that is re-grounded rather than carried:
  `import_dogs.py:51` still defines `EXIT_UNREACHABLE = 75` and `:127-130` still exits it having
  written nothing, so the honest-reporting half stands and **RS-13b is still the only thing that
  closes M4**. The
  top doc has run out of *buildable* work, not out of work. Full narration of the nine runs that
  established this, and the two cautions it produced about a dated measurement being evidence whose
  *measured-against* is part of the claim, verbatim in
  [`archive/real-data-and-shelters-largeslot-2026-09-14.md`](archive/real-data-and-shelters-largeslot-2026-09-14.md).

- **2026-09-13 through 2026-09-18 — six runs recorded the same routing outcome here** (this queue
  empty, every gate still gated on a person, the `[large]` slot found in `production-hardening.md`),
  and they are compressed to this line per the README's rule that a chronological log grows like a
  ledger — verbatim in
  [`archive/real-data-and-shelters-routing-2026-09-17.md`](archive/real-data-and-shelters-routing-2026-09-17.md).
  The one substantive thing they carried is worth keeping: **PH-22 (PR #83) fixed the callee behind
  RS-6's `dogFromForm()`**, which omits `foster_weeks`, `size` and `energy_level` and asserted in a
  comment that `normalizeDog()` "already knows how to render" an absent key. It did not — it filled
  all three from a breed regex, making a hand-entered dog the *most* likely record to carry invented
  facts. The form was right and its callee was not; the convention is now safe as written.

### Needs a human, not a queue item

- **RS-13b — a runner with an address sfspca.org will answer.** RS-13 made the weekly check
  honest about not being able to look; it did not make it able to look, and no PR can. SF SPCA
  answers `200` to an ordinary connection with no `User-Agent` and `403` to GitHub-hosted runners,
  so the roster can only be checked on a cadence from a machine somebody owns — a self-hosted
  runner, or a scheduled re-bake on a laptop. Until then the drift signal is a person running
  `uv run python scripts/import_dogs.py --dry-run`, and the weekly issue says so in those words.
  **M4 is not closed by RS-13.**

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

*(Status re-checked **2026-09-18**, not carried over: `git log --all --since=2026-09-15` is this
loop's own PRs and nothing else, and a grep across `docs/` turns up no commit, no doc edit from
Sharang and no note anywhere saying this has happened. Recorded so a future run doesn't mistake
the passage of time for progress. Now that M3 is finished this is the only thing standing between
the shelter side and a real user — and, per the queue note above, between this doc and its next
`[large]` item. The loop cannot route around it and should stop looking for a way to.)*

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
- 2026-09-05 — RS-12 `[large]` — PR #63 — **the dog comes back, and the shelter sees it — which is
  what "notify the shelter" now means.** `adoption_profile` had been written by the agent since the
  first Post Foster turn and read by **nothing**; it now lands in a **Back from foster** group at
  the *top* of `ShelterRosterView`, rendered in full with no clamp. `rosterAction` became
  **`rosterActions`** (plural), because `ready_for_adoption` is the one status wanting two moves.
  **No rules change**, confirmed before writing one: both actions are status-only writes on a dog
  the shelter already owns. `notified_shelter` is now `True` *because the write landed on a surface
  RS-5b proved staff read*, with Arcade demoted to `arcade_messaging_available` — two claims, two
  fields. This discharges **PH-1**. Nothing signed-in was verified; that half is RS-12b. Full row
  verbatim in
  [`archive/real-data-and-shelters-rs12row-2026-09-17.md`](archive/real-data-and-shelters-rs12row-2026-09-17.md).
- 2026-09-09 — RS-4 — PR #72 — **the roster was given a weekly way to say it had gone stale —
  which then turned out not to be able to run at all; see RS-13.** A `schedule: "0 9 * * 1"` trigger
  joined the existing `workflow_dispatch` on `import-dogs.yml`. The detail that decides whether the
  task is worth doing is enforced structurally rather than by default: the scheduled branch builds
  `ARGS="--plan"` from `github.event_name` and never appends `--from-cache`, so it always re-scrapes
  (a cached replay diffs the committed data against itself and reports "no drift" forever) and there
  is **no input it can set and no branch it can take that writes to Firestore**. Both manual paths
  resolve to exactly the argument strings they did before, checked by replaying the shell for all
  three events rather than by reading it. **Chose the issue over the `::error::` fallback**, and
  reused rather than reopened: one `roster-drift` label, one open issue, a *comment* if a later week
  still drifts — a weekly check that files an identical ticket every Monday is a backlog, not a
  signal. Two things the spec hadn't named: the report needed a body richer than a diff stat, so the
  import output is `tee`'d and the `firestore plan` block `sed`'d out of it; and the existing
  "Check for uncommitted roster changes" step was pinned to `workflow_dispatch` rather than relying
  on `inputs.rescrape` being a falsy empty string on a schedule event. **Verified by dispatching
  the branch's own workflow** (plan-only, cached). The scheduled branch itself cannot be dispatched,
  so what was proven was the argument replay plus the file parsing — and the row said so: *"the
  first real proof arrives the Monday after merge."* It arrived on **2026-09-14 and failed 403**.
  Full row verbatim in
  [`archive/real-data-and-shelters-rs4-2026-09-17.md`](archive/real-data-and-shelters-rs4-2026-09-17.md).
- 2026-09-17 — RS-13 — PR #88 — **the weekly roster check now has a third outcome, and it is the
  honest one: *could not look*.** `scripts/import_dogs.py` gained `EXIT_UNREACHABLE = 75`
  (`EX_TEMPFAIL`) and exits with it, having written nothing, when the scrape raises `httpx.HTTPError`
  — and, the part the spec had not named, **when a fresh scrape returns zero dogs**. That second
  case is the dangerous one: `sfspca.scrape()` catches per-page errors and returns what it got, so a
  site refusing every request yields `[]` rather than raising, and the old code would have written
  an empty `data/dogs.json`, diffed it, and filed *drift* — the emptiest possible roster reported as
  news about the dogs. `import-dogs.yml`'s scheduled branch now catches **75 and only 75**, sets
  `steps.import.outputs.reachable`, and routes to one of two report steps; the drift step gained
  `reachable == 'true'` to its `if`, because a clean working tree after a scrape that never ran is
  exactly the "no drift" lie this item exists to remove. Both reports share the one `roster-drift`
  issue (`TITLE` picked by whichever branch ran) rather than opening a second stream, per RS-4.
  **Manual dispatch is byte-for-byte unchanged and still goes red on 75** — a human is watching
  that one. **Verified**: `uv run pytest` 55 passed, five of them new in `tests/test_import_dogs.py`
  (403, connect timeout, empty scrape, a `ValueError` that must *not* become 75, and the happy path),
  each asserting the committed data files were not written; plus the Import step's shell replayed
  outside Actions for all three event types × four exit codes (7 cases), which is how RS-4 was
  verified and the only way to see the scheduled branch at all. The scheduled branch still cannot be
  dispatched, so what remains unobserved is the issue body on a real run — **check the 2026-09-21
  run**, the same discipline that found this defect. What RS-13 does **not** do is make the scrape
  work; that is RS-13b and M4 stays reopened.
