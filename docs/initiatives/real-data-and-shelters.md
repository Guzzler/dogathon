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
- **2026-09-17 → 09-28 — the weekly roster check is honest, and has now looked once.** It 403'd
  from GitHub's runners on 09-14 and 09-21 (RS-13 turned that into issue **#96**, *freshness unknown*),
  then reached sfspca.org on **2026-09-28** (run `36403398124`): 26 dogs scraped against 19 committed,
  plan `write 26` / `delete 11` / `keep 2`. **The 403 is intermittent, not structural**, the roster has
  turned over by more than half, and the `write 26` is a whole-document replace over fields other
  writers own — **RS-16**. Dated history verbatim in
  [`archive/real-data-and-shelters-2026-09-30.md`](archive/real-data-and-shelters-2026-09-30.md).

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

- [ ] **RS-21 — PROPOSED by execute's audit, 2026-10-08: ages render as decimal years.** The
  shelter publishes *"11 y, 1 m"*; `parse_age_years()` (`scripts/shelters/sfspca.py:183`) stores
  `11.08`, and `normalizeDog()`'s `ageLabel` (`web/src/lib/dog.ts:105-110`) prints it raw — the
  deployed dog profile, card and public adoption page all read *11.08 yrs*. 14 of the 19 committed
  dogs carry a fractional age. Render whole years plus months (*11 yrs 1 mo*), keep `age_years` as
  stored; a `dog.test.ts` case per branch. Small; a rider candidate.

- [x] **RS-20 `[large]` — a dog off the roster is not a pickup to confirm, and its applicants are
  told (queued 2026-10-02, shipped the same day).** A `retired` or `adopted` dog's live application
  offers no **Confirm pickup** or **Ask for another time** in the inbox, its row reads *Dog not
  listed*, **Retire** / **Mark adopted** say how many applications stay open, and the foster's Match
  and Saved state the listing with no scheduler. Design answer (*staff's earlier decision about a
  listing outranks a request made against it*) and spec verbatim in
  [`archive/real-data-and-shelters-rs20-2026-10-02.md`](archive/real-data-and-shelters-rs20-2026-10-02.md);
  the Ledger row is what shipped. Signed-in half is RS-14b's step (10).

- [x] **RS-18 `[large]` — one dog, one confirmed pickup, and the other applicants are told (queued
  2026-09-30, shipped 2026-10-01).** Once staff confirm one foster's pickup, every other live
  application on that dog loses **Confirm pickup** in the inbox and says who has the dog; its row
  carries *Dog placed with another foster*; the other foster's Match and Saved say the dog is in
  another home without reading as a decline. Design answer (*confirming one pickup makes the others
  answerable, not answered*) and spec verbatim in
  [`archive/real-data-and-shelters-rs18-2026-10-01.md`](archive/real-data-and-shelters-rs18-2026-10-01.md);
  the Ledger row is what shipped. Signed-in half is RS-14b's step (9).

- [x] **RS-19 — the original holder's *Change request* is not "another foster home" (queued
  2026-10-01, shipped the same day inside RS-18's PR).** RS-18's foster-side notice states the
  listing (*{dog} is listed as in a foster home at {shelter}…*) and withholds nothing, because the
  holder after **Change request** is indistinguishable from another applicant. Design answer (*the
  foster side may say only what it can read*) and spec verbatim in
  [`archive/real-data-and-shelters-rs18-2026-10-01.md`](archive/real-data-and-shelters-rs18-2026-10-01.md).

