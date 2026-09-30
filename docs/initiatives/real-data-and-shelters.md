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
  round trip shipped 2026-09-23 (RS-14); the shelter's second answer shipped 2026-09-28 (RS-15).** Staff sign in with the existing Google auth, see their own shelter's
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

- [x] **RS-17 `[large]` — the listing follows the handoff (queued 2026-09-29, shipped 2026-09-29).**
  Staff's answers in the inbox now move the dog in the same `writeBatch`: **Confirm pickup** takes an
  `available` dog to `foster`; taking the confirmation back or declining puts it back. Design answer
  (*a dog's listing is a field with an owner, and the owner is whoever answers the request that
  changes it*) and spec verbatim in
  [`archive/real-data-and-shelters-rs17-2026-09-29.md`](archive/real-data-and-shelters-rs17-2026-09-29.md);
  the Ledger row is what shipped. Signed-in half is RS-14b's step (8).

- [x] **RS-15 `[large]` — the handoff happens on the shelter's say-so (queued 2026-09-27, shipped
  2026-09-28).** Staff got a second answer, **Ask for another time** with an optional attributed
  note; Care Plan and every countdown wait for the shelter's confirmation. Spec and design answer
  (*only the party that answers a request can turn it into a fact*) verbatim in
  [`archive/real-data-and-shelters-rs15-2026-09-28.md`](archive/real-data-and-shelters-rs15-2026-09-28.md);
  the Ledger row is what shipped. Signed-in half is RS-14b's step (6).

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

- **The `[large]` slot was in this doc** (RS-14, RS-15, RS-17 — **RS-17 shipped 2026-09-29, so it is
  empty** until plan refills it; RS-17's leads above are the first place to look). Routing narrative in
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
  **(7), RS-15's create half:** as a foster, `addDoc` an application carrying a non-null
  `pickupNote` (or `pickupConfirmedAt`) and expect `permission-denied`; then apply normally and
  expect it to land — `createApplication` writes all three as `null`, which the rule admits.
  **(8), once RS-17 ships:** as staff, confirm a pickup — expect the dog gone from foster-side
  Discovery and under *In foster* on `/shelter/dogs`; take the confirmation back, expect it listed again.
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

- **Leads RS-17 left (2026-09-29), each still true when it shipped.** (a) **Other fosters' open
  applications on a dog that just went `foster`** stay `submitted`, and the inbox shows them as if
  the dog were free — a closing-the-others design, not a status write. (b) **A foster who uses
  *Change request* after confirmation and then withdraws** leaves the dog `foster` with no notice:
  the change cleared the application's `pickupConfirmedAt`, which is what the withdrawn-row notice
  keys on (deliberately — without it, any withdrawn row would offer to relist a dog another foster
  holds). The roster's *In foster* group still offers **List again**, so the dog is recoverable, not
  lost. SF SPCA's `in_foster_home` prose flag stays unconflated with `status`, as specified.
- **A lead, not an item (2026-09-28, found building RS-15): the foster's *withdraw* branch of
  `applications`' update rule pins five fields but has no `hasOnly`**, so a withdrawing write may
  also set `pickupNote`/`pickupConfirmedAt`/`pickupDeclinedAt`. On a withdrawn row nothing staff
  read renders them (`canConfirmPickup` is false), so the harm today is the foster's own screen;
  closing it is a rules tightening that deserves its own item and its own RS-14b-style check.

- **RS-9 and RS-5b — DONE, with Sharang present (2026-08-29, 2026-09-04)**; Ledger rows are the
  account. **Three `fixture-` applications are still in production**; re-running
  `scripts/seed_test_applications.py` resets rather than duplicates.

- **RS-6b, RS-12b, RS-8 — parked, each a signed-in check for the same sitting as RS-14b.** Full
  steps verbatim in
  [`archive/real-data-and-shelters-rs15-ledger-2026-09-29.md`](archive/real-data-and-shelters-rs15-ledger-2026-09-29.md);
  read them there before acting. In one line each: **RS-6b** (read half done 2026-09-04) — add a dog
  with no photo and expect a paw tile, retire it, then expect `permission-denied` rewriting its
  `shelter_id`; **RS-12b** — a `ready_for_adoption` dog renders under *Back from foster* with the
  whole profile, **List for adoption** relists it, **Mark adopted** leaves no button; **RS-8** — the
  seeded staff uid sees the dashboard at `/shelter`, any other account sees the *isn't on a
  shelter's staff list* copy. A denial in any of them is a finding to queue, never licence to widen
  `firestore.rules`. **Write down what happened.**

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

*(Status re-checked **2026-09-29**, not carried over: `git log --since=2026-09-22` is this
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
- 2026-09-28 — RS-15 `[large]` — PR #108 — The handoff happens on the shelter's say-so: staff's
  **Ask for another time** (`askForAnotherTime()`, optional note ≤ 200 or `null`, slot left in place),
  `pickupState()`'s `declined`, and `agreedPickup(fosterPickup, application, loading)` gating Care
  Plan and anchoring Hub's and Saved's countdowns. Beyond the spec: `loading` as a third input (a
  loading application must not unlock Care Plan), `setPickupConfirmed` clears a decline, and the
  `create` rule requires all three answer fields null. vitest 211, tsc, build, lint 8; rules **not**
  verified against Firestore (RS-14b (6)–(7)). Full row verbatim in
  [`archive/real-data-and-shelters-rs15-ledger-2026-09-29.md`](archive/real-data-and-shelters-rs15-ledger-2026-09-29.md).
- 2026-09-29 — RS-17 `[large]` — PR #__ — The listing follows the handoff: `handoffStatus()` in
  `shelterDog.ts`; `setPickupConfirmed`, `askForAnotherTime` and `setApplicationStatus` take the dog
  and batch `dogs/{id}.status` with the application update; the inbox's muted *won't change that*
  line beside **Confirm pickup**, and a withdrawn-after-confirmation notice with **List again**;
  `rosterActions("foster")` is `["relist", "retire"]` and the roster has an **In foster** group.
  **One deviation from the table:** `handoffStatus` takes a third input, `confirmedHere` — *unconfirm*
  and *decline* relist only when this application held the confirmation, since otherwise declining
  one foster's application (or asking for another time on an unagreed slot) would relist a dog a
  different foster holds; the withdrawn notice likewise needs the application's own stamp. The
  foster's withdraw call passes no dog. vitest 226 (new `ShelterApplicationsView.test.tsx`), tsc,
  build, lint 8. **Not verified against Firestore or signed in** — RS-14b (8).
