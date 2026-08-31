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

1. [`production-hardening.md`](production-hardening.md) — the trust and
   correctness debt that undermines everything else if it ships to a real
   foster first: a tool that claims to notify a shelter and doesn't, agent
   sessions that don't survive a deploy, no way for someone to delete their
   data. Ranked first because these are silent failures — nothing crashes,
   the app just lies or loses state, and nobody notices until a real person
   is affected.
2. [`real-data-and-shelters.md`](real-data-and-shelters.md) — the actual
   growth path: move applications out of the private foster document into
   something a shelter can query, give shelters an account, and keep the dog
   roster current at near-zero ongoing cost. This is the direct build-out of
   the two evidence docs, and it's what turns "an app with fake data" into
   "an app one real shelter actually uses."
3. [`design-consistency.md`](design-consistency.md) — keeping the visual
   language coherent as more surfaces get built, ideally enforced by
   something CI checks rather than something plan has to remember to look
   for. Ranked last only because it's ongoing hygiene, not a one-time
   unblock — but its first task queue item is concrete and worth doing soon:
   a live incident (PR #11, cited in that doc) is the reason it exists at
   all, not a hypothetical. *(2026-08-28 flagged DC-6 as the most urgent item
   across all three docs, because the guard this initiative produced had been
   failing open on every run since it merged. **DC-6 shipped 2026-08-28,
   PR #32**, verified from real Actions runs in both directions — so that
   flag is discharged and the ordinary ranking applies again.)*

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
snapshot) rather than let it grow unbounded. **Five archives exist as of
2026-08-30**: `real-data-and-shelters-2026-08-29.md` (that
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
