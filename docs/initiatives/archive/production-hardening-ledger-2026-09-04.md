# Archive — production-hardening ledger, 2026-09-04

Verbatim snapshot of PH-14, PH-15 and PH-16's ledger rows, taken by the `dogathon-plan` run
of 2026-09-04 because that run's own edits to the PH-1 section pushed the working doc past the
README's ~400-line threshold. As the 2026-08-30 pair predicted, the growth was in the ledger,
not in stale prose: these three rows are 55 lines between them and every line of them earns its
place — which is exactly why they belong here rather than deleted. The working doc keeps the
decision, the surprises, and what was verified versus reasoned about.

Archives are append-only. If something here turns out to be wrong, correct the working doc and
say so there.

---

- 2026-08-30 — PH-14 — PR #47 — `deleteAccount()` calls `resetChat()` first, so
  `fosters/{uid}/agentSession/current` is cleared by the Admin SDK while an ID token
  can still be minted — before the careLog loop, not just before `deleteUser()`, since
  the `auth/requires-recent-login` retry re-authenticates with a popup mid-way. Two
  things shipped beyond the literal task, both because the "surface it to the caller"
  half didn't work as written: `AccountSheet.removeAccount()` was discarding every
  thrown error and rendering one fixed string, so a rethrown message reached nobody;
  it now renders the message when it's an `AccountDeletionError` (a new class, same
  idea as `ChatError`) and keeps the old copy otherwise — because printing every
  caught error would show a foster `auth/popup-closed-by-user` from a dismissed
  re-auth popup. Deliberately fatal on failure: nothing is deleted and the copy says
  so, rather than deleting the Auth user and stranding the transcript unreachable
  forever. `auth.ts` now imports `api.ts`, which imports `auth.ts` back — a real cycle,
  safe because neither side reads the other at module-evaluation time, and noted in a
  comment so nobody "fixes" it. No rules change; `agentSession/{doc}` stays
  `allow write: if false`. **Verified on unit cases only** — 5 tests in the repo's
  first `web/src/auth.test.ts`, with the whole Firebase surface faked, recording the
  order calls happen in rather than that they happened. Ran both negative directions:
  dropping the `resetChat()` call fails 3 of them, and moving it after `deleteUser()`
  fails the same 3. Not exercised against a real signed-in account, which needs a
  Google popup this run can't drive.
- 2026-08-30 — PH-15 — PR #48 — `deleteAccount()` now queries
  `applications where fosterId == uid` — the query `exportAccountData()` already
  runs — and writes `fosterName: "(deleted account)"` plus `status: "withdrawn"` to
  each row. Redact, not delete, and no `allow delete` rule added: an application has
  two legitimate owners, and a row vanishing out from under a staff member mid-review
  is the failure the shape exists to avoid. `fosterId` deliberately stays. Placed
  *before* every deletion, not merely before `deleteUser()`, for a reason the item
  didn't state and this run found: after `deleteUser()` the redaction is impossible
  **forever**, because the foster branch of the update rule needs
  `resource.data.fosterId == request.auth.uid` and that uid never signs in again — so
  a row still carrying the name at that point carries it permanently. Same argument
  as PH-14's transcript, so it fails the same way: a failed redaction is fatal, an
  `AccountDeletionError` says nothing was deleted, and nothing was. **The live rules
  check the item asked for was not run** — no popup-free way to hold a foster's ID
  token here, and no JRE for the Firestore emulator; it is written up as PH-15b under
  "Needs a human" with the exact two-direction check, rather than quietly dropped.
  5 new tests (13 total in `web/src/auth.test.ts`), three negative directions run:
  dropping `status: "withdrawn"`, adding `fosterId` to the payload, and moving the
  whole block after `deleteUser()` each fail exactly the test that names them.
- 2026-08-30 — PH-16 — PR #49 — `firestore.rules`'s foster branch on
  `applications` now also requires `fosterId`, `shelterId`, `dogId`, `createdAt` and
  `checklist` to equal their existing values, so a withdraw can no longer smuggle in
  a `checklist` rewrite (undoing a shelter's ticks) or a `shelterId` rewrite (moving
  the row into another shelter's inbox, which RS-5's query filters on). `fosterName`
  is deliberately left free and carries a `!!` comment block saying so and naming
  PH-15 — pinning it would have closed this hole and broken account deletion in the
  same change, permanently, since this branch needs a uid that never signs in again.
  Staff branch untouched. **Verified as far as it can be without a signed-in foster:**
  `firebase deploy --only firestore:rules --dry-run` compiles the file against
  Google's own rules compiler and reports success — and the negative direction was run
  too, deliberately breaking the new clause and watching the same command reject it
  with `[E] 69:77 - Unexpected ')'`. That proves it *compiles*, not that it
  allows and denies the right writes; that half is PH-15b. Worth knowing generally:
  CI never touches `firestore.rules`, so a rules typo is invisible until
  `deploy-frontend.yml` runs on merge — the dry run is the only pre-merge check there
  is, and it needs a logged-in `firebase` CLI.
