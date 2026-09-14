# Pawthway Initiatives (toward a real app)

**Created 2026-08-24** as the anchor for two scheduled routines — `dogathon-plan`
(directs) and `dogathon-execute` (builds) — the same plan/execute loop already
running for two other projects, adapted to what's actually true about *this*
repo. This directory is where "make it real" gets tracked. It is not a
replacement for [`docs/shelter-integration.md`](../shelter-integration.md) or
[`docs/real-data-sourcing.md`](../real-data-sourcing.md) — those stay as
**evidence docs**: dated research and design that don't get rewritten, only
cited. The initiative docs below turn their recommendations into an actual
queue with dates and ledger rows.

## How the loop works — and the one way it differs from the pattern it's copied from

- **plan** reads the state of the real repo (not memory of an earlier
  session) and the deployed app, verifies each initiative's open assumptions
  against actual code, advances one design question per run, and keeps each
  initiative's **Task queue** at 2–4 open, dated, concrete items (exact
  files, commands, verification steps — so execute never has to guess what
  was meant).
- **execute** works the queues top-down, **up to 3 atomic PRs per run**,
  checking its item off and adding a **Ledger** row in the same PR as the
  code.
- Queue empty → execute runs an audit pass against the **deployed app**
  (`https://pawthway-hackathon.web.app`, not local) and files findings as
  proposed queue items instead of inventing work.

