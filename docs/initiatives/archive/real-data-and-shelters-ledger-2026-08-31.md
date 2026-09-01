# real-data-and-shelters.md — Ledger archive, 2026-08-31

Verbatim snapshot of the Ledger section of
[`../real-data-and-shelters.md`](../real-data-and-shelters.md) as it stood immediately
before RS-5 shipped, taken because that run's own edits pushed the working doc past the
~400-line threshold the [initiatives README](../README.md) sets. The 2026-08-31 plan run had
already flagged the Ledger as the largest settled block in the doc and named it as the next
thing to archive; this is that.

Archives are append-only. If something here turns out to be wrong, correct the working doc
and say so there — don't edit this file.

## Ledger

*(Rows are compressed to one line each; each one's full text — including RS-7's
in-place correction of its own verification claim — is preserved verbatim in the
[ledger archive](archive/real-data-and-shelters-ledger-2026-08-30.md).)*

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed
  descriptions, diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules added
  to `firestore.rules` in `shelter-integration.md`'s shape, and
  `createApplication()` opening a document from both apply sites using the dog's own
  `shelter_id`. Deliberately left `fosters/{uid}`'s read-through fields alone —
  that migration is still open — and seeded no shelter documents, since a real staff
  uid was RS-2's to add.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id in `shelters.ts` corrected to
  `"sfspca-mission"` to match the scraper and the roster, `petsun` (a second campus
  of the same org) and `familydog` (closed) removed, `shelters.test.ts` added as the
  guard. Corrected a stale claim in this doc along the way: the id mismatch never
  broke browsing, because every real dog carries its own denormalized `shelter`
  object that `normalizeDog()` already prefers — it mattered for `isStaff()`, not
  for the reason originally written down.
- 2026-08-28 — RS-2 — PR #34 — Staff resolution, the `/shelter` route shell and the
  gate: `useStaffShelters` runs the `array-contains` query and returns a
  discriminated `loading | notStaff | error | staff`, a context hands the resolved
  shelters to the screens behind the gate, and `/shelter` is a **sibling** of the
  foster layout with its own `ShelterLayout` outside the 430px cap. Seeded the first
  `shelters/{id}` document through the Firestore REST API with a `gcloud` token
  (no local ADC), with `scripts/seed_shelter_staff.py` committed so the write is
  reproducible rather than a curl someone ran once. **Verification is partial and
  that is an open item, not a discharged disclaimer**: the `staff` and `notStaff`
  states have never been seen, because both need a real Google popup sign-in — now
  tracked as RS-8.
- 2026-08-29 — RS-7 — PR #38 — `firestore.indexes.json` now actually deploys
  (`--only ...,firestore:indexes`), plus the `applications` composite index RS-5
  needs. An index committed to that file had previously been diffed, reviewed,
  merged and deployed by a run that silently did not deploy it. **This row's
  original verification sentence was wrong and is corrected in place in the
  archive** — it claimed a deploy log that had not run yet; what the log actually
  said was `403, The caller does not have permission`.
- 2026-08-29 — RS-7 (follow-up) — PR #39 — Split `firestore:indexes` into its own
  step **after** hosting and rules, so a missing IAM grant stops taking the site's
  deploy down with it. Deliberately not `continue-on-error` and deliberately not
  dropping the target: the step stayed red on every deploy until RS-9 landed, which
  was the point.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted
  to the deploy service account at Sharang's in-session instruction; the redeploy
  went green and the `applications` index reached **`READY`**, confirmed by reading
  the index's real state rather than a deploy's exit code. The invocation is in
  [`docs/runbook-gcp.md`](../runbook-gcp.md). Note for anyone tempted by the
  shortcut that started this: CI's `GCP_SA_KEY` **cannot** be read back out of
  GitHub, by design.
