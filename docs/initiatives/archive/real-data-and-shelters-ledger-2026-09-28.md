# Archived 2026-09-28 from real-data-and-shelters.md — Ledger rows RS-4, RS-13, RS-14, verbatim

- 2026-09-09 — RS-4 — PR #72 — **a weekly, plan-only-by-construction roster check** on
  `import-dogs.yml` (`schedule: "0 9 * * 1"`; the scheduled branch always re-scrapes and has no path
  to a Firestore write), reporting drift as one reused `roster-drift` issue. Its first real run
  (2026-09-14) failed `403` from the GitHub runner — see RS-13.
- 2026-09-17 — RS-13 — PR #88 — **the weekly check can say *could not look*.** `import_dogs.py`
  exits `EXIT_UNREACHABLE = 75` having written nothing on an `httpx.HTTPError` **or a fresh scrape
  of zero dogs** (the case the spec missed: `sfspca.scrape()` swallows per-page errors), and the
  scheduled branch files that on the same issue. Manual dispatch unchanged. Observed on a real run
  2026-09-21 (issue #96). M4 stays open on RS-13b.

*(Both rows verbatim in
[`archive/real-data-and-shelters-routing-ledger-2026-09-22.md`](archive/real-data-and-shelters-routing-ledger-2026-09-22.md);
RS-4's also in [`archive/real-data-and-shelters-rs4-2026-09-17.md`](archive/real-data-and-shelters-rs4-2026-09-17.md).)*
- 2026-09-23 — RS-14 `[large]` — PR #102 — **a pickup request lands where the shelter reads it, and
  only the shelter answers.** `requestPickup()` writes `applications/{id}.pickup` *before*
  `fosters/{uid}.pickup` (a failed first write skips the second and says so); a third foster branch
  in `firestore.rules` admits only `pickup`/`pickupConfirmedAt`/`updatedAt` via `affectedKeys().hasOnly`
  — stricter than the spec's field-by-field pins, same intent — on a live application, with
  `pickupConfirmedAt` settable only to `null`. `pickupState()` says *confirmed* only on the staff
  stamp **and** matching slots; the timeline gains a fifth stage and a confirmation ticks all five.
  Inbox: a "Pickup requested" pill and **Confirm pickup / Undo confirmation**. The chat is titled
  Pawthway's assistant and its prompt no longer speaks as the shelter. **Beyond the spec:** the
  census had missed a third "agree the day" — `calendar.ts`'s `.ics` description told the foster to
  "message them in the app"; the prompt claimed the agent could "change the pickup" when no tool
  writes it; and Confirm is hidden on *declined* as well as withdrawn, matching the rule's
  live-status list. Verified: 182 vitest (pickupState's three states, mismatch, absent application;
  shelter helpers; four new rendered `MatchView` cases), 73 pytest incl. `test_pickup_voice.py`,
  build, lint at 8. **Not verified:** the rules change, and any of it in a browser — the unattended
  run can't start a dev server or sign in. That is RS-14b.

## Also archived 2026-09-28 — Ledger rows M1 through RS-12, verbatim

- 2026-08-24 — M1 — PRs #6, #13, #14 — offline SF SPCA import, reviewed descriptions,
  diff-before-write, replace-not-append.
- 2026-08-24 — RS-1 — PR #21 — `applications/{id}` and `shelters/{id}` rules, plus
  `createApplication()` from both apply sites.
- 2026-08-25 — RS-3 — PR #24 — SF SPCA's id corrected to `"sfspca-mission"`; `shelters.test.ts`
  added as the guard.
- 2026-08-28 — RS-2 — PR #34 — staff resolution by `array-contains` query, the `/shelter` route,
  first `shelters/{id}` document seeded. Verification partial on purpose — now RS-8, parked.
- 2026-08-29 — RS-7 — PRs #38, #39 — `firestore.indexes.json` actually deploys, in its own step
  after hosting and rules.
- 2026-08-29 — RS-9 — no PR (an IAM change) — `roles/datastore.indexAdmin` granted; the
  `applications` index reached **`READY`**. Invocation in [`docs/runbook-gcp.md`](../runbook-gcp.md).
- 2026-08-31 — RS-5 — PR #52 — **the shelter's application inbox**, live at `/shelter`. Pure half
  in `web/src/lib/applicationView.ts`, 8 unit tests, no Firebase config needed. Shipped unable to
  verify its own read rule against an empty collection — that became RS-5b.
- 2026-09-01 — RS-6 `[large]` — PR #54 — **add and retire a dog** at `/shelter/dogs`. Split
  `match /dogs/{dogId}`'s blanket `allow write: if false` into create/update (both `isStaff`,
  `shelter_id` pinned) + `delete: if false`; **no new index**. Two things the spec hadn't seen and
  this fixed: the importer would have deleted every hand-entered dog, and `DogStatus` had no
  honest value for "retired".
- 2026-09-02 — RS-10 `[large]` — PR #56 — **the two approval checklists join by `owner`**, one
  writer per field. `composeApprovalChecklist()` overlays the shelter's `done` onto the foster
  document's list; MatchView keeps `stored` (writable) and `approval` (displayable) separate —
  **don't collapse them back**.
- 2026-09-03 — RS-11 `[large]` — PRs #58, #59 — **the round trip closes in both directions.**
  `approvalDecision()` + `approvalBadge()` under the `declined` > `withdrawn` > `approved` >
  checklist precedence; withdrawing writes `withdrawn` back, **no rules change**.
  `activeApplication()` became `(foster, status)` with the second argument **required**, so two
  call sites cannot disagree. 13 unit tests, plus six rendered cases in `MatchView.test.tsx`
  (`renderToStaticMarkup`, no jsdom, no new dependency).
- 2026-09-04 — RS-5b — no PR (a production fixture write + a signed-in check) — **the staff branch
  of `applications`'s read rule serves the list query.** Three fixtures seeded, all three render at
  `/shelter`, both staff write paths succeed. It could not be answered against an empty collection
  because Firestore evaluates a list rule per candidate document.
- 2026-09-05 — RS-12 `[large]` — PR #63 — **the dog comes back, and the shelter sees it.** The
  agent's `adoption_profile`, written since the first Post Foster turn and read by nothing, lands in
  a **Back from foster** group atop `ShelterRosterView`; `rosterActions` (plural); **no rules
  change**; `notified_shelter` is true because the write lands where RS-5b proved staff read.
  Discharges **PH-1**. Full row in
  [`archive/real-data-and-shelters-rs12row-2026-09-17.md`](archive/real-data-and-shelters-rs12row-2026-09-17.md).
