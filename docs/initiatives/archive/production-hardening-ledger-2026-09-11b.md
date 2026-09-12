# Archived ledger rows PH-7 … PH-16 (verbatim), production-hardening.md

Archived 2026-09-11 in the same PR that queued PH-19, because that run's additions took the
working doc to 448 lines and the README's rule is that the Ledger is the first place to look
when a doc is over. These ten rows are the oldest in the doc and the least read; every one of
them is already discharged, and several are themselves pointers into earlier ledger archives
([2026-08-30](production-hardening-ledger-2026-08-30.md),
[2026-09-04](production-hardening-ledger-2026-09-04.md)) which still hold their fuller text.

Nothing here is superseded or wrong — it is compressed in the working doc to one line each.
Read this file before re-deriving anything about the approval handoff (PH-8), the backend test
harness (PH-9), the rate-limit division (PH-11), or the three deletion rows (PH-14/15/16),
whose reasoning about `applications` and `fosterName` is load-bearing and deliberately unpinned.

- 2026-08-28 — PH-7 (commit-shaped half only) — PR #33 — `GET /health` reports
  `firestore_reachable` via a cheap round trip that returns `False` rather than raising. The
  alerting half was declined on purpose as a hard-to-reverse infrastructure change and is
  PH-7b under "Needs a human". Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-29 — PH-9 — PR #36 — The backend test harness: `pytest`, a `Test` step in `ci.yml`'s
  `backend` job, 12 tests needing no ADC/key/network, and an in-memory Firestore fake in
  `conftest.py`. No emulator, no refactor for testability. Verified the step can turn the job
  red, off a real Actions run. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-29 — PH-8 — PR #37 — The approval handoff moved from an in-process
  `queue.Queue[bool]` to a polled `pendingApproval` field on
  `fosters/{uid}/agentSession/current` (`approval_store.py`), so a decision written
  by any instance reaches a turn parked in any other. Three fail-closed choices beyond the
  literal task: a timeout declines rather than stranding a `tool_use` with no `tool_result`;
  `session_store.save()` became `merge=True` so it can't delete an approval a turn is parked
  on; and a Firestore failure while recording the request declines, because an unaskable
  question is not a yes. 8 tests, clock injected. The two-instance case is reasoned about, not
  exercised — it
  can't be, under the pin. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-10 — PR #43 — `_stream`'s `finally` trims the **live** `agent.messages`,
  not just the stored copy; before this the 40-message cap was a persistence bound wearing a
  spend bound's clothes. Unit cases only. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-11 — PR #44 — Option (b): the per-minute limit is a per-foster budget
  divided by `MAX_CLOUD_RUN_INSTANCES`, `!!`-commented in both files that must agree. The
  recorded decision was as much the deliverable as the code — see the section above. Full row
  in the [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-12 — PR #45 — `tests/test_foster_isolation.py` pins the two invariants
  `CLAUDE.md` asserts in prose: `current_foster` as a per-context value, and one
  `Agent`/session per foster. Two real threads on a `threading.Barrier`, both negative
  directions run, no production code changed. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-14 — PR #47 — **The agent transcript dies with the account.**
  `deleteAccount()` calls `resetChat()` first, while an ID token can still be minted, and
  **refuses to delete anything else if that call fails** — a half-deleted account that still
  holds a verbatim dump of everything the foster typed is worse than one that reports an error.
  Unit-tested; the live path was not run.
- 2026-08-30 — PH-15 — PR #48 — **Deletion reaches the shelter's inbox.** `deleteAccount()`
  queries the deleted foster's `applications` rows and writes
  `{ fosterName: "(deleted account)", status: "withdrawn" }` to each before the Auth user goes.
  **Redact, don't delete** — the absent `delete` rule is deliberate; a shelter's record of who
  applied is theirs, the person's name is not. Verification became PH-15b, parked.
- 2026-08-30 — PH-16 — PR #49 — **The foster branch of `applications`'s update rule pins
  `fosterId`, `shelterId`, `dogId`, `createdAt` and `checklist`.** Requiring only the resulting
  status let one write set it *and* rewrite the shelter's ticks, or drop the row into another
  shelter's inbox. `fosterName` stays deliberately free, with a `!!` comment saying why: PH-15's
  redaction rides that exact gap, and pinning it would close a hole and break deletion in the
  same change. Allow/deny check folded into PH-15b.