**Every change here goes through a PR — plan's doc edits included.**
`main` is protected with `enforce_admins: true` and zero direct-push
exceptions (verified 2026-08-23 by testing an empty commit push from the
owner's own account — it was rejected: *"Changes must be made through a pull
request"*). That is stricter than the pattern this loop is copied from, where
the planning task pushes doc edits straight to `main`. Here, **plan opens a
small PR for its own doc-only edits** (branch `docs/initiative-<slug>`,
title prefixed `docs(initiatives): ...`), waits for the two required checks
(`frontend`, `backend` — both pass automatically on a docs-only diff since
neither job touches `docs/`), and merges it itself: `required_approving_review_count`
is 0, so nothing is waiting on a human. execute does the identical thing for
code. If this ever changes (protection loosened, or tightened further to
block even PR merges without a human), `gh api repos/Guzzler/dogathon/branches/main/protection`
is the source of truth — read it, don't assume this paragraph still holds.

## Active initiatives (priority order)

**Re-ranked 2026-08-31.** `production-hardening` held the top slot from
2026-08-24, when it was genuinely the emergency: an unauthenticated agent, no
spend ceiling, sessions that died on deploy. All of that is now shipped. What
the ranking produced afterwards was a treadmill — PH is an endless source of
small, tidy, headlessly-verifiable items, and because execute works the queues
top-down, those items consumed every run. The evidence is unambiguous: of the
ten code PRs from #36 to #49, **eight were production-hardening** and the other
two were RS-7, a one-line deploy-target fix plus its follow-up. Over the same
week, RS-5 — the shelter's application inbox, ungated since 2026-08-28 — was
never started. On 2026-08-30 plan queued three fresh PH items and execute spent
its entire next run on them (#47, #48, #49), pushing RS-5 to a fifth idle day.

Nothing was wrong with any individual item. The ordering was wrong. So:

1. [`real-data-and-shelters.md`](real-data-and-shelters.md) — the actual growth
   path, and now the top priority: the shelter's application inbox, the
   add/retire-a-dog surface, and keeping the roster current at near-zero cost.
   This is what turns "an app with fake data" into "an app one real shelter
   actually uses", and it is the only one of the three whose items are the
   product rather than the scaffolding around it.
2. [`design-consistency.md`](design-consistency.md) — keeping the visual
   language coherent as more surfaces get built, ideally enforced by something
   CI checks rather than something plan has to remember to look for. Promoted
   above production-hardening on 2026-08-31 because DC-5 (letting the foster side
   breathe on a wide screen) was real product work on a surface people actually
   see, and because a live incident (PR #11) is why this doc exists at all.
   DC-5 shipped 2026-09-05 (PR #65); the promotion still holds, because the
   incident that replaced it as this doc's `[large]` item — DC-7, two selectors
   in two files resolving a live screen by import order — is the same failure
   mode found a second time, in a different place, in code that ships today.
3. [`production-hardening.md`](production-hardening.md) — the trust and
   correctness debt: a tool that claims to notify a shelter and doesn't, and the
   verification errands that keep accumulating. Still genuinely valuable, still
   not urgent — the silent failures it was ranked first for (the auth hole, the
   uncapped spend, sessions lost on deploy, an account deletion that left data
   behind) have all shipped. **Take from this doc when the two above have
   nothing open**, or when something here is a prerequisite for something there.

## How big a queue item should be

The ranking above fixes *what* gets built. This fixes *how much*.

- An item may be marked **`[large]`** — a whole screen, a whole flow, a
  milestone. execute treats one `[large]` item as a **complete run**: many files,
  no line budget, shipped as one coherent PR rather than split into pieces that
  leave the repo half-working.
- **At least one open `[large]` item should exist across the three docs at all
  times**, sitting at the top of the highest-priority doc's queue. If plan can't
  name one, that is a finding to write down, not a reason to queue four small
  ones.
- Three small PRs is not a better run than one real screen. The old rule ("up to
  3 per run, under ~400 lines") optimised for what is easy to finish and easy to
  verify unattended, which is exactly how the treadmill above formed.

## Nobody uses this app yet, and that changes what is worth doing

There are no shelter partners and no real fosters. The "zero documents in the
`applications` collection" that used to anchor this section **is no longer true** —
RS-5b seeded three `fixture-` rows on 2026-09-04 with Sharang present, and a real staff
account read and wrote them. That changes one thing and not the other: a verification
that needed a document to exist is now cheap, but there is still nobody using this app.
Two consequences that plan should apply rather than re-derive:

- **Building beats confirming.** An item whose value is *verifying* something
  already built ranks below one that *builds* the next missing surface. There is
  no user for whom the unverified thing is currently broken.
- **Verification gates that need a signed-in human are parked, not queued.**
  RS-8, PH-13 and PH-15b are all of this shape, and they accumulate faster than
  anyone clears them — PH-15 and PH-16 generated PH-15b on the same run that
  shipped them. Park them under "Needs a human" with a note, and stop treating
  the growing pile as a to-do list. When there is a real shelter and real data,
  these get cleared in one sitting, and several of them will have answered
  themselves by then.
- One that was cheap enough to just do: **PH-7c is discharged** — `/health` on
  the deployed Cloud Run agent returns `firestore_reachable: true` (checked
  2026-08-31). It needed no sign-in, which is precisely why it was clearable.

## The `[large]` slot, and an empty queue that stays empty (2026-09-01)

Both rules above got exercised on the same run, so the outcome is worth recording
rather than re-derived.

**The fallback chain, in cost order — read the queue, then re-read the gated notes, then
measure.** It was established one run at a time between 2026-09-01 and 2026-09-07; the full
seven-entry log is verbatim in
[`archive/readme-large-slot-2026-09-09.md`](archive/readme-large-slot-2026-09-09.md).
Compressed:

- **2026-09-01 / 09-02 / 09-03 — read the queue.** Three runs running, the `[large]` slot was
  filled by a **label**, not an invention: RS-6, then RS-10, then RS-11, each already big and
  merely unmarked. Treat "there is no `[large]` item" as a prompt to re-read the queue first.
- **2026-09-04 — re-read the gated notes.** RS-4 was genuinely small and nothing in the queue
  was big, because M3's surfaces were built. The item came from a *note* whose gate had
  quietly opened: PH-1 had said since 2026-08-24 that a real notification path was
  "downstream of M3", and M3 finished while nobody re-read the sentence. **A parked item
  whose gate opened is the cheapest place a `[large]` one hides.**
- **2026-09-05 — the slot may leave the top doc, and saying so beats inventing.** Both
  fallbacks came back empty because M3 is finished and M5 is gated on a real shelter — a
  human, not code. The slot went to DC-5 in the second doc. **The top doc had run out of
  buildable work, not out of work**; re-ranking would have been wrong, and routing one run is
  not a re-rank.
- **2026-09-06 — measure.** Every `className` under `web/src` against every selector in the
  stylesheets found DC-7: two selectors in two files at identical specificity resolving a live
  screen by import order. The third link is the most expensive and the only one that finds
  work nobody has written down.
- **2026-09-07 — a measurement is evidence, not a fact.** Re-measuring found DC-7's own claim
  wrong: it enumerated one file's imports and missed the repo's largest stylesheet, and the
  false claim had already shipped into a working doc. **Enumerate the import graph, not one
  file's imports** — and the cheapest place to find a wrong measurement is the section the
  last run just wrote. This loop's own prior output is the first thing step 2 should verify.

- **2026-09-08 — measuring found the slot a third time, and corrected the *method*, not the
  sample.** DC-10 came from measuring every class selector in all four stylesheets against every
  `className` under `web/src`, prefix-aware. The finding that made it a correction: **four of the
  six media-query blocks DC-8 had re-homed the day before target classes no component renders** —
  DC-8 had verified against a hand-built harness, and a harness containing dead classes reports
  geometry for them exactly as convincingly as for live ones. So the 2026-09-07 lesson gains a
  second half: **what you measured against is part of the claim**, and where a static diff can
  prove the thing, prefer it over anything you had to build to observe it. Later the same day
  DC-10 shipped and **emptied the `[large]` slot everywhere**, with the prediction — borne out
  the next run — that three consecutive runs of measuring CSS had consumed the dead CSS there
  was, so the next slot would have to come from somewhere else.
- **2026-09-09 — the fourth link: measure something that isn't CSS, and the slot lands in the
  *third* doc.** Measuring **content provenance** — every module supplying data to
  `buildAdoptionProfile`, traced back to where the data is written — produced **PH-17**. Three
  things generalise: **the measurable surface is not only CSS** (enumerate what the code
  *claims*, then trace each claim to its source); **the slot may sit in the lowest-ranked doc**,
  which is routing for one run and not a re-rank; and **an empty higher queue can be the correct
  queue**, because execute works top-down and anything queued above would be picked first — the
  anti-treadmill rule arriving from the other direction. A fourth, smaller: DC-10's parting lead
  named fifteen `theme.css` classes as unreferenced and **eleven were live**.
  Both entries verbatim in
  [`archive/readme-large-slot-2026-09-11.md`](archive/readme-large-slot-2026-09-11.md).

- **2026-09-10 — the slot was not sought; the run's work was checking the one that exists** —
  and that is where **"a spec is a measurement too"** comes from: re-verify a queue entry
  before someone spends a run on it, not only after it ships. Applied to PH-17 it found a spec
  that named two write paths where there were four and three files where there were four, so
  the defect would have survived its own fix. Archived verbatim on 2026-09-12 in
  [`archive/readme-large-slot-2026-09-12.md`](archive/readme-large-slot-2026-09-12.md), because
  the two entries below are now its third, fourth, fifth and sixth restatements.
- **2026-09-11 / 09-12 — the fifth and sixth links, and both are the fourth link pointed at a
  second consumer.** PH-19 came from tracing every value in `buildAgentBrief`'s output back to
  where it is written; PH-20 came from asking the same of `generate_adoption_profile`, which was
  PH-19's own parting lead. Three things survive compression: **a method is reusable against a
  second consumer, and that is cheaper than inventing a new one**; **a lead is a measurement
  too, and half of PH-19's was wrong** (the Match prompts pass the tense test — a result, not a
  non-finding); and **re-verifying the queue entry, not only the shipped claim, paid for itself
  six consecutive runs** — against PH-18 it found a fix that would have re-introduced its own
  defect, then a spec that could not be built as written because no shelter record in this app
  carries a phone number. Both entries verbatim in
  [`archive/readme-large-slot-2026-09-13.md`](archive/readme-large-slot-2026-09-13.md).

- **2026-09-13 — the seventh link, and it is the sixth pointed at the lead the sixth left.**
  PH-20 shipped the day it was queued (#79), emptying the slot everywhere and again leaving
  PH-18 as the only open item. Chain run in full: queue holds nothing big, all six gated notes
  still gated on a *person* (RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b — re-read, unchanged),
  then **measure** — PH-20's own parting lead, which is the third consecutive run of pointing
  the last method at another consumer rather than inventing one. It produced **PH-21**, and the
  slot sits in the third doc for a fifth consecutive run. Two things generalise:
  - **A lead that names a missing write path can be hiding a missing read path, and the read
    path is why nobody noticed.** The lead said the agent-written adoption paragraph cannot be
    retracted. True — and the reason it has never mattered is that **no foster has ever seen
    one**: its only reader anywhere in the frontend is `ShelterRosterView.tsx:236`, so neither
    the foster who could say it is wrong nor the adopter it was written for is shown it. A
    retraction button on a paragraph nobody can read is not a fix. **When a lead describes
    something a user cannot do, check first whether they can see the thing they cannot do it
    to.**
  - **Consolidating beats compressing once a doc has one rule told four ways.**
    `production-hardening.md` went 386 → 437 with this run's additions and came back to **389**
    — under for a second consecutive run — mostly by merging four sections (PH-17's, PH-19's,
    PH-20's and the tense test's) into one that states the rule four times and preambles it
    once. That is the 2026-09-12 "cut the layer that points at a layer" rule finding its next
    shape: when several layers each point at a *different* archive but say the same thing,
    the cut is a merge, not a deletion. Also cut: six rounds of line-drift narration on PH-18's
    entry, rewritten as the spec that now stands plus the three corrections still live.

## What's already decided, so plan doesn't re-litigate it

- **Data sourcing is offline, reviewed, and committed — not a live pipeline.**
  `scripts/import_dogs.py` scrapes SF SPCA once, a human writes the
  descriptions into `data/enrichment.json` by hand, and the result is
  committed and later pushed to Firestore with `--plan`/no-dry-run. Nothing
  calls out at runtime, so there is no per-user cost and nothing can fail on
  stage. This **is** the low/no-cost update mechanism the product needs —
  the open work is running it on a cadence and against more than one
  shelter, not inventing a different pipeline. See
  `real-data-and-shelters.md` §M2.
- **Petfinder's API is gone** (shut down Dec 2025, confirmed by DNS lookup,
  not secondhand reporting — `real-data-sourcing.md`). Don't propose it.
- **The agent is authenticated** (PR #9, merged and verified live: the exact
  attack that used to leak a foster's name and address now returns 401).
  Don't re-propose "add auth to the agent" as a queue item — it's done.
  What's still open from that era is session *durability*, tracked in
  `production-hardening.md`.
- **Applying requires an account; browsing doesn't.** Confirmed product
  decision (2026-08-23, interactive with Sharang). A guest can look at dogs
  and read shelter info with zero setup; every surface that talks to the
  agent sits behind applying, so every agent call is authenticated by
  construction. Don't propose an anonymous-auth path.
- **Both sides are device-agnostic** (Sharang, 2026-08-26). Pawthway should be
  a good phone app *and* a good web app, for fosters and for shelter staff.
  The shelter side is built responsive from the start and outside the 430px
  `.phone` frame (`real-data-and-shelters.md`, RS-2/RS-5/RS-6); the foster
  side gets there separately via DC-5 in `design-consistency.md`. This
  unparked the `.shell`/`.phone` restructure that `design-consistency.md` had
  reserved for a Sharang decision — don't re-park it, and don't read it as
  licence for a desktop-first redesign of the foster journey.
- **Staff-ness is resolved by an `array-contains` query, not a document read**
  (2026-08-26). `shelters/{id}`'s read rule denies non-staff, and a missing
  doc denies identically, so `getDoc` can't distinguish "not staff" from
  "no such shelter" — two states wanting different screens. The query form
  makes the distinction structural and needs no rules change.
  Full reasoning in `real-data-and-shelters.md`; don't re-derive it, and
  don't "fix" it by loosening `firestore.rules`.
- **Guest→account migration — shipped 2026-08-26 (PH-5, PR #29), and the
  original framing of it was wrong.** This entry used to say the gap existed
  "because `linkWithCredential` was never wired up." There was never an
  anonymous Firebase Auth session to link: a guest is pure `localStorage`
  (`web/src/lib/localMode.ts`). The fix copies that local state into
  `fosters/{uid}` on first sign-in instead. Kept here rather than deleted
  because the `linkWithCredential` framing appears in the evidence docs too
  and is worth not re-deriving.

## Doc size

Keep each initiative doc's **working core** — context plus the Task queue — under roughly 250
lines, and the whole doc under ~400. When a run's own edits push a doc past that, archive **in
the same PR** (`docs/initiatives/archive/<doc>-<slug>-<date>.md`, verbatim snapshot), then
compress what you took to one dated line pointing at it. Not on the next run — production-
hardening crossed the line *because of* the 2026-08-29 refill, and archiving in the same PR is
what kept the working doc at 347 instead of merging a 420-line version for someone to notice
later.

**`archive/` holds 42 files as of 2026-09-13** — counted with `ls`, because the running tally
this sentence used to carry had drifted from the directory (it read "twenty-eight" on
2026-09-10, when a count would have said thirty-five). **Count it, don't increment it** — and
the sentence itself proved the point a second time on 2026-09-13, when it was found carrying
two contradictory parentheticals about how many the *previous* run had added. This run added
two: one from `production-hardening.md` and one from this file. The eleven-entry narration of which doc was
how many lines on which date is now in
[`archive/readme-docsize-2026-09-10.md`](archive/readme-docsize-2026-09-10.md) — archived for
exactly the reason the `[large]` slot log was archived the run before, which is the rule
directly below. What that narration established, and what is worth keeping here:

- **The Ledger is the first place to look when a doc is over, not the last** (2026-08-30). Both
  docs went back over 400 within two days of archiving *narrative*, and almost none of the
  regrowth was stale prose. execute writes long, genuinely valuable rows; compress a row to its
  decision, its surprises, and what was verified versus reasoned about.
- **A design answer stops earning its length the moment something else restates it**
  (2026-09-01), and **after a `[large]` item ships, its design answer and its ledger row are two
  tellings of one story** (2026-09-02) — keep the shorter. The restating thing can be the
  **queue entry**, not only the shipped code (2026-09-03), so check the entry against the
  section the run you write it, not the run it ships. *(2026-09-10 widens this once more: it can
  also be a **parked** item. "What lifting the instance pin actually costs" was discharged and
  restated word for word by PH-13 under "Needs a human"; so were "No error tracking" by PH-7b
  and "Two smaller ones" by two ledger rows.)*
- **A chronological log is the same growth shape as a ledger** (2026-09-09, applied to this
  section itself on 2026-09-10). The oldest entries are the ones that stopped being read.
- **Compressing is sometimes not enough, and that gets recorded rather than hidden.**
  `real-data-and-shelters.md` landed at 421 on 2026-08-31 and 412 on 2026-09-04; a run that
  archives *and* adds a `[large]` item plus a design answer is net-positive on lines even after
  cutting 100. *(2026-09-10: `production-hardening.md` landed at 404 after three archives —
  over by four, recorded here for the same reason. **2026-09-11: the same doc landed at 409
  after three more** — 109 lines archived across PH-17's ledger row, ten older ledger rows, and
  the tense-test section, plus two preambles trimmed — while gaining a `[large]` item, a design
  answer and a re-verification. Third consecutive over-run, all three on this doc, which is
  itself the finding: **`production-hardening.md` is structurally at its ceiling**, and the next
  run that adds to it should archive the "Needs a human" block rather than hunt for prose.
  **2026-09-12: a fourth run added to it, and the prescription was wrong in a useful way.**
  That doc gained a `[large]` item, a design answer and a re-verification and still landed at
  **397** — under, for the first time in four runs — but not by cutting "Needs a human", which
  is already four lines and a pointer. What it cut was **two whole layers of
  pointers-to-pointers**: sixteen ledger rows each already a compression of an archived row,
  and six settled sections each already an index entry into an earlier archive. So the sharper
  rule, and the one to try first next time a doc is over: **cut the layer that points at a
  layer that points at the reasoning.** It comes out at zero cost, and this doc had
  accumulated two of them without anyone noticing, because every individual line still looked
  load-bearing.)*

## Ledger convention

Each initiative doc ends with a **Ledger** — one line per shipped item:
`- YYYY-MM-DD — <item id> — PR #<n> — <one-line outcome>`. Append here, never
rewrite history in it. If a task shipped smaller or different than queued,
say so in the line rather than editing the original queue entry after the
fact.

**On `PR #__` placeholders.** execute writes its ledger row in the same
commit as the code, before the PR exists, so it cannot know its own number
and has been writing `PR #__`. All three docs had one as of 2026-08-26
(PH-3, RS-3, DC-1 — backfilled to #23, #24, #25 in that run). This is a
real ordering constraint, not sloppiness, so the convention is: **execute
leaves `PR #__` and plan backfills it on the next run** from
`gh pr list --state merged`. If execute can cheaply amend the row after
opening the PR, better — but don't block a merge on it. The convention is
working as designed: PH-5 was the only outstanding placeholder on 2026-08-28
and was backfilled to #29 that run; on 2026-08-29 all three of that week's
shipped items carried one and were backfilled together — DC-6 → #32,
PH-7 → #33, RS-2 → #34. Later the same day a second execute run added four more,
backfilled on the following plan run — PH-9 → #36, PH-8 → #37, RS-7 → #38, and
RS-7's follow-up → #39. Four placeholders from one run is the most so far and
still cost one `gh pr list` to resolve, so the convention is holding; if it ever
stops being cheap, the fix is execute amending its own row after opening the PR,
not plan guessing. *(2026-08-30: three more — PH-10 → #43, PH-11 → #44,
PH-12 → #45 — backfilled at the same moment those rows were moved into the
ledger archive, which is the cheapest time to do it: the rows were being
rewritten anyway.)* *(2026-09-06: DC-5 and its rider DC-2 both carried one and
both resolve to the same **#65**, since the rider convention puts two items in one PR —
which is the first time a single number has filled two placeholders.)* *(2026-09-07: DC-7's
queue entry and ledger row both backfilled to **#67**.)* *(2026-09-08: DC-8 and DC-9 both
resolve to **#69** — the rider convention filling two placeholders with one number for the
second time, and three placeholders across two sections resolved by one `gh pr list`.)*
*(2026-09-10: RS-4's three placeholders — its queue entry, the M4 section and its ledger row —
all resolve to **#72**. Three in one doc from one shipped item, still one `gh pr list`.)* *(2026-09-11: PH-17's two — its queue entry and its ledger row — both resolve to **#75**,
backfilled in the same run that compressed the row, which is again the cheapest moment: the row
was being rewritten anyway.)* *(2026-09-13: PH-20's two — its queue entry and its
ledger row — resolve to **#79**, backfilled in the run that merged the queue entry into a
four-line shipped-items bullet. Three runs running, the placeholder has been resolved while the
row was being rewritten for length anyway, which is now the rule rather than the coincidence.)*

**A standing lesson from 2026-08-28, worth generalising past the one bug.**
DC-1 shipped with its verification recorded honestly as *"verified locally on
two throwaway commits (not yet observed on a real GitHub Actions run)"*, and
that caveat turned out to be the whole story: the guard worked locally and
has never once worked in CI, because the failure was in the CI environment's
shallow checkout, which local testing cannot reproduce by construction. When
a ledger row says a thing was verified locally but not in the environment it
runs in, that is an **open item**, not a completed one — plan should treat it
as something to go and check, on a named next run, rather than as a
disclaimer that has been discharged by being written down.
