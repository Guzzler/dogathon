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

- **2026-09-08 — measuring found the slot a third time, and what it corrected was the
  *method*, not the sample.** DC-8 shipped; the first two fallbacks came back empty against
  the top doc for the fourth consecutive run and for the same structural reason (M3 finished,
  M5 gated on a shelter), so measure was used again and produced **DC-10**. What it measured
  was every class selector in all four stylesheets against every `className` under `web/src`,
  prefix-aware so constructed names like `` `cp-plan-chip__kind--${row.kind}` `` count as live:
  **41 of `pawthway.css`'s 61 classes and 67 of `carePlan.css`'s 204 are unreferenced**, and
  three modules have zero importers. The finding that made it a correction rather than a
  cleanup: **four of the six media-query blocks DC-8 re-homed the day before target classes no
  component renders.** DC-8 verified against a hand-built harness "of the real class
  structure", and a harness containing dead classes reports geometry for them exactly as
  convincingly as for live ones. So the standing lesson from 2026-09-07 gains a second half:
  a measurement is evidence, and **what you measured against is part of the claim** — the
  cheapest correction is still the section the last run just wrote, but the *method* it used
  deserves the same suspicion as its numbers. Where a static diff can prove the thing (DC-7's
  selector-set diff), prefer it over anything you had to build to observe it.
