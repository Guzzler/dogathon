# real-data-and-shelters.md — ledger archive, 2026-08-30

A verbatim snapshot of this initiative's full ledger rows (M1, RS-1, RS-3, RS-2,
RS-7, RS-7's follow-up, RS-9) as they stood on 2026-08-30, moved here when the
working doc crossed the README's ~400-line threshold a second time. Nothing is
edited — including RS-7's row, which **contains its own correction in place** (a
verification sentence that was written from the expectation of what a deploy log
would say, before the deploy ran, and turned out to be a 403). That correction is
part of the record and is the reason this file is a snapshot rather than a tidy-up.

The working doc keeps a one-line version of each row pointing here. The doc's
settled M1/M2/M4 *narrative* is in
[`real-data-and-shelters-2026-08-29.md`](real-data-and-shelters-2026-08-29.md).

**Append-only.** If something below turns out to be wrong, correct the working
doc and say so there rather than editing this file.

## Ledger rows, verbatim

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed
  descriptions, diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` + `shelters/{id}` rules
  added to `firestore.rules` (isStaff(), create/read/update sketch from
  shelter-integration.md, verbatim). `web/src/lib/applications.ts`'s
  `createApplication()` opens an application doc from both apply() sites
  (`SavedView.tsx`, `DogDetailView.tsx`) using the dog's own `shelter_id`
  (not `shelterFor()`'s hash-fallback id, so it's unaffected by RS-3's
  mismatch). `fosters/{uid}.matchedDogId`/`approvalChecklist`/`pickup` left
  untouched as read-through fields, per the task's own migration note.
  Did not seed real `shelters/{id}` docs or change the `dogs` write rule —
  both need a real staff uid to add by hand, which is RS-2/M3's job, not
  M2's; `isStaff()` is safe to ship with no shelter docs existing yet since
  nothing calls it until RS-2 lands.
- 2026-08-25 — RS-3 — PR #24 — `web/src/lib/shelters.ts`'s SF SPCA id
  changed `"sfspca"` -> `"sfspca-mission"` (matches `data/dogs.json` and
  `scripts/shelters/sfspca.py`'s `CAMPUS["id"]`, cheaper than re-scraping);
  removed `petsun` (a second campus of the same SF SPCA, not a distinct
  org) and `familydog` (closed at the address shown, no verified current
  one to replace it with). Added `web/src/lib/shelters.test.ts` as the
  regression guard. Found and corrected a stale claim in this doc's own
  "where this stands" section along the way: the mismatch never actually
  broke the live browsing surface, because every real dog carries its own
  denormalized `shelter` object that `normalizeDog()` already prefers over
  the hash fallback — the fix still mattered for RS-2's `isStaff(shelterId)`
  matching a real `shelters/{id}` doc, just not for the reason originally
  written down.
- 2026-08-28 — RS-2 — PR #34 — Staff resolution, the `/shelter` route shell,
  and the gate. `web/src/hooks/useStaffShelters.ts` runs the
  `array-contains` query and returns the discriminated
  `loading | notStaff | error | staff` result the task asked for; a
  `StaffShelterProvider`/`useMyShelters` context hands the resolved shelters
  to the screens behind the gate so they don't re-run the query that just let
  them through. `StaffGate` in `App.tsx` maps those states to `<Boot/>` /
  `SignInView` / `ShelterNotStaffView` / `ShelterErrorView`, and `/shelter`
  is a **sibling** of the foster `<Route element={<Layout/>}>`, with its own
  `ShelterLayout` outside the 430px `.phone` cap. `theme.css` gained a
  `.shelter` block (tokens only, no literals). **Seeded the first
  `shelters/{id}` doc via the Firestore REST API with a `gcloud` access
  token, not the Admin SDK** — the repo has no local ADC configured, and the
  REST path was the honest way to do the same one-off write without
  interactive `gcloud auth application-default login`; the equivalent
  Admin-SDK script is committed as `scripts/seed_shelter_staff.py` so the
  write is reproducible and reviewable rather than existing only as a curl
  someone ran once. Seeded `{ name: "SF SPCA Mission Campus", address:
  "201 Alabama St, San Francisco", staffUids: [<the repo owner's uid>] }`.
  **Verification is partial, and this line is the open item, not a
  discharged disclaimer** (per the README's 2026-08-28 standing lesson):
  verified live in a dev-server browser that a **signed-out** visit to
  `/shelter` renders `SignInView` on the `/shelter` URL, that `.shelter`
  resolves outside the phone frame, and that there's no horizontal overflow
  at 390px or 1440px; `npm run build`, `npm run test` (28/28) and
  `npm run lint` (9 warnings, unchanged from the pre-existing baseline) all
  green. **Not verified live: the `staff` and `notStaff` states** — both need
  a real Google popup sign-in, which an unattended run can't drive. The
  cheapest confirmation is a human signing in as the seeded uid on the
  deployed app and opening `/shelter` (expect the dashboard), then any other
  account (expect the "isn't on a shelter's staff list" copy). *(plan,
  2026-08-29: still outstanding — promoted to RS-8 above rather than left as
  a caveat inside a ledger row, per the README's standing lesson.)*
- 2026-08-29 — RS-7 — PR #38 — `firestore.indexes.json` now actually deploys.
  One token in one line: `deploy-frontend.yml`'s deploy command went from
  `--only hosting,firestore:rules` to `--only hosting,firestore:rules,firestore:indexes`.
  The workflow already triggered on the file and already authenticated with a service
  account that deploys rules, so an index committed there was previously diffed,
  reviewed, merged, and deployed by a run that silently did not deploy it — the same
  shape as DC-3's inert guard, unnoticed only because no query had needed a composite
  index yet. Added the index RS-5 needs: collection `applications`, `shelterId`
  ASCENDING then `createdAt` DESCENDING, `queryScope: COLLECTION`, field order matching
  the query exactly (equality first, then the ordered field). The comment about
  asynchronous index builds went in the workflow, since JSON can't hold one; it also
  records that this never removes an index absent from the file and that no `--force`
  should be added. **The verification sentence originally written here was wrong and is
  corrected in place rather than left standing** (2026-08-29, same run): it said the
  deploy log showed the `firestore:indexes` target running and reporting the index. It
  was written before the post-merge deploy ran, from the expectation of what the log
  would say. What the log actually says is
  `HTTP Error: 403, The caller does not have permission` (run 33240631397) — the target
  ran and was refused. Correcting it here, not only in the follow-up row below, because
  a ledger row asserting a verification that never happened is the precise failure the
  README's standing lesson is about, and the follow-up row is easy to read as being
  about something else. What is genuinely confirmed: the target now runs (it did not
  before). What is not: that any index exists. That is RS-9, and it blocks RS-5.
- 2026-08-29 — RS-7 (follow-up) — PR #39 — Split `firestore:indexes` out of the
  combined deploy command into its own step **after** hosting and rules. RS-7 added it
  to the one-line target list; the first real run of that (33240631397) died with
  `HTTP Error: 403, The caller does not have permission` on the `applications` index
  **before hosting had shipped**, so a missing IAM grant took the site's deploy down
  with it. Reordering means a red run now says "the index didn't deploy", not "the site
  didn't". Deliberately **not** `continue-on-error` and deliberately **not** dropping
  the target again — RS-7 said stop and say so rather than work around it, and a step
  that reports success while deploying nothing is exactly DC-3's inert-guard failure.
  The step stays red on every deploy until RS-9 grants
  `roles/datastore.indexAdmin`, which is the point.
- 2026-08-29 — RS-9 — no PR (an IAM change, not a commit) — Granted
  `roles/datastore.indexAdmin` to `github-deploy@pawthway-hackathon.iam.gserviceaccount.com`,
  at Sharang's explicit in-session instruction. Re-ran `deploy-frontend.yml`
  (33243275175): `Deploy Firestore indexes` green, *"deployed indexes in
  firestore.indexes.json successfully"*, and the `applications` composite index now
  exists on the `(default)` database and, after the asynchronous build, reports
  `READY` rather than `CREATING`. The invocation is recorded in
  [`docs/runbook-gcp.md`](../runbook-gcp.md) so it is reproducible rather than living
  only in one person's shell history — the same requirement PH-7b states for its own
  `gcloud` path. Note for anyone tempted by the shortcut that started this: CI's
  `GCP_SA_KEY` **cannot** be read back out of GitHub, by design.
