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

## Where this actually stands (verified against `main`, not the evidence docs' dates)

- **The low/no-cost update mechanism is already built, for one shelter.**
  `scripts/import_dogs.py` scrapes SF SPCA (`scripts/shelters/sfspca.py`),
  merges in hand-written descriptions from `data/enrichment.json`
  (`scripts/shelters/enrich.py`), and writes `data/dogs.json` — reviewed and
  committed, not fetched at runtime. `--plan` reports the Firestore diff
  before anything writes; the real push **replaces** the roster rather than
  appending (PR #13 fixed silent duplication). This is the pattern to
  extend, not replace.
- **It has a manual trigger, deliberately not a schedule.**
  `.github/workflows/import-dogs.yml` (added same day as M1, after this doc's
  first draft) runs it via `workflow_dispatch` with a `--plan`-by-default
  preview and an explicit re-scrape opt-in, using the same service account
  the deploys use. Its own comment states the reasoning: "the roster should
  change when someone decides it should, not because a file moved." That's
  a real design position, not an oversight — M4 below is about deciding
  whether to keep it manual-only or add a proposal-only schedule, not about
  assuming a schedule is obviously better.
- **The roster is one shelter deep.** Every dog in `data/dogs.json` carries
  `shelter_id: "sfspca-mission"`. `web/src/lib/shelters.ts` still lists
  eight organizations. Seven of them have zero dogs and no import path —
  they're decorative until M3.
- **`shelters.ts` has drifted from reality**, per `real-data-sourcing.md`'s
  own finding: one entry isn't a distinct organization, and Family Dog
  Rescue appears to have closed at the address the app displays. Harmless
  today because no application can reach a real shelter contact anyway.
  Becomes a real problem the moment M2 ships and an application is
  something a shelter is meant to see.
- **No `shelters` Firestore collection, no shelter accounts, no
  `applications` collection.** `firestore.rules` still has
  `match /dogs/{dogId} { allow write: if false }` — only the agent's Admin
  SDK writes, meaning no shelter can edit their own listing today even in
  principle.

## Milestones

**M1 — done.** Offline, reviewed, committed dog data for one shelter, with a
diff-before-write import path. (`scripts/import_dogs.py`,
`data/enrichment.json`, PRs #6, #13, #14.)

**M2 — the applications collection.** Move an application out of
`fosters/{uid}` (private, unqueryable by a shelter) into
`applications/{id}` per `shelter-integration.md`'s shape: `fosterId`,
`dogId`, `shelterId`, `status`, `checklist`, `pickup`. Add
`shelters/{shelterId}` with `staffUids`. This is the actual prerequisite for
"shelter admins approve things" — there is currently nowhere for an admin
to look. Gated on nothing; can start immediately. `production-hardening.md`'s
PH-3 (durable agent sessions) is gated on this landing first, not the other
way around, since PH-3 touches the same Firestore-shape assumptions the
agent's tools read.

**M3 — shelter accounts and the admin add/edit surface.** A shelter staff
member signs in (reuses the existing Google auth — `staffUids` just needs
their uid added by hand at first, no self-serve org signup yet), sees
applications where `shelterId` matches theirs, and can add or retire their
own dogs. This is the "approved via shelter admins" half. `firestore.rules`
`dogs` write rule changes from `false` to `isStaff(shelterId)` (sketch
already in `shelter-integration.md`). Manual entry through this UI becomes
the second source adapter — proving the pipeline works for a shelter that
isn't SF SPCA, with zero scraping risk and no third-party approval needed.

**M4 — decide on a cadence, and reconcile drift.** The import
workflow (`import-dogs.yml`) already exists and already defaults to
preview-only; what's still a decision, not engineering, is whether to also
add a Cloud Scheduler trigger that runs `--plan` on a cadence and opens an
issue or PR with the diff for a human to act on — automated *proposal*,
human *approval*, never an auto-write, consistent with the workflow's own
stated philosophy. Weekly would be plenty given the source is a shelter's
own adoptable-dogs page, not a fast-moving feed. Don't build the scheduler
without that decision being made on purpose; the manual trigger alone may
be the right amount of automation for a two-shelter roster. Separately from
that decision: fix the `shelters.ts` drift — verify all eight against a
live source, or cut to the one that's actually populated until M3 gives
the others real data.

**M5 — a second automated source, gated on demonstrated need.**
`real-data-sourcing.md` already picked RescueGroups.org as the one open API
worth a second look (free, terms explicitly permit caching, refresh cadence
stated) — but getting a key and confirming Bay Area coverage is unstarted.
Don't build this until M3 has at least one real shelter using the admin
surface; a second automated source before the manual path is proven just
adds a second thing that can drift.

## Task queue

- **RS-1 (2026-08-24).** Build the `applications` collection and
  `shelters/{id}` (M2). Exact shape and rules are already specified in
  `shelter-integration.md` — implement it as written rather than
  re-deriving it. Migration: `fosters/{uid}.matchedDogId` /
  `approvalChecklist` / `pickup` stay as read-through convenience fields for
  now (nothing currently live needs a hard cutover — the roster is one
  shelter deep and there's no real application yet to migrate). Verify:
  a foster applying creates an `applications` doc; a Firestore query
  `where("shelterId","==","sfspca-mission")` returns it, which is impossible
  today.
- **RS-2 (gated on RS-1).** Shelter sign-in, application list, and
  add/retire a dog (M3, first half). Reuse `SignInView`'s Google auth path;
  a new route gated on `staffUids` membership, not a new auth system.
  Verify: a uid manually added to `shelters/sfspca-mission.staffUids` can
  see applications for that shelter and cannot see another shelter's; a uid
  not in any `staffUids` gets a clear "not staff" state, not a blank
  screen.
- **RS-3 (2026-08-24, independent of RS-1/RS-2).** Fix the `shelters.ts`
  drift now rather than waiting for M4's scheduled job: verify each of the
  eight entries (does it still operate, is the address current, is it a
  distinct org), and either correct or remove the ones that don't check
  out — Family Dog Rescue specifically, per `real-data-sourcing.md`'s
  finding. Small, no dependencies, and every day it's wrong is a day the
  app can send someone to a defunct address.

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

## Ledger

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed
  descriptions, diff-before-write, replace-not-append.
