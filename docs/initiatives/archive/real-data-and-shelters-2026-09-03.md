# Archive — real-data-and-shelters.md, 2026-09-03

Verbatim snapshot taken by the `dogathon-plan` run of 2026-09-03, when that run's own
edits (a new design answer on the three "approved" signals, plus the corrections to
RS-11) would have carried the working doc past the README's ~400-line threshold.

Two things were taken, both by the rule the 2026-09-01 and 2026-09-02 runs arrived at:
a design answer stops earning its length the moment its own queue item restates it, and
after a `[large]` item ships, its design section and its ledger row are two tellings of
one story. RS-11's queue item already contains both "must not do" rules from the design
section below word for word, and RS-10's ledger row below is the long telling of a
design section that was itself already compressed in the 2026-09-02 archive.

Archives are append-only. If something here turns out to be wrong, correct the working
doc and say so there.

---

## Settled 2026-09-02 — the application document is written by both sides and read by only one each (verbatim)


RS-5 gave staff an inbox that can move an application to `approved` or `declined`, and RS-6 gave
them a roster. Reading both against `main` this run turned up something neither item claimed and
neither is a bug in: **`applications/{id}` is a two-owner record whose round trip is missing in
both directions.**

- **The shelter's decision never reaches the foster.** `setApplicationStatus()` has exactly one
  caller — `ShelterApplicationsView.tsx:260` — and `ApplicationStatus` is read on the shelter
  side only (`web/src/lib/applicationView.ts`). Grep the foster surfaces and the word `declined`
  does not appear. `MatchView.tsx:55` and `SavedView.tsx:158` both derive their status from
  `foster.approvalChecklist` alone, so a declined foster goes on seeing *"⏳ Waiting for
  approval"* and a pickup scheduler for a dog they will not get, indefinitely. That is the app
  telling a foster something untrue about a real animal — `production-hardening.md`'s framing,
  on `real-data-and-shelters.md`'s surface.
- **The foster's withdrawal never reaches the shelter.** `SavedView.tsx:163`'s `withdraw` clears
  `matchedDogId` and `phase` on the foster document and stops. It never writes
  `status: "withdrawn"` — so the row stays live in the shelter's inbox forever, and a staff
  member reviews an application nobody is waiting on. The rules branch built for exactly this
  (PH-16's deliberately-narrow foster branch, `firestore.rules:57-62`) has **one** caller today,
  and it is account deletion (`auth.ts:173`), not the withdraw button.

**Decision: this is one flow, and it is a separate item from RS-10, not a widening of it.** Both
halves need `useApplication.ts`, which RS-10 builds, so RS-11 is gated on RS-10 shipping rather
than merged into it. Merging them would produce a single PR touching the hook, both foster
views, the shelter inbox, the agent tool and the rules-adjacent withdraw path at once — the
shape that leaves the repo half-working if it stalls. Sequencing beats bundling here precisely
*because* both items are large.

Two things the build must not do, decided here so RS-11 doesn't re-open them:

- **`declined` is not a phase change.** Do not auto-clear `matchedDogId` or push the foster back
  to `discovery` on a decline. A person finding out they were turned down for a specific dog
  should read it as a sentence on the screen they were already on, and choose to move on
  themselves — silently teleporting them to the swipe feed is the app deciding how they feel
  about it. `activeApplication()`'s one-foster-at-a-time block (`web/src/lib/foster.ts`) is what
  needs to release, and it should release on the *declined status*, not on a mutation.
- **The withdraw write must be best-effort, and the local clear must not depend on it.** A guest
  or `LOCAL_MODE` foster has no `applications` row at all, and a signed-in one may have a write
  refused. `withdraw` clearing the foster document is the part the user asked for; the
  application update is the part the shelter needs. Fire the second, don't block the first on it.

---

## RS-10's Ledger row (verbatim, 2026-09-02)

- 2026-09-02 — RS-10 `[large]` — PR #__ — **The two approval checklists join by `owner`**, one
  writer per field. `composeApprovalChecklist()` (`web/src/lib/applicationView.ts`) overlays the
  shelter's `done` from `applications/{id}.checklist` onto the foster document's list, and
  `web/src/hooks/useApplication.ts` fetches it with `fosterId ==` + `dogId ==` — two equalities,
  **no `orderBy`, no new index**, exactly as specced. `MatchView` and `SavedView`'s `AppliedCard`
  both read the composed list, so the badge and the Applications timeline can't disagree.
  `update_checklist` in `src/agent/builtin/foster.py` now raises on a shelter-owned approval id.
  **The one hazard the spec named and the build had to solve concretely:** MatchView wrote its
  toggles from the same array it rendered, which after composition would have mirrored the
  shelter's ticks into `fosters/{uid}` — the last-write-wins failure the design explicitly rules
  out. It now keeps `stored` (writable) and `approval` (displayable) as separate values; if you
  edit that file, don't collapse them back.
  **Two judgement calls not in the spec.** A shelter-owned item present on the application but
  absent from the foster document is **appended** rather than dropped — a step the shelter is
  tracking and the foster cannot see is the exact failure this join removes. And
  `DemoShelterPanel` now renders only when there is **no** application: with a real one, its
  writes land in a field this screen no longer reads, and a fake dashboard silently doing nothing
  is worse than no dashboard.
  **Verified:** `npm run build`/`test`/`lint` green, no new lint warnings; 7 new unit tests over
  the composition covering the four cases the item named plus legacy `owner`-less records,
  the append case, and non-mutation; `import agent.server` plus the owner-resolution table
  exercised directly. **Unverified, honestly:** the two-party signed-in path — staff ticking a
  step on `/shelter` and a foster seeing it move — needs a real shelter account and a real
  `applications` document, and neither exists yet (RS-5b). Nothing in this PR was exercised
  against production Firestore.
