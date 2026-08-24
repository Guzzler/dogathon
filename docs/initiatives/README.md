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
   all, not a hypothetical.

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
- **Guest→account migration is a known gap, deliberately deprioritized**
  (Sharang, 2026-08-23: "guest migrations is fine" — meaning: real, but not
  urgent). A guest who applies loses their onboarding answers and saved dogs
  on sign-in, because `linkWithCredential` was never wired up. It's queued
  in `production-hardening.md` at low priority, not silently dropped.

## Doc size

Keep each initiative doc's **working core** — context plus the Task
queue — under roughly 250 lines. If it grows past that, the excess is
almost always closed queue items that belong in the Ledger instead of the
prose above it, or a design decision that's settled and can compress to one
line with a date. There's no archive directory yet because nothing here has
run long enough to need one; when a doc first crosses ~400 total lines,
start one (`docs/initiatives/archive/<doc>-<date>.md`, dated verbatim
snapshot) rather than let it grow unbounded.

## Ledger convention

Each initiative doc ends with a **Ledger** — one line per shipped item:
`- YYYY-MM-DD — <item id> — PR #<n> — <one-line outcome>`. Append here, never
rewrite history in it. If a task shipped smaller or different than queued,
say so in the line rather than editing the original queue entry after the
fact.