- [x] **RS-15 `[large]` (2026-09-28), RS-16 (2026-09-30), RS-17 `[large]` (2026-09-29) — shipped;
  compressed 2026-10-01.** In one line each, design answer first: **RS-15**, *only the party that
  answers a request can turn it into a fact* — **Ask for another time**, Care Plan waits for the
  shelter ([spec](archive/real-data-and-shelters-rs15-2026-09-28.md)); **RS-16**, *the scrape owns
  what the shelter's page says, Pawthway's writers own what happened inside Pawthway* — the import
  overlays Pawthway-owned keys ([spec](archive/real-data-and-shelters-rs16-2026-09-30.md));
  **RS-17**, *a dog's listing is a field with an owner, and the owner is whoever answers the request
  that changes it* — confirm/unconfirm/decline batch `dogs/{id}.status`
  ([spec](archive/real-data-and-shelters-rs17-2026-09-29.md)). Ledger rows are what shipped.

- **Everything through RS-14 is shipped; each Ledger row is its account.** RS-14's spec and design
  answer (*a model may talk about an organisation, never as one*) are in
  [`archive/real-data-and-shelters-rs14-2026-09-23.md`](archive/real-data-and-shelters-rs14-2026-09-23.md);
  its four named out-of-scope gaps became RS-15. The signed-in halves are under "Needs a human".

All of these ship to test accounts only until Sharang has actually spoken to a
shelter, per the section below.

