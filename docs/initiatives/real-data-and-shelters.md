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
  **2026-09-21 — RS-13's scheduled branch observed on a real run, and it did what it says.** Run
  `35582812290` went green, caught the 403, and opened issue **#96** ("Weekly roster check could not
  reach sfspca.org", label `roster-drift`) whose body says the freshness is *unknown*, that nothing
  was written, and quotes the import's own 403 line. That discharges the RS-13 row's "check the
  2026-09-21 run". Next Monday should *comment* on #96, not open a second issue — worth one look.

## Milestones (compressed; full narrative in the archive)

- **M1 — done.** Offline, reviewed, committed dog data for one shelter with a
  diff-before-write import path. PRs #6, #13, #14.
- **M2 — done 2026-08-24 (PR #21).** `applications/{id}` writes and the
  `applications`/`shelters` rules, in `shelter-integration.md`'s shape. Its two
  deferred halves became RS-2 (shipped, PR #34) and RS-6 (open).
- **M3 — shelter accounts and the admin add/edit surface. Surfaces done 2026-09-05; one round
  trip still open.** Staff sign in with the existing Google auth, see their own shelter's
  applications, and add or retire their own dogs (RS-2, RS-5, RS-6, then RS-10/11/12's joins).
  *Corrected 2026-09-22 — this paragraph said "in progress, RS-6 is the remaining third" for three
  weeks after RS-6 shipped.* What M3 never carried is the pickup: the request goes nowhere a
  shelter reads, which is **RS-14**. Build from the queue items, not from this paragraph.
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

- **RS-14 `[large]` — the pickup request reaches the shelter, only the shelter confirms it, and the
  chat stops speaking as the shelter. Queued 2026-09-22; the first `[large]` item in this doc since
  RS-12 (2026-09-05).** Grounded against `main` at `e08c684` — design answer directly below. Five
  parts, one PR, because any subset leaves a promise nobody answers:
  1. **Schema + rules.** `Application` (`types.ts:172`) gains `pickupConfirmedAt: {toMillis():
     number} | null`; `createApplication()` (`lib/applications.ts:23`) writes it `null` beside the
     `pickup: null` it already writes. `firestore.rules`' `applications` update gains a **third
     branch**, the foster's pickup request: `fosterId == auth.uid`; `status` unchanged and one of
     `submitted`/`in_review`/`approved`; `fosterId`, `fosterName`, `shelterId`, `dogId`,
     `createdAt`, `checklist` pinned; and `pickupConfirmedAt` either unchanged *with* `pickup`
     unchanged, or `null` — **a foster can un-confirm by changing the slot and can never confirm**.
     Leave the withdraw branch and its `fosterName` comment exactly as they are.
  2. **Foster write.** `requestPickup(applicationId, pickup | null)` in `lib/applications.ts`
     writes `pickup`, `pickupConfirmedAt: null`, `updatedAt`. `MatchView`'s `confirmPickup` and
     **Change request** (`MatchView.tsx:86`, `:180`) write the application **first** when
     `useApplication` returns one, then `patchFoster({ pickup })` as today — `fosters/{uid}.pickup`
     stays, because LOCAL_MODE has no application and five read sites (`fosterWindow`, Hub, Saved,
     Care Plan, the chat) read it. If the application write throws, surface it and skip the
     `patchFoster`, so the foster never sees a request the shelter can't.
  3. **Composition, fail-safe.** `pickupState(fosterPickup, application)` in `applicationView.ts`
     → `"none" | "requested" | "confirmed"`. **`confirmed` only when `application.pickupConfirmedAt`
     is set *and* `application.pickup` equals `foster.pickup` on date, time and location**; absent
     application → at most `requested`. `activeStage()` takes this state: stage 3 stays "Pickup
     requested" until confirmed, then a fifth stage **"Pickup confirmed"** — both callers
     (`MatchView.tsx:64`, `SavedView.tsx:171`) switch together, which is why `APPLICATION_STAGES`
     is shared.
  4. **Shelter inbox.** `ApplicationDetail` (`ShelterApplicationsView.tsx:175`) renders the
     requested slot or "No pickup requested yet", and a **Confirm pickup** button (the staff branch
     already allows the write) setting `pickupConfirmedAt: serverTimestamp()`, with **Undo** to
     `null`; hidden when `!isActionable(status)`. `ApplicationList` rows show a "Pickup requested"
     pill while requested-and-unconfirmed — the one state staff must act on. Pure helpers beside
     `staffTransitions()`.
  5. **The chat stops impersonating the shelter.** `PAWTHWAY_SYSTEM`'s pickup paragraph
     (`server.py:76-78`) loses "foster coordinator" and "first-person plural for the shelter"; the
     agent speaks as **Pawthway's assistant**, never as the shelter, says it cannot see whether the
     shelter confirmed (the Match screen shows that), and says this chat does not reach the shelter
     if the foster tries to tell them something. `MatchChatView.tsx:61-63` titles the chat as the
     assistant (the shelter's name may appear in the sub-line as the topic, not the speaker);
     **`:74`'s "You're confirmed for …" goes** — PH-23's census missed it — and `:29`'s "message
     the shelter here" with it. `MatchView`'s card drops "message them below to agree the day"
     (`:158`) and the chat entry stops being titled "Message {shelter}" / "Confirm the day".
  **Verify:** vitest for `pickupState` (all three states, the mismatch case, the absent
  application), the shelter-side helpers, and new `MatchView.test.tsx` rendered cases for
  requested/confirmed; `grep -rn "confirmed for\|first-person plural\|foster coordinator" web/src src`
  empty; a pytest asserting the prompt no longer claims the shelter's voice;
  `./node_modules/.bin/tsc -b`, build, lint at `main`'s 8 warnings, `uv run pytest`. There is no
  rules-unit-test harness in this repo — don't add one for this; the rules change is checked by
  reading and by **RS-14b**. **Not in scope, named so nobody rediscovers them:** the countdown
  (`fosterWindow`) still anchors on a *requested* date; "Start care plan" still unlocks on a
  request (gating it would strand LOCAL_MODE, which has no one to confirm); staff have no way to
  propose a different time; `get_foster` doesn't report confirmation. `CLAUDE.md`'s "Once a slot
  is confirmed, an `AgentChatPanel` appears for coordinating with the shelter" goes stale with
  this PR — not this loop's file; say so in the PR body.

### Who answers a pickup request, and who may speak for the shelter (2026-09-22)

PH-23 changed the verb from *Book* to *Request* and was right to. But a request is a promise that
someone will answer, and reading the whole path on `main` found that **nobody can**: the slot is
written only to `fosters/{uid}.pickup` (`MatchView.tsx:87`), which no shelter can read;
`applications/{id}.pickup` has been written `null` by every application ever created and read by
nothing; and the foster branch of the update rule admits only `withdrawn`. The screen already knows
— a comment at `MatchView.tsx:156` says *"no shelter can see it yet"*. What it tells the foster
instead is to "message them below to agree the day", and below is an agent **instructed to answer
as the shelter's foster coordinator, in the shelter's first-person plural, under the shelter's real
name**. So a foster can agree a day with SF SPCA, in writing, and SF SPCA never learns of it.

> **A request must land somewhere its addressee reads, and only its addressee may answer it.** And
> the corollary the chat needs: **a model may help a person talk *about* an organisation; it may
> never talk *as* one.** PH-23's prompt told the agent not to confirm on the shelter's behalf while
> leaving it speaking in the shelter's voice — a ban on one sentence inside an impersonation.

Two decisions follow, both in the spec above. **The request is written twice by one writer, and
disagreement reads as unconfirmed.** RS-10 banned mirroring because two *writers* race; here there
is one writer and the hazard is drift, so `pickupState` requires the two copies to agree before
anything says *confirmed* — the failure direction is "asks again", never "shows up unexpected".
**The item lives here, not in production-hardening**, because its load-bearing half is the shelter
seeing and answering something, which is M3's surface; the chat copy rides along because it is the
same promise told a second way. Per "the part that's a conversation" below, it ships to test
accounts only, like every M3 surface.

- **Everything before RS-14 is shipped, and each item's Ledger row is its account** — RS-13 (PR
  #88, the check can say *could not look*; **M4 stays reopened** on RS-13b), RS-4 (PR #72, the
  weekly check, which 403s from a GitHub runner), and every M3 item: RS-6 `[large]` (PR #54),
  RS-10 `[large]` (PR #56), RS-11 `[large]` (PRs #58, #59), RS-12 `[large]` (PR #63, which
  **discharges PH-1**), RS-7/RS-5 (PRs #38, #39, #52). Three queue bullets restating those rows
  went to the 2026-09-22 archive. The signed-in halves are under "Needs a human".

All of these ship to test accounts only until Sharang has actually spoken to a
shelter, per the section below.

- **The `[large]` slot is back in this doc (2026-09-22)** after fourteen runs (2026-09-08 → 09-21)
  in `production-hardening.md`, where it sat because M3 was finished and M5 is gated on a person.
  RS-14 came from a line PH-23 left in *that* doc — "the request/confirm round trip is still
  unbuilt" — and **the unbuilt half of a truthfulness fix was product work, not hardening.** The two
  bullets that narrated the routing (and PH-22's fix to the callee behind RS-6's `dogFromForm()`)
  are verbatim in
  [`archive/real-data-and-shelters-routing-ledger-2026-09-22.md`](archive/real-data-and-shelters-routing-ledger-2026-09-22.md).


### Needs a human, not a queue item
- **RS-14b — PARKED at queue time (2026-09-22); the signed-in half of RS-14.** One sitting with
  RS-6b, RS-12b and RS-8. As a test foster with an application on `sfspca-mission`, request a
  pickup; then as the staff uid at `/shelter`, expect the row's "Pickup requested" pill and the slot
  in the detail, press **Confirm pickup**, and expect the foster's Match card to read confirmed.
  Then, as the foster, **Change request** and expect it back to requested. From the foster's
  console, `updateDoc` the application with a non-null `pickupConfirmedAt` and expect
  `permission-denied`. A denial on the foster's own request is a finding to queue, never licence to
  widen the rule. **Write down what happened.**


- **RS-13b — a runner with an address sfspca.org will answer.** RS-13 made the weekly check
  honest about not being able to look; it did not make it able to look, and no PR can. SF SPCA
  answers `200` to an ordinary connection with no `User-Agent` and `403` to GitHub-hosted runners,
  so the roster can only be checked on a cadence from a machine somebody owns — a self-hosted
  runner, or a scheduled re-bake on a laptop. Until then the drift signal is a person running
  `uv run python scripts/import_dogs.py --dry-run`, and the weekly issue says so in those words.
  **M4 is not closed by RS-13.**

- **RS-9 and RS-5b — DONE, with Sharang present (2026-08-29, 2026-09-04).** RS-9 granted
  `roles/datastore.indexAdmin` so the `applications` index reached `READY` (invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md)); RS-5b proved the staff branch of the read rule
  serves the inbox's list query and both staff writes succeed. **Three `fixture-` applications
  are still in production** with fixed ids — re-running `scripts/seed_test_applications.py`
  resets rather than duplicates. Both entries verbatim in the 2026-09-22 archive.

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

*(Status re-checked **2026-09-22**, not carried over: `git log --all --since=2026-09-19` is this
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
- 2026-09-05 — RS-12 `[large]` — PR #63 — **the dog comes back, and the shelter sees it.** The
  agent's `adoption_profile`, written since the first Post Foster turn and read by nothing, lands in
  a **Back from foster** group atop `ShelterRosterView`; `rosterActions` (plural); **no rules
  change**; `notified_shelter` is true because the write lands where RS-5b proved staff read.
  Discharges **PH-1**. Full row in
  [`archive/real-data-and-shelters-rs12row-2026-09-17.md`](archive/real-data-and-shelters-rs12row-2026-09-17.md).
- 2026-09-09 — RS-4 — PR #72 — **a weekly, plan-only-by-construction roster check** on
  `import-dogs.yml` (`schedule: "0 9 * * 1"`; the scheduled branch always re-scrapes and has no path
  to a Firestore write), reporting drift as one reused `roster-drift` issue. Its first real run
  (2026-09-14) failed `403` from the GitHub runner — see RS-13.
- 2026-09-17 — RS-13 — PR #88 — **the weekly check can say *could not look*.** `import_dogs.py`
  exits `EXIT_UNREACHABLE = 75` having written nothing on an `httpx.HTTPError` **or a fresh scrape
  of zero dogs** (the case the spec missed: `sfspca.scrape()` swallows per-page errors), and the
  scheduled branch files that on the same issue. Manual dispatch unchanged. Observed on a real run
  2026-09-21 (issue #96). M4 stays open on RS-13b.

*(Both rows verbatim in
[`archive/real-data-and-shelters-routing-ledger-2026-09-22.md`](archive/real-data-and-shelters-routing-ledger-2026-09-22.md);
RS-4's also in [`archive/real-data-and-shelters-rs4-2026-09-17.md`](archive/real-data-and-shelters-rs4-2026-09-17.md).)*
