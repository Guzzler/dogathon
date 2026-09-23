# Archived from real-data-and-shelters.md — 2026-09-22

Verbatim snapshot, cut the run RS-14 `[large]` was queued: the two queue bullets that recorded
fourteen runs of "this doc holds no `[large]` item" (no longer true), and the RS-4 and RS-13 Ledger
rows, compressed in the working doc to their decision. Nothing here was edited.

## Queue bullets (lines 183–208 as of 2026-09-21)

- **This doc has held no `[large]` item since 2026-09-05, and that is still a finding rather than
  a gap — re-checked this run and unchanged.** M3 is finished; M5 is gated on demonstrated need,
  which needs a real shelter, which needs the conversation below. RS-13 shipped (PR #88) and did not change it: it was a workflow honesty fix, small by
  construction. **Re-checked 2026-09-21 and unchanged for a thirteenth run** — the repo's `[large]`
  slot is PH-27 in `production-hardening.md`, the twelfth consecutive run in the third doc. Like
  PH-26 (PR #95, which closed the agent's way around RS-5's inbox) it touches this doc's surface:
  the agent's `update_dog` can flip any shelter's dog to `adopted` or `retired` around RS-6's
  staff-only rule. It stays in PH because the fix is in the agent's tools. RS-13's half of that is re-grounded rather than carried:
  `import_dogs.py:51` still defines `EXIT_UNREACHABLE = 75` and `:127-130` still exits it having
  written nothing, so the honest-reporting half stands and **RS-13b is still the only thing that
  closes M4**. The
  top doc has run out of *buildable* work, not out of work. Full narration of the nine runs that
  established this, and the two cautions it produced about a dated measurement being evidence whose
  *measured-against* is part of the claim, verbatim in
  [`archive/real-data-and-shelters-largeslot-2026-09-14.md`](archive/real-data-and-shelters-largeslot-2026-09-14.md).

- **2026-09-13 through 2026-09-18 — six runs recorded the same routing outcome here** (this queue
  empty, every gate still gated on a person, the `[large]` slot found in `production-hardening.md`),
  and they are compressed to this line per the README's rule that a chronological log grows like a
  ledger — verbatim in
  [`archive/real-data-and-shelters-routing-2026-09-17.md`](archive/real-data-and-shelters-routing-2026-09-17.md).
  The one substantive thing they carried is worth keeping: **PH-22 (PR #83) fixed the callee behind
  RS-6's `dogFromForm()`**, which omits `foster_weeks`, `size` and `energy_level` and asserted in a
  comment that `normalizeDog()` "already knows how to render" an absent key. It did not — it filled
  all three from a breed regex, making a hand-entered dog the *most* likely record to carry invented
  facts. The form was right and its callee was not; the convention is now safe as written.

## Ledger rows (lines 351–391 as of 2026-09-21)

- 2026-09-09 — RS-4 — PR #72 — **the roster was given a weekly way to say it had gone stale —
  which then turned out not to be able to run at all; see RS-13.** A `schedule: "0 9 * * 1"` trigger
  joined the existing `workflow_dispatch` on `import-dogs.yml`. The detail that decides whether the
  task is worth doing is enforced structurally rather than by default: the scheduled branch builds
  `ARGS="--plan"` from `github.event_name` and never appends `--from-cache`, so it always re-scrapes
  (a cached replay diffs the committed data against itself and reports "no drift" forever) and there
  is **no input it can set and no branch it can take that writes to Firestore**. Both manual paths
  resolve to exactly the argument strings they did before, checked by replaying the shell for all
  three events rather than by reading it. **Chose the issue over the `::error::` fallback**, and
  reused rather than reopened: one `roster-drift` label, one open issue, a *comment* if a later week
  still drifts — a weekly check that files an identical ticket every Monday is a backlog, not a
  signal. Two things the spec hadn't named: the report needed a body richer than a diff stat, so the
  import output is `tee`'d and the `firestore plan` block `sed`'d out of it; and the existing
  "Check for uncommitted roster changes" step was pinned to `workflow_dispatch` rather than relying
  on `inputs.rescrape` being a falsy empty string on a schedule event. **Verified by dispatching
  the branch's own workflow** (plan-only, cached). The scheduled branch itself cannot be dispatched,
  so what was proven was the argument replay plus the file parsing — and the row said so: *"the
  first real proof arrives the Monday after merge."* It arrived on **2026-09-14 and failed 403**.
  Full row verbatim in
  [`archive/real-data-and-shelters-rs4-2026-09-17.md`](archive/real-data-and-shelters-rs4-2026-09-17.md).
- 2026-09-17 — RS-13 — PR #88 — **the weekly roster check now has a third outcome, and it is the
  honest one: *could not look*.** `scripts/import_dogs.py` gained `EXIT_UNREACHABLE = 75`
  (`EX_TEMPFAIL`) and exits with it, having written nothing, when the scrape raises `httpx.HTTPError`
  — and, the part the spec had not named, **when a fresh scrape returns zero dogs**. That second
  case is the dangerous one: `sfspca.scrape()` catches per-page errors and returns what it got, so a
  site refusing every request yields `[]` rather than raising, and the old code would have written
  an empty `data/dogs.json`, diffed it, and filed *drift* — the emptiest possible roster reported as
  news about the dogs. `import-dogs.yml`'s scheduled branch now catches **75 and only 75**, sets
  `steps.import.outputs.reachable`, and routes to one of two report steps; the drift step gained
  `reachable == 'true'` to its `if`, because a clean working tree after a scrape that never ran is
  exactly the "no drift" lie this item exists to remove. Both reports share the one `roster-drift`
  issue (`TITLE` picked by whichever branch ran) rather than opening a second stream, per RS-4.
  **Manual dispatch is byte-for-byte unchanged and still goes red on 75** — a human is watching
  that one. **Verified**: `uv run pytest` 55 passed, five of them new in `tests/test_import_dogs.py`
  (403, connect timeout, empty scrape, a `ValueError` that must *not* become 75, and the happy path),
  each asserting the committed data files were not written; plus the Import step's shell replayed
  outside Actions for all three event types × four exit codes (7 cases), which is how RS-4 was
  verified and the only way to see the scheduled branch at all. The scheduled branch still cannot be
  dispatched, so what remains unobserved is the issue body on a real run — **check the 2026-09-21
  run**, the same discipline that found this defect. What RS-13 does **not** do is make the scrape
  work; that is RS-13b and M4 stays reopened.

## Shipped-item queue bullets, compressed to one (same run)

- **RS-13 — shipped 2026-09-17; the Ledger row is the full account.** The weekly check reports
  three outcomes instead of two, and the third says the roster's freshness is **unknown** rather
  than clean. `scripts/import_dogs.py` exits `75` (`EXIT_UNREACHABLE`) when it cannot reach the
  shelter, having written nothing; `import-dogs.yml`'s scheduled branch catches 75 and only 75 and
  files that as the same one `roster-drift` issue. Two things worth keeping out of the row: **the
  empty scrape is the same failure wearing different clothes** — `sfspca.scrape()` swallows
  per-page errors and returns `[]`, so a site refusing every request would have replaced the
  roster with nothing and reported the emptiness as drift — and **what RS-13 deliberately does not
  do is make the scrape work.** It cannot: the block is on the address range GitHub-hosted runners
  live in, so a cadence that can actually look needs a runner nobody in this repo owns. That is
  **RS-13b** under "Needs a human", and **M4 stays reopened** until it exists.

- **Every M3 item is shipped and each has a Ledger row, which is the account** — RS-6 `[large]`
  (PR #54, M3's third surface), RS-10 `[large]` (PR #56, the checklist join, which ungated RS-11),
  RS-11 `[large]` (PRs #58, #59, the round trip in both directions), RS-12 `[large]` (PR #63, which
  **discharges PH-1** — not anything in `production-hardening.md`), and RS-7/RS-5 (PRs #38, #39,
  #52, the deploy target and the inbox; RS-5's one open question was settled by RS-5b). These
  bullets had each become a third layer pointing at a Ledger row that points at an archive, so they
  are one line now. The signed-in halves are **RS-6b, RS-12b and RS-8** under "Needs a human".

- **RS-4 — shipped 2026-09-09 (PR #72), and its claim to have closed M4 did not survive its own
  first real run.** The weekly trigger, the plan-only-by-construction scheduled path and the
  one-reused-issue drift report all shipped exactly as specified — and the scrape 403s from a
  GitHub runner, so none of it has ever produced a report. **RS-13 above is the fix**; this bullet
  used to say "M4 is closed" and "this empties the last open item across all three initiative
  docs", and the second half was true.

## RS-9 and RS-5b "Needs a human" DONE entries, compressed to one (same run)

- **RS-9 — DONE 2026-08-29, by Sharang, in-session.** The `applications`
  composite index is `READY`; RS-5 is unblocked. RS-7's deploy had failed
  `403` because the deploy service account could write documents but not create
  indexes, and Sharang granted `roles/datastore.indexAdmin` (invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md)). Full account, including why CI's
  `GCP_SA_KEY` cannot be read back out of GitHub by design, in the
  [2026-08-31 archive](archive/real-data-and-shelters-2026-08-31.md).

- **RS-5b — DONE 2026-09-04, with Sharang present. The `||` rule serves the staff list query.**
  Three `fixture-` rows seeded with `scripts/seed_test_applications.py`; **all three render** at
  `https://pawthway-hackathon.web.app/shelter` signed in as the uid in `shelters/sfspca-mission`,
  with no `permission-denied` — so the staff branch of `applications`'s read rule does serve
  `where("shelterId","==",id)` + `orderBy("createdAt","desc")` against the RS-7/RS-9 index. This
  was the question RS-5 shipped unable to answer, and it could not be answered against an empty
  collection, because Firestore evaluates a list rule per candidate document. Ticking a
  shelter-owned item and pressing **Mark approved** both wrote, so the staff *update* branch
  works too, and the `(deleted account)` fixture renders as an ordinary withdrawn row — the
  PH-15 redaction state the inbox was built for and had never been shown. The three fixtures
  are still in production; they have fixed ids, so re-running the seeder resets rather than
  duplicates. Full original wording of the item in the
  [2026-09-04 archive](archive/real-data-and-shelters-2026-09-04.md).