- **The `[large]` slot is in this doc** (RS-14, RS-15, RS-17, RS-18, RS-20 — shipped 2026-10-02;
  **empty again** until plan names the next). Routing narrative in
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
  **(9), once RS-18 ships:** with a second test foster applied to the same dog, confirm the first's
  pickup; expect the second's row to carry *Dog placed with another foster*, its detail to offer no
  **Confirm pickup**, and the second foster's Match card to say the dog is listed as in foster
  (RS-19's wording) with the scheduler still there. Then, as the *first* foster, **Change request**
  and expect no line claiming the dog is in another home. **(10), once RS-20 ships:** retire a dog
  with a test foster's live application on it; expect the inbox to offer no **Confirm pickup**, the
  foster's Match to say the dog isn't listed with no scheduler, and both back after **List again**. **Write down what happened.**


- **RS-13b — a runner with an address sfspca.org will answer.** RS-13 made the weekly check
  honest about not being able to look; it did not make it able to look, and no PR can. SF SPCA
  answers `200` to an ordinary connection with no `User-Agent` and `403` to GitHub-hosted runners,
  so the roster can only be checked on a cadence from a machine somebody owns — a self-hosted
  runner, or a scheduled re-bake on a laptop. Until then the drift signal is a person running
  `uv run python scripts/import_dogs.py --dry-run`, and the weekly issue says so in those words.
  **M4 is not closed by RS-13.** *2026-09-28: the runner got through once (see above), so the
  premise is now "intermittent", not "blocked" — one success is not a cadence.* The drift that run
  found is a person's to take: re-bake with `--dry-run`, write `data/enrichment.json` entries for
  the new dogs by hand, then untick *plan only* — **safe since RS-16 shipped (2026-09-30)**; before it, the push reset every
  shelter- and agent-written status on the scraped dogs.

- **RS-17's two leads (2026-09-29), verbatim in
  [`archive/real-data-and-shelters-2026-09-30.md`](archive/real-data-and-shelters-2026-09-30.md).** (a) is now **RS-18 `[large]`**.
  (b) **A foster who uses *Change request* after confirmation and then withdraws** leaves the dog
  `foster` with no notice (the change cleared the stamp the notice keys on). The roster's *In foster*
  group still offers **List again**, so it is recoverable, not lost — still a lead, not an item.
  *2026-10-01: the same erased stamp is what RS-19 turns on — the half of (b) that reaches a foster's
  screen is now queued; the orphaned `foster` listing itself is still only a lead.*

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

*(Status re-checked **2026-10-02**, not carried over: `git log --since=2026-09-22` is this
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
- 2026-09-29 — RS-17 `[large]` — PR #110 — The listing follows the handoff: `handoffStatus()` in
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
- 2026-09-30 — RS-16 — PR #111 — The import writes the shelter's listing, not the shelter's
  decisions: `PAWTHWAY_OWNED` (`adoption_profile`, `adoption_profile_source`, `updatedAt`) plus
  `_decided_status()` / `_preserve_decisions()` in `scripts/import_dogs.py` overlay the live
  document's Pawthway-owned keys onto the scraped record, then `set()` it whole — so a key the
  scrape stopped stating is still dropped (no `merge=True`). The plan gains `keep status  n  {…}`.
  Rider: `import-dogs.yml` retitles the open `roster-drift` issue to this week's outcome before
  commenting. pytest 83 (seven new, against PH-28's fake client, including one pinning that
  `data/dogs.json` carries no Pawthway-owned key); `--dry-run --from-cache` re-bake byte-identical.
  **Not verified against live Firestore** (no writing import run, as required), and the retitle is
  observable only on the next Monday run — #96 should then carry this week's title.
- 2026-10-01 — RS-18 `[large]` + RS-19 — PR #114 — One dog, one confirmed pickup: `pickupHolder()` /
  `heldByAnother()` / `placedElsewhere()` / `isLive()` in `applicationView.ts`, all pure. The inbox
  detail drops **Confirm pickup** when another live application holds the stamp and shows *{dog} is
  going home with {holder}* (the name a button that selects that row) under **Pickup**, in place of
  RS-17's *won't change that*; **Ask for another time** and the status buttons stay. Match withholds
  nothing: per **RS-19** (queued by plan mid-build, PR #113, and folded in here so the stranding
  version never deployed) Match and Saved say *{dog} is listed as in a foster home at {shelter}* and
  keep the scheduler and **Change request**. **Two choices the spec left open:** the row pill *replaces*
  *Pickup requested* / *Asked for another time* rather than sitting beside them, since *requested*
  invites the one action the row no longer has; and it reuses `shelter__pill--dog` (no new pill
  modifier), with one new `.shelter__link` rule for the holder's name. A legacy double-confirmed
  pair still shows **Undo confirmation** on both — the line says which to take back. vitest 237
  (11 new), tsc, build, lint 8 (unchanged); `another foster home` appears nowhere outside tests.
  **Not verified signed in or against Firestore** — RS-14b (9).
- 2026-10-02 — RS-20 `[large]` — PR #116 — A dog off the roster is not a pickup to confirm:
  `offRoster()` (`retired`/`adopted` only) and `unlisted()` in `applicationView.ts`, pure. Inbox detail
  drops **Confirm pickup** and **Ask for another time** for an unconfirmed live application on an
  off-roster dog and says so; RS-17's *won't change that* now shows for `medical_hold` (and the
  other in-progress statuses) only; the row pill *Dog not listed* reuses `shelter__pill--dog` via a
  new `PickupPills` row component. `ShelterRosterView` subscribes to applications once and shows
  *{n} open application(s)* beside **Retire** / **Mark adopted** (one new `.shelter__open-note`
  rule). Match and Saved say *{dog} isn't listed by {shelter} right now* and hide the scheduler,
  the locked request button and **Change request**; an existing request stays as a read-only card.
  **Three deviations from the spec:** (1) `adopted` is terminal on the roster (`rosterActions`
  offers nothing), so the inbox line for it says *there's no pickup to confirm* rather than
  *Relist it*, which the roster can't do; `retired` says *List it again*, the roster's own label.
  (2) Match has no **Withdraw** button (it lives in Saved), so Match's notice points at Saved
  rather than rendering one. (3) The inbox gate excludes a pickup already confirmed (it keeps
  **Undo confirmation**), the confirmed-holder case the spec put out of scope — but `unlisted()`
  as specified still tells a confirmed holder of a *retired* dog, and Care Plan's start button
  stays enabled for them: lead (b)'s family, noted not fixed. vitest 252 (15 new), tsc, build,
  lint 8 (unchanged). **Not verified signed in or against Firestore** — RS-14b (10).
