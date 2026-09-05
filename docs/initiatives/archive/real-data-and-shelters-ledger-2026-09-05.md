# Archive — `real-data-and-shelters.md`, the Ledger through RS-5b (2026-09-05)

Verbatim snapshot, taken by the run that shipped RS-12. The working doc was at **412**
lines before that run's own edits, over the README's ~400 threshold and flagged there
on 2026-09-04 with the instruction that *"the next run to touch this doc should archive
the Ledger, which is again where the growth is."* This is that. Every row below is
compressed in the working doc to one line; nothing is lost, and archives are
append-only — if something here turns out to be wrong, the correction goes in the
working doc and says so there.

## Ledger

*(Every row through RS-5 is compressed to one line. Their full text — including RS-7's
in-place correction of its own verification claim, RS-2's account of why its verification
was only partial, and RS-5's long entry on the two things it could not verify — is preserved
verbatim across the [2026-09-01 archive](archive/real-data-and-shelters-2026-09-01.md) and
the [2026-08-31 ledger archive](archive/real-data-and-shelters-ledger-2026-08-31.md), which
supersedes the [2026-08-30 one](archive/real-data-and-shelters-ledger-2026-08-30.md).)*

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed descriptions,
  diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules in
  `shelter-integration.md`'s shape, plus `createApplication()` from both apply sites.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id corrected to `"sfspca-mission"`, two dead orgs
  removed, `shelters.test.ts` added as the guard.
- 2026-08-28 — RS-2 — PR #34 — Staff resolution by `array-contains` query, the `/shelter`
  route with its own `ShelterLayout`, first `shelters/{id}` document seeded. Verification
  partial on purpose — now RS-8, parked.
- 2026-08-29 — RS-7 — PR #38 — `firestore.indexes.json` now actually deploys, plus the
  `applications` composite index.
- 2026-08-29 — RS-7 (follow-up) — PR #39 — `firestore:indexes` split into its own step after
  hosting and rules, so a missing IAM grant stops taking the site down with it.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted to the
  deploy service account; the `applications` index reached **`READY`**. Invocation in
  [`docs/runbook-gcp.md`](../runbook-gcp.md).
- 2026-08-31 — RS-5 — PR #52 — **The shelter's application inbox**, live at `/shelter`,
  replacing RS-2's placeholder. `useShelterApplications` runs one shelter's
  `where("shelterId","==",id)` + `orderBy("createdAt","desc")` against the RS-7/RS-9 index;
  the pure half is `web/src/lib/applicationView.ts`, unit tested in 8 cases without needing
  a Firebase config. Writes `applications/{id}` only — the checklist join is RS-10. **Two
  things honestly unverified:** the fixture write was refused by the unattended run's own
  safety classifier, so `applications` is still empty and the `||`-rule question the item
  was meant to settle by building is still open — see RS-5b.
- 2026-09-01 — RS-6 `[large]` — PR #54 — **Add and retire a dog**, at `/shelter/dogs`, behind the
  same staff gate as the inbox. `match /dogs/{dogId}`'s blanket `allow write: if false` became
  `create: isStaff(request.resource.data.shelter_id)` + `update: isStaff(resource.data.shelter_id)`
  with `shelter_id` pinned across the write + `delete: if false`. `useShelterDogs` is one equality
  and no `orderBy`, so **no new index**. Two things the spec hadn't seen, both fixed here because
  leaving either would have made the feature wrong rather than incomplete: **the importer would
  have deleted every hand-entered dog** (replace-not-append computes staleness as "not in this
  scrape", which a typed dog never is — it now keeps `source: shelter-manual` rows), and
  **`DogStatus` had no honest value for "retired"** (writing `adopted` would be a claim about a
  real animal nobody made, so `retired` was added to the union and to the agent's `STATUSES`).
  **Unverified, honestly:** every check needing a signed-in staff account — the form writing,
  retire removing a dog from Discovery, the rules refusing another shelter's `shelter_id` — could
  not be run unattended; the rules change was never exercised against the emulator or production.
  That is RS-6b. Full row in the
  [2026-09-02 archive](archive/real-data-and-shelters-2026-09-02.md).
- 2026-09-02 — RS-10 `[large]` — PR #56 — **The two approval checklists join by `owner`**, one writer
  per field. `composeApprovalChecklist()` overlays the shelter's `done` from
  `applications/{id}.checklist` onto the foster document's list; `useApplication.ts` fetches it with
  two equalities, **no new index**. The hazard it had to solve concretely: MatchView wrote its
  toggles from the array it rendered, which after composition would have mirrored the shelter's ticks
  into `fosters/{uid}` — it now keeps `stored` (writable) and `approval` (displayable) separate, so
  **don't collapse them back**. Two judgement calls beyond the spec: a shelter-owned item absent from
  the foster document is **appended** rather than dropped, and `DemoShelterPanel` now renders only
  when there is no application. **Unverified, honestly:** the two-party signed-in path needs a real
  shelter account and a real `applications` row, and neither exists (RS-5b). Full row in the
  [2026-09-03 archive](archive/real-data-and-shelters-2026-09-03.md).
- 2026-09-03 — RS-11 `[large]` — PR #58 — **The application round trip closes in both
  directions.** `approvalDecision()` collapses five statuses to the three that are news plus
  `null`, `approvalBadge()` layers that over each surface's own checklist-derived badge, and
  withdrawing from `SavedView` writes `status: "withdrawn"` best-effort inside a `catch` before
  the local clear — **no rules change**; PH-16's foster branch already permitted that field.
  The load-bearing edit was the signature: `activeApplication()` is now `(foster, status)` with
  the second argument **required**, so `DogDetailView` and `SavedView` cannot disagree about
  whether a declined foster is still blocked. Two calls beyond the spec: `withdrawn` releases
  the block as well as `declined`, and a declined foster gets no button that clears
  `matchedDogId`. 13 unit tests. Full row in the
  [2026-09-04 archive](archive/real-data-and-shelters-2026-09-04.md).
- 2026-09-03 — RS-11 (follow-up) — PR #59 — **The two RS-11 screens a walkthrough can't reach
  are now rendered in a test.** Driving the app end to end in `LOCAL_MODE` exercises exactly
  one of the four statuses — absence — because `status` only ever arrives from Firestore and a
  guest journey has no application document. `MatchView.test.tsx` covers the rest with
  `renderToStaticMarkup` and three mocked hooks (**no jsdom, no new dependency**), six cases,
  and the two that matter were **negative-controlled**. Full row in the archive above.
- 2026-09-04 — RS-5b — no PR (a production fixture write + a signed-in check) — **The staff
  branch of `applications`'s read rule serves the list query.** Three fixtures seeded, all three
  render at `/shelter`, and both staff write paths succeed. This was the question RS-5 shipped
  without being able to answer, and it could not be answered against an empty collection because
  Firestore evaluates a list rule per candidate document.

