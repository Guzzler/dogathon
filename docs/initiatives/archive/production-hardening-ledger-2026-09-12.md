# Archive — `production-hardening.md`'s compressed ledger rows, PH-1 … PH-16 (2026-09-12)

Snapshot of the sixteen one-line ledger rows as they stood in the working doc on 2026-09-12,
taken because `production-hardening.md` was at its ceiling for a fourth consecutive run and
this was the cheapest honest cut: **every one of these rows is already a compression of a
longer row that is itself archived**, so moving them here loses nothing that was not already
two hops away. The working doc now carries one pointer line in their place.

Where the *uncompressed* versions live, since that is the thing to follow when re-deriving
anything: PH-1 … PH-6 in [`production-hardening-2026-08-29.md`](production-hardening-2026-08-29.md);
PH-7 … PH-16 in [`production-hardening-ledger-2026-09-11b.md`](production-hardening-ledger-2026-09-11b.md)
and [`production-hardening-ledger-2026-09-04.md`](production-hardening-ledger-2026-09-04.md).

---

*(Rows for PH-1 through PH-6 are compressed to one line each below; each one's
full text, including what shipped smaller than queued and why, is preserved
verbatim in the [archive](archive/production-hardening-2026-08-29.md).)*

- 2026-08-24 — PH-1 — PR #19 — `send_adoption_profile_to_shelter` returns
  `notified_shelter: arcade_tools.available()` instead of a hardcoded `True`.
- 2026-08-24 — PH-2 — PR #20 — Client-side `deleteAccount()`: careLog docs, then
  `fosters/{uid}`, then the Auth user. No rules change needed.
- 2026-08-25 — PH-3 — PR #23 — `session_store.py` persists the transcript as a
  `messagesJson` string, trimmed to 40 on write; `_stream` saves, `/reset` deletes.
- 2026-08-26 — PH-4 — PR #27 — `"strict": true` made explicit in
  `web/tsconfig.app.json`. A pin, not a fix — TypeScript 6 already defaulted it on.
- 2026-08-26 — PH-6 — PR #28 — `exportAccountData()` builds a JSON blob of the
  foster doc, its careLog, and its `applications` rows. No new dependency.
- 2026-08-26 — PH-5 — PR #29 — `migrateGuestData()` copies localStorage guest
  state into `fosters/{uid}` on first sign-in. Shipped smaller than queued: there
  is no anonymous Auth session to `linkWithCredential`. **Not verified live.**
- 2026-08-28 — PH-7 (commit-shaped half) — PR #33 — `GET /health` reports `firestore_reachable`
  via a round trip that returns `False` rather than raising. Alerting half declined on purpose
  (hard-to-reverse infra); it is PH-7b, parked.
- 2026-08-29 — PH-9 — PR #36 — The backend test harness: `pytest`, a `Test` step in `ci.yml`,
  12 tests needing no ADC/key/network, an in-memory Firestore fake. Verified it can turn the
  job red off a real Actions run.
- 2026-08-29 — PH-8 — PR #37 — The approval handoff moved from an in-process `queue.Queue` to a
  polled `pendingApproval` field (`approval_store.py`), so a decision written by any instance
  reaches a turn parked in any other. Three fail-closed choices beyond the task; the
  two-instance case is reasoned about, not exercised — it can't be, under the pin.
- 2026-08-30 — PH-10 — PR #43 — `_stream`'s `finally` trims the **live** `agent.messages`, not
  just the stored copy; the 40-message cap had been a persistence bound in a spend bound's
  clothes.
- 2026-08-30 — PH-11 — PR #44 — The per-minute limit is a per-foster budget divided by
  `MAX_CLOUD_RUN_INSTANCES`, `!!`-commented in both files that must agree. The recorded decision
  was as much the deliverable as the code.
- 2026-08-30 — PH-12 — PR #45 — `tests/test_foster_isolation.py` pins the two invariants
  `CLAUDE.md` asserts in prose. Two real threads on a `threading.Barrier`; no production code
  changed.
- 2026-08-30 — PH-14 — PR #47 — **The agent transcript dies with the account.** `deleteAccount()`
  calls `resetChat()` first and **refuses to delete anything else if that fails**. Live path not
  run.
- 2026-08-30 — PH-15 — PR #48 — **Deletion reaches the shelter's inbox**, by redaction:
  `{ fosterName: "(deleted account)", status: "withdrawn" }`. **Redact, don't delete** — the
  absent `delete` rule is deliberate. Verification became PH-15b, parked.
- 2026-08-30 — PH-16 — PR #49 — The foster branch of `applications`'s update rule pins every
  field but `fosterName`, which stays free with a `!!` comment saying why: PH-15's redaction
  rides that exact gap.

*(Full verbatim text of these ten rows — 51 lines — in the
[2026-09-11 ledger archive](archive/production-hardening-ledger-2026-09-11b.md). Read it before
re-deriving anything about the approval handoff or the `applications` rules.)*

*(Full text of these three rows — 55 lines, all of it load-bearing — in the
[2026-09-04 ledger archive](archive/production-hardening-ledger-2026-09-04.md).)*