- **2026-09-08, second run — the slot was *spent*, not found, and the loop is now out of
  `[large]` work everywhere.** DC-10 shipped (with DC-4 as its rider), which empties
  `design-consistency.md`'s queue entirely after it held the repo's `[large]` slot for four
  consecutive runs. Across all three docs the only open item is **RS-4**, small by
  construction. So the next `dogathon-plan` run inherits the 2026-09-05 situation in a sharper
  form: the top doc is still gated on a human, and now the second doc has run out too. Both
  leads DC-10 left behind are small (a one-class-at-a-time `theme.css` pass; a re-count of
  `carePlan.css`'s literals now that 80 classes of rules are gone), so the honest expectation
  is that **the third fallback — measure — has to find the next `[large]` item somewhere other
  than CSS**, because three consecutive runs of measuring CSS have now consumed the dead CSS
  there was. One thing DC-10 proved about the method itself, worth carrying forward: its own
  queue entry's measurement was **over-reported by five classes**, all of them live via a
  conditional class nested inside a template literal's `${...}`. A literal scan is a shortlist,
  never a verdict — the confirming pass must read `className=` values specifically, and
  whatever is measured next deserves the same two-pass treatment.
- **2026-09-09 — the fourth link in the chain: measure something that isn't CSS, and the
  slot lands in the *third* doc.** The previous run predicted this exactly — three
  consecutive runs of measuring CSS had consumed the dead CSS there was, so the next
  `[large]` item would have to come from somewhere else. It did. Both cheap fallbacks came
  back empty against the top doc for the fifth consecutive run and for the unchanged
  structural reason (M3 finished, M5 gated on a shelter, RS-4 small by construction and in
  flight as this ran). Measuring **content provenance** instead of selectors — every module
  that supplies data to `buildAdoptionProfile`, traced back to where the data is written —
  produced **PH-17**: `web/src/phases/careplan/data.ts` is a demo dog's *past*, and
  `useJournal.ts` writes it into every real foster's Firestore document, from where the
  adoption page prints another animal's vaccination record and labels a seeded weight
  `source: "care plan"`. Three things generalise, and the third is the one to keep:
  - **The measurable surface is not only CSS.** Selectors against markup is one instance of
    a general move — enumerate what the code *claims*, then trace each claim to its source.
    Applied to content rather than style, the same method found a defect in what the product
    tells a stranger about a real animal.
  - **The slot may sit in the lowest-ranked doc**, and this is the second time the `[large]`
    item has been outside the top one (2026-09-05 was the first, in the second doc). Same
    reading as then: the ranking's premise — that real-data has the buildable work — has
    expired *for now*, not been overturned. Routing for one run, not a re-rank.
  - **Ranking cuts both ways, so an empty higher queue can be the correct queue.** execute
    works top-down, so anything queued in `design-consistency.md` this run — including a
    small, true item that survived re-measurement — would be picked *before* PH-17. Leaving
    it a lead is what protects the `[large]` item. "Don't refill a queue just because it has
    room" was written to stop the treadmill; this is the same rule arriving from the other
    direction, and it applies to a doc that ranks *above* the work that matters, not just
    below it.
  - A fourth, smaller: the 2026-09-07 lesson landed for the third run running, this time
    against a *lead* rather than a shipped claim. DC-10 left fifteen `theme.css` classes
    named as genuinely unreferenced; re-measuring found **eleven of them live**. The cheapest
    wrong measurement to find is still the one the last run just wrote.
- **`production-hardening.md`'s queue was empty by design for eight consecutive runs, and
  was refilled on 2026-09-09.** The emptiness was right while it lasted: it is the lowest-
  ranked doc, and it is the one whose refills produced the treadmill the re-rank exists to
  stop. What changed is not the ranking but the item — **PH-17** is a whole phase of the
  product asserting things about a real animal that nobody observed, which is the class of
  defect this doc was created for, not the small headlessly-verifiable errand class that
  caused the treadmill. Its verification errands stay parked under "Needs a human", and
  that list is still not a to-do list.

- **2026-09-10 — the slot was not sought, and the run's work was checking the one that exists.**
  PH-17 was queued the day before and had not been picked up (execute's last run shipped RS-4,
  #72, which merged twenty minutes before PH-17's doc PR, #73). So no fallback was run: the
  `[large]` slot is filled, it sits in the third doc for the second consecutive run, and both
  higher queues are empty on purpose — `design-consistency.md`'s emptiness is the routing
  decision recorded there on 2026-09-09, and re-queueing its four-rule `theme.css` lead would
  still take execute's run ahead of PH-17. **Total open across all three docs: two, one
  `[large]`.** Nothing was refilled, which is "don't refill a queue just because it has room"
  applied to a run with room in two of three docs.

  What the run did instead was **re-verify the `[large]` item's own spec against `main`** — the
  standing 2026-09-07 lesson, now on its fourth consecutive run and for the first time applied
  to an item *before* it is built rather than after. Every line number PH-17 cited was right,
  and the spec was still materially incomplete in three ways an execute run following its file
  list literally would have inherited:
  - **It named two write paths and there are four.** Deleting the two seeding effects leaves
    `setJournal` (`useJournal.ts:31`) and `setSchedule` (`:64`) persisting
    `updater(stored ?? seed…)`, so the first note a real foster writes saves the whole invented
    past underneath it. The defect would have survived its own fix.
  - **It named three files and there are four.** `CarePlanView.tsx` imports both moving exports
    and is what re-labels another shelter's intake record with this dog's name; moving them
    breaks it, and that is not discoverable from the other three files.
  - **One of its hedges was wrong in the safe direction.** "The count is not the two this doc
    names, verify it" — it is exactly two.
  The generalisation, and the reason this is worth a line here: **a spec is a measurement too.**
  The loop has learned to re-measure a shipped claim and a written-down lead; a queue entry that
  has not been built yet is the same object, and the cheapest moment to find it wrong is before
  someone spends a whole run on it.

  The design question advanced turns PH-17's rule from a pair of lists into a **test** — *could
  this value be wrong about a specific animal?* — and applying it to a second file showed
  **PH-18 is the same defect**, not a neighbour: `1.2 mi` and `Open now` on the emergency screen
  fail it exactly the way a seeded weight does. Recorded in `production-hardening.md`, with the
  seam that lets either item ship first.

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

**Twenty-eight archives exist as of 2026-09-10** (this run added three: two from
`production-hardening.md` and one from this file). The eleven-entry narration of which doc was
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
  over by four, recorded here for the same reason.)*

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
all resolve to **#72**. Three in one doc from one shipped item, still one `gh pr list`.)*

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
