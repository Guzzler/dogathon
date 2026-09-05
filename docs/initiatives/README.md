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
   above production-hardening because DC-5 (letting the foster side breathe on a
   wide screen) is real product work on a surface people actually see, and
   because a live incident (PR #11) is why this doc exists at all.
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

- **`real-data-and-shelters.md` had no `[large]` item at all** after RS-5 shipped —
  the only one in the repo was DC-5, sitting in the *second*-priority doc, which is
  not what this README asks for. RS-6 (add and retire a dog: a rules change, a form,
  a status transition, and the foster-side consequences of both) was already that
  size and merely wasn't labelled. It is now marked `[large]` and sits at the top of
  the top doc's queue. The lesson is that the `[large]` slot is usually a **labelling**
  gap, not a missing item — look for the item that is already big before inventing one.
  **2026-09-02 repeated it exactly.** RS-6 shipped, taking the only `[large]` item in the top
  doc with it, and the next one was again already in the queue and unlabelled: RS-10 (a hook,
  both foster views composed from two sources, an agent tool constrained, a four-case test).
  Twice running, the answer was a label rather than an invention. Treat "there is no `[large]`
  item" as a prompt to re-read the queue before writing anything new.
- **2026-09-03 repeated it a third time, and the label was already right.** RS-10 shipped and
  RS-11 was already marked `[large]` and already at the top of the top doc — nothing needed
  labelling or inventing. Three runs in a row, the `[large]` slot was filled by reading the queue.
- **2026-09-04 broke the streak, and the exception is as instructive as the rule.** RS-11
  shipped and the top doc's queue held exactly one item — RS-4, a workflow trigger that is
  small by construction. Re-reading it produced nothing `[large]`, because there genuinely was
  nothing: M3's three surfaces and both round trips are built. The item came instead from
  **verifying a claim in the other direction** — PH-1 has said since 2026-08-24 that a real
  notification path is "downstream of M3", and M3 finished while nobody re-read that sentence.
  Reading `adoption.py` against the shipped shelter dashboard turned an old gated note into
  RS-12. So the generalisation gains a second half: **read the queue first, and when it is
  genuinely empty of big work, re-read the notes that were gated on something that has since
  shipped.** A parked item whose gate opened is the cheapest place a `[large]` one hides.
- **`production-hardening.md`'s queue is empty and was deliberately left empty.** It
  is the lowest-priority doc, the two above it hold four open items including the
  `[large]` one, and PH is the doc whose refills produced the treadmill the re-rank
  exists to stop. An empty third queue is the ranking working, not a gap to fill.

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

Keep each initiative doc's **working core** — context plus the Task
queue — under roughly 250 lines. If it grows past that, the excess is
almost always closed queue items that belong in the Ledger instead of the
prose above it, or a design decision that's settled and can compress to one
line with a date. There's no archive directory yet because nothing here has
run long enough to need one; when a doc first crosses ~400 total lines,
start one (`docs/initiatives/archive/<doc>-<date>.md`, dated verbatim
snapshot) rather than let it grow unbounded. **Thirteen archives exist as of
2026-09-04** — that run archived from *two* docs in one PR, which is a first.
`production-hardening-ledger-2026-09-04.md` took PH-14/15/16's three rows, 55 lines of entirely
load-bearing text, after this run's own PH-1 edits carried that doc to 410; it came back to 372.
`real-data-and-shelters-2026-09-04.md` took three settled design sections at once
plus RS-11's two ledger rows and RS-5b's superseded original — and the doc still landed at
**412**, over the threshold, which is recorded here rather than hidden, as 2026-08-31's 421 was.
The reason is the same both times: a run that archives *and* adds a `[large]` item plus a design
answer is net-positive on lines even after cutting 100. The next run to touch this doc should
archive the Ledger, which is again where the growth is.) Previously **eleven as of
2026-09-03** (counted off `docs/initiatives/archive/`, not carried over). The six that
established the convention: `real-data-and-shelters-2026-08-29.md` (that
doc's settled M1/M2/M4 narrative) and `production-hardening-2026-08-29.md` (its
settled PH-1..PH-6 narrative and rows), then
`production-hardening-ledger-2026-08-30.md` (PH-7..PH-12's rows) and
`real-data-and-shelters-ledger-2026-08-30.md` (M1 through RS-9's rows), then
`production-hardening-deletion-2026-08-30.md` (the account-deletion finding that
produced PH-14/15/16, archived by execute in PH-16's own PR the moment its edits
crossed the line — which is the trigger working as written).
The pattern that worked all three times, and is
now the convention: snapshot verbatim into the archive so nothing
is lost, then compress the settled sections in the working doc to one dated line
each that points at the archive for the reasoning. Archives are append-only — if
something in one turns out to be wrong, correct the working doc and say so there.

**The 2026-08-30 pair narrows the pattern usefully, so it's worth recording.** The
first two archived *narrative* — settled prose that had stopped being read. The
second two archived only **ledger rows**, because that is where the growth
actually was: both docs went back over 400 within a day or two of their first
archive, and almost none of the regrowth was stale prose. execute writes long,
genuinely valuable rows (PH-8's is 40 lines and every one of them earns its
place), so the ledger is now the first place to look when a doc is over, not the
last. Compress a row to its decision, its surprises, and what was verified versus
reasoned about; the archive keeps the rest.

**2026-08-31 — the sixth, and the first where compressing was not enough.**
`real-data-and-shelters.md` was at 397 before that run, which then added a whole new
design answer plus RS-10; archiving RS-9's narrative and compressing four settled
sections bought back roughly 60 lines and the doc still landed at **421**. It was
recorded rather than hidden, with the instruction that the next run to touch it should
archive the Ledger.

**2026-09-02 — the eighth**
(`archive/real-data-and-shelters-2026-09-02.md`) narrows the rule one more notch. That run's own
edits would have taken the doc to roughly 490, so it archived in the same PR, and what it took
was RS-6's photo-source design answer *and* RS-6's 26-line ledger row — both of which had been
restated by the thing they produced (the shipped code, and each other). The generalisation:
**after a `[large]` item ships, its design answer and its ledger row are two tellings of one
story**, and the working doc only needs the shorter one.

**2026-09-03 — the eleventh, and it took both kinds at once.** RS-10 shipped, so its
design section *and* its 22-line ledger row were the two tellings the 2026-09-02 rule names —
except the design section had already been compressed, so what was actually redundant was the
**round-trip section for RS-11, an item that has not shipped yet**. Its two "must not do" rules
were quoted word for word inside RS-11's own queue entry, which is the 2026-09-01 trigger
("a design answer stops earning its length the moment its queue item restates it") firing
*before* the build rather than after. The generalisation: the restating thing can be the queue
item, not only the shipped code, so check the queue entry against the design section the run you
write it, not the run it ships.

**2026-09-01 — that instruction was followed, and it worked.** The seventh archive
(`archive/real-data-and-shelters-2026-09-01.md`) took both the Ledger through RS-5 and
the 2026-08-31 checklist-join design answer, which had become RS-10's duplicated spec
rather than live reasoning. The doc went 390 → 356 *while* gaining a new design section
and a new queue bullet. Two things generalise. **The ledger really was the growth**, as
the 2026-08-30 pair predicted: RS-5's row alone was 24 lines. And **a design answer stops
earning its length the moment its queue item restates it** — compress it to the decision
plus a pointer at exactly that point, not later.

The trigger is worth applying at the moment a run's own edits push a doc past
~400, not on the next run. production-hardening crossed it *because of* the
2026-08-29 queue refill, and archiving in the same PR is what kept the working
doc at 347 lines instead of letting a 420-line version merge and get noticed
later.

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
rewritten anyway.)*

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
