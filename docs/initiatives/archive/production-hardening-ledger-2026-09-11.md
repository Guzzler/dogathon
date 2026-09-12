# Archived ledger row — PH-17 (verbatim), production-hardening.md

Archived 2026-09-11, in the same PR that queued PH-19, per the README's "archive in the same
PR" rule. The working doc carries the compressed form; this is the row exactly as execute
wrote it on 2026-09-10. `PR #__` is backfilled to **#75** in the compressed version and left
as written here, since this file is a snapshot rather than a record to correct.

- 2026-09-10 — PH-17 — PR #__ — **A demo dog's past no longer reaches a real foster's
  document, or the adoption page.** `data.ts` splits by the tense test: advice
  (`taskTemplates`, `weekPhases`, `tips`, `scheduleBlocks` with both `done: true` rows flipped
  to `false`) stays; `marty`, `seedMilestones`, `seedJournal` and `medicalSummary` move to
  `data.demo.ts`, reachable only through `LOCAL_MODE`. **All four write paths are gone, not
  the two the spec named** — both seeding effects deleted outright, and both setters now fall
  back to `LOCAL_MODE ? seed : []` rather than the seed, which is what would have left the
  defect intact: the first note a foster wrote saved the whole invented past underneath it.
  `adoption.ts` no longer defaults `milestones` to a seed, and the `lastMilestoneWeight`
  branch is **deleted rather than guarded** — a weight is a `careLog` weigh-in, the shelter's
  intake figure, or the size bucket, full stop. `CarePlanView` builds the one milestone the
  app can prove (the pickup it scheduled) and passes `summary` to `Emergency` only in
  `LOCAL_MODE`, where it now renders "Not recorded" three times instead of a template.
  **Two things the spec had wrong, both in the expensive direction.** It said "add cases to
  the existing `adoption` tests" — there were none, so `web/src/lib/adoption.test.ts` is new
  (8 cases, two describes: nothing logged, and things the foster actually did). And it asked
  for `medical` to "render from data the app actually holds", which turned out to need a
  source designed rather than chosen: nothing in this app records a dog's vaccines. It is now
  built from ticked `vaccine`/`medication` schedule rows and `vet_visit` care-log entries, is
  `null` when all three are empty, and **allergies do not render at all** — "None reported" on
  the page a stranger reads is a clean bill of health nobody gave. Exit grep is clean: every
  hit for `seedJournal|medicalSummary|seedMilestones|marty` is the demo module or a
  `LOCAL_MODE`-guarded call site. `npm run build`, `npm run test` (98 → 106 passing, 10 → 11 files) and
  `npm run lint` (9 warnings → 8) all green. **Not verified live**: `web/.env` is configured
  here, so the app is not in `LOCAL_MODE` and reaching Care Plan needs a Google sign-in this
  loop can't do. That a foster document gains no `journal` or `careSchedule` field is
  structural — `patchFoster` is now reachable only from the two setters — but it is a reading
  of the code, not an observation of a document.
