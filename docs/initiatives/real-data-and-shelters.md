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
  rewritten out from under it. **2026-09-23: a third, foster-side branch** (RS-14) admits only
  `pickup`/`pickupConfirmedAt`/`updatedAt`, and `pickupConfirmedAt` only as `null`.
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
  **2026-09-28 — it looked, for the first time.** Run `36403398124` took 2m19s against 21s for a
  403, scraped **26** dogs against 19 committed, and commented on #96 (reused, as designed) with a
  real plan: `write 26`, `delete 11`, `keep 2 … matched to a foster (delisted: ['d-026',
  'sfspca-61200213'])`. So the drift signal works end to end, the roster has turned over by more
  than half, and **the 403 is intermittent, not structural** — one success in three Mondays. Two
  things the run exposed: #96 keeps its *could not reach* title under a comment saying it did, and
  the `write 26` it plans is a whole-document replace over fields other writers now own — **RS-16**.

## Milestones (compressed; full narrative in the archive)

- **M1 — done.** Offline, reviewed, committed dog data for one shelter with a
  diff-before-write import path. PRs #6, #13, #14.
- **M2 — done 2026-08-24 (PR #21).** `applications/{id}` writes and the
  `applications`/`shelters` rules, in `shelter-integration.md`'s shape. Its two
  deferred halves became RS-2 (shipped, PR #34) and RS-6 (open).
- **M3 — shelter accounts and the admin add/edit surface. Surfaces done 2026-09-05; the pickup
  round trip shipped 2026-09-23 (RS-14); the shelter's second answer is RS-15, queued 2026-09-27.** Staff sign in with the existing Google auth, see their own shelter's
  applications, and add or retire their own dogs (RS-2, RS-5, RS-6, then RS-10/11/12's joins).
  *Corrected 2026-09-22 — this paragraph said "in progress, RS-6 is the remaining third" for three
  weeks after RS-6 shipped.* What M3 never carried is the pickup: the request goes nowhere a
  shelter reads — **RS-14**, shipped 2026-09-23, signed-in half parked as RS-14b. Build from the
  queue items, not from this paragraph.
- **M4 — decided 2026-08-26, shipped 2026-09-09 as RS-4 (PR #72), reopened 2026-09-17, and
  **still open after RS-13**.** The cadence exists and reports honestly; it 403'd from a GitHub-hosted
  runner on 2026-09-14 and 09-21 and **reached sfspca.org on 2026-09-28** — intermittent, not blocked. RS-13 shipped the
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

- [ ] **RS-15 `[large]` — the handoff happens on the shelter's say-so (queued 2026-09-27).** RS-14
  made a pickup a *request* the shelter answers — but the shelter has one answer, **Confirm**, and
  the foster's journey never waits for it. Read on `main` at `e646a73`:
  - **The dog is "in your care" on a request.** `MatchView.tsx`'s *I've got {dog} → start Care
    Plan* is `disabled={!foster.pickup}` — any request, confirmed or not — and `goToCarePlan()`
    flips `phase: "care_plan"`, which Saved then renders as *"{dog} is in your care"*
    (`SavedView.tsx:90`). A foster can declare a handoff the shelter never agreed to.
  - **The countdown runs off an unanswered date.** `fosterWindow()` anchors on `foster.pickup.date`
    at all three callers (`HubView.tsx:89`, `SavedView.tsx:172`, `PostFosterView.tsx:50`) with no
    reference to `pickupState()`, so the Hub says "Pickup in 3 days" for a slot nobody confirmed.
  - **A shelter that can't make the slot has no way to say so.** The inbox detail
    (`ShelterApplicationsView.tsx:326-344`) offers Confirm / Undo confirmation. Not confirming is
    silence, and the foster's card says "Pickup requested" forever.

  **Re-verified 2026-09-28 at `a9ba673`, after PH-31:** all three hold; `SavedView`'s `fosterWindow`
  caller moved to `:188`. The census missed one reader of the phase — `DogDetailView.tsx:244`'s
  *"{dog} is in your care right now"* on the one-at-a-time sheet — which item 5's gate makes true
  along with `SavedView:90`, so no spec change; name it in the row.

  **Design answer (this run's question — who owns the handoff?).** The same rule RS-14 set, read
  one step further: **only the party that answers a request can turn it into a fact, and nothing
  downstream may treat the request as the fact.** So the shelter gets a second answer, and every
  screen that currently reads `foster.pickup` as "the dog is coming" reads `pickupState()` instead.
  A shelter-typed note is the shelter speaking as itself, so it is allowed — attributed, never
  paraphrased by a model. Where there is **no application** (`LOCAL_MODE`, the one path with nobody
  to answer), keep today's behaviour: gating a local demo on a confirmation that cannot arrive
  would strand it, and `pickupState()` already caps that case at `requested`.

  1. **Staff: "Ask for another time".** Beside Confirm in the inbox detail, on the same condition
     (`canConfirmPickup`). Writes `pickupDeclinedAt: serverTimestamp()`, `pickupConfirmedAt: null`,
     and an optional `pickupNote` (≤ 200 chars, trimmed, `null` if blank); leaves `pickup` as it is
     so the foster sees *which* slot was declined. Staff branch is `isStaff(...)` — no rules change
     for this half. New helper in `lib/applications.ts` beside `setPickupConfirmed`. Types:
     `Application` gains both fields, optional-nullable, same comment style as `pickupConfirmedAt`.
  2. **`pickupState()` gains `"declined"`** — `pickupDeclinedAt` set **and** `application.pickup`
     matches the foster's slot (`sameSlot`, the same fail-safe as `confirmed`). `activeStage()`
     treats it like `requested` (stage 3, not done). `pickupAwaitingShelter()` is false on it, so
     the inbox pill clears. The inbox row shows "Asked for another time" in its place.
  3. **Foster: the declined card.** `MatchView`'s pickup card says *"{shelterName(dog)} asked for a
     different time"*, renders the note attributed (*From {shelter}*, or nothing if `null` — no
     stand-in), and reopens `PickupScheduler`. Reuse the confirmed/requested card's one class per
     this doc's standing note — no fourth phrasing of a pickup state.
  4. **Re-requesting clears the answer.** `requestPickup()` writes `pickupDeclinedAt: null` and
     `pickupNote: null` alongside the new slot. **Rules:** the foster pickup branch's `hasOnly`
     gains both keys, and the foster may set each **only to `null`** — the same shape as
     `pickupConfirmedAt`. A foster must never be able to write a note in the shelter's voice.
  5. **Care Plan waits for the shelter.** The start button's condition becomes `pickup ===
     "confirmed"` when an application exists, `Boolean(foster.pickup)` when none does; its `title`
     says *"Waiting for {shelter} to confirm pickup"*. The countdown callers pass the pickup date
     only under the same condition (Hub and Saved already can: Saved has `useApplication`, Hub adds
     it), so an unanswered request shows the total commitment, as before any pickup.

  **Not in scope:** staff proposing a specific counter-slot (the note carries it in words; a second
  writer of `pickup` is the drift RS-14 designed out); a foster *already* in `care_plan` on an
  unconfirmed request before this ships (no users — leave them); `get_foster` reporting confirmation
  (still true from RS-14); PH-31 (its own item). **Verify:** vitest — `pickupState` declined /
  declined-then-re-requested (`requested`) / declined-slot-mismatch (`requested`); a rendered
  `MatchView` case each for the start button disabled on `requested`, enabled on `confirmed`,
  enabled with no application, and the declined card with and without a note
  (`MatchView.test.tsx`'s `renderToStaticMarkup` pattern); `fosterWindow` callers not started on
  `requested`. `./node_modules/.bin/tsc -b`, build, lint at `main`'s 8. The rules change cannot be
  verified unattended — it joins **RS-14b** below as its step (6).

- [ ] **RS-16 — the import writes the shelter's listing, not the shelter's decisions (queued
  2026-09-28).** Found by reading a real run's output, not the code first: the 2026-09-28 weekly
  check reached sfspca.org (see "Where this stands") and planned `write 26`. `_push_to_firestore()`
  does that as `batch.set(collection.document(d["id"]), d)` (`scripts/import_dogs.py:210`) — a
  **whole-document replace** — and `sfspca.to_dog()` hard-codes `"status": "available"`. Since
  RS-6, RS-12 and PH-21, other writers put fields on those same scraped `dogs/{id}` documents that
  the scrape never carries: **staff** (`shelterRoster.ts:47` — `status` for retire / relist /
  adopted, plus `updatedAt`) and **the agent** (`adoption.py:150`, `:168` — `status:
  "ready_for_adoption"`, `adoption_profile`, `adoption_profile_source`; since RS-12 that write *is*
  the notification). So the first manual import after a foster finishes turns a **Back from
  foster** dog back into `available` and deletes the paragraph staff were meant to read; a dog
  staff retired or marked adopted reappears in Discovery and — through PH-31's `isListable()` —
  becomes appliable again. *Reasoned from the code, not observed:* nobody has run a writing import
  since RS-6, and an unattended run can't read production `dogs` to say whether any live document
  carries such a field today. With no users, probably none; the hazard is the next import.

  **Design answer (this run's question — who owns a field on a document two pipelines write?).**
  RS-10's *one writer per field*, applied to the dog: **the scrape owns what the shelter's public
  page says; Pawthway's writers own what happened inside Pawthway.** `status` on a document that
  already exists belongs to whoever last decided it, unless it is still `available`, which the
  scrape merely restates. `adoption_profile`, `adoption_profile_source` and `updatedAt` are never
  the scrape's. **Not `merge=True`:** PH-25 found `{ merge: true }` keeps keys a writer meant to
  remove, and a listing that stops stating a weight must lose `weight_lbs`, not keep the old one.
  So: build the scraped record, overlay the preserved keys off the snapshot already read at `:152`,
  and `set()` the result — no extra reads.

  1. `import_dogs.py`: `PAWTHWAY_OWNED = ("adoption_profile", "adoption_profile_source",
     "updatedAt")`, commented with the writer of each. In the write loop, a dog whose id is in
     `existing` gets those keys copied over when present, and keeps `existing[id]["status"]` when
     that is present and not `"available"`.
  2. The plan output gains `  keep status  n  {id: status, …}` (first 6), same shape as the `keep`
     lines above it, so whoever unticks *plan only* sees which decisions survive.
  3. Rider, `import-dogs.yml`: when an open `roster-drift` issue exists, `gh issue edit "$existing"
     --title "$TITLE"` before commenting. #96 is still titled *could not reach sfspca.org* under a
     comment saying it did.

  **Not in scope:** writing `status: "foster"` (a lead below); re-baking the roster and writing
  enrichment for the new dogs (a person's — RS-13b); `data/dogs.json` (it carries no
  Pawthway-owned field, so `--dry-run --from-cache` must produce it byte-identical). **Verify:**
  pytest in `tests/test_import_dogs.py` against PH-28's fake Admin client — a scraped dog live as
  `ready_for_adoption` with a profile keeps status, profile and source; one live as `retired` stays
  `retired`; one live as `available` is rewritten; a field absent from this scrape (`weight_lbs`)
  is **gone** afterwards; a new dog is written as scraped; `plan_only` writes nothing and prints the
  keep-status line. Existing importer tests green. The workflow rider is observable only on the
  next Monday run — say so in the row.

- **Everything through RS-14 is shipped; each Ledger row is its account.** RS-14's spec and design
  answer (*a model may talk about an organisation, never as one*) are in
  [`archive/real-data-and-shelters-rs14-2026-09-23.md`](archive/real-data-and-shelters-rs14-2026-09-23.md);
  its four named out-of-scope gaps became RS-15. The signed-in halves are under "Needs a human".

All of these ship to test accounts only until Sharang has actually spoken to a
shelter, per the section below.

- **The `[large]` slot is in this doc** (RS-14, then RS-15). Routing narrative in
  [`archive/real-data-and-shelters-routing-ledger-2026-09-22.md`](archive/real-data-and-shelters-routing-ledger-2026-09-22.md).

### Needs a human, not a queue item
- **RS-14b — PARKED at queue time (2026-09-22); the signed-in half of RS-14.** One sitting with
  RS-6b, RS-12b and RS-8. As a test foster with an application on `sfspca-mission`, request a
  pickup; then as the staff uid at `/shelter`, expect the row's "Pickup requested" pill and the slot
  in the detail, press **Confirm pickup**, and expect the foster's Match card to read confirmed.
  Then, as the foster, **Change request** and expect it back to requested. From the foster's
  console, `updateDoc` the application with a non-null `pickupConfirmedAt` and expect
  `permission-denied`. A denial on the foster's own request is a finding to queue, never licence to
  widen the rule. **Once RS-15 ships, (6):** as staff press **Ask for another time** with a note;
  expect the foster's card to show it attributed and Care Plan's start button disabled; from the
  foster's console, `updateDoc` with a non-null `pickupNote` and expect `permission-denied`.
  **Write down what happened.**


- **RS-13b — a runner with an address sfspca.org will answer.** RS-13 made the weekly check
  honest about not being able to look; it did not make it able to look, and no PR can. SF SPCA
  answers `200` to an ordinary connection with no `User-Agent` and `403` to GitHub-hosted runners,
  so the roster can only be checked on a cadence from a machine somebody owns — a self-hosted
  runner, or a scheduled re-bake on a laptop. Until then the drift signal is a person running
  `uv run python scripts/import_dogs.py --dry-run`, and the weekly issue says so in those words.
  **M4 is not closed by RS-13.** *2026-09-28: the runner got through once (see above), so the
  premise is now "intermittent", not "blocked" — one success is not a cadence.* The drift that run
  found is a person's to take: re-bake with `--dry-run`, write `data/enrichment.json` entries for
  the new dogs by hand, then untick *plan only* — **after RS-16 ships**, or the push resets every
  shelter- and agent-written status on the scraped dogs.

- **A lead, not an item (2026-09-28): nothing ever writes `status: "foster"`.** `DogStatus` has the
  value and `rosterActions` handles it, but no screen, tool or script sets it — so a dog whose
  pickup the shelter confirmed stays `available`, listed, and appliable by a second foster. RS-15
  makes the confirmation the handoff, which is where this belongs; RS-16 is what keeps it from
  being reset. Queue it once both ship, sized against whatever RS-15's row says.

- **RS-9 and RS-5b — DONE, with Sharang present (2026-08-29, 2026-09-04)**; Ledger rows are the
  account. **Three `fixture-` applications are still in production**; re-running
  `scripts/seed_test_applications.py` resets rather than duplicates.

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

*(Status re-checked **2026-09-28**, not carried over: `git log --since=2026-09-22` is this
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

- **2026-08-24 → 2026-09-05 — M1, RS-1, RS-3, RS-2, RS-7, RS-9, RS-5, RS-6 `[large]`, RS-10 `[large]`,
  RS-11 `[large]`, RS-5b, RS-12 `[large]` — PRs #6/#13/#14, #21, #24, #34, #38/#39, #52, #54, #56,
  #58/#59, #63. Compressed 2026-09-28; verbatim in
  [`archive/real-data-and-shelters-ledger-2026-09-28.md`](archive/real-data-and-shelters-ledger-2026-09-28.md).**
  Invariants a regression would break: staff-ness by `array-contains`; `dogs` create/update pinned to
  the staff's `shelter_id`, `delete: if false`; the importer never deletes a hand-entered or matched
  dog; checklist halves joined by `owner`, **never mirrored**; `activeApplication(foster, status)`
  with the second argument required; RS-12's `adoption_profile` renders under **Back from foster**
  and *is* the notification (discharging PH-1).
- 2026-09-09 → 2026-09-23 — RS-4 (PR #72), RS-13 (PR #88), RS-14 `[large]` (PR #102). **Compressed
  2026-09-28; verbatim in
  [`archive/real-data-and-shelters-ledger-2026-09-28.md`](archive/real-data-and-shelters-ledger-2026-09-28.md).**
  RS-4 made the roster check weekly and plan-only by construction; RS-13 made it able to say *could
  not look* (`EXIT_UNREACHABLE = 75`, including a zero-dog scrape). RS-14 wrote the pickup request
  to `applications/{id}` *before* the foster document, admitted a third foster rules branch
  (`pickup`/`pickupConfirmedAt`/`updatedAt` via `affectedKeys().hasOnly`, the stamp only as `null`),
  and made *confirmed* need the staff stamp **and** matching slots; beyond its spec it removed a
  third "agree the day" in `calendar.ts`'s `.ics` and a prompt claim that the agent could change a
  pickup. None of it verified signed in or in a browser — that is RS-14b.
