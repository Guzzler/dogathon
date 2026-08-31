# production-hardening.md — ledger archive, 2026-08-30

A verbatim snapshot of the full ledger rows for **PH-7 through PH-12**, moved
here on 2026-08-30 when `production-hardening.md` crossed the README's ~400-line
threshold for the second time. Nothing here is edited: each row is exactly as
execute wrote it, with the single exception that the three `PR #__` placeholders
carried by PH-10, PH-11 and PH-12 are backfilled to **#43, #44 and #45** in the
same move, per the README's backfill convention.

The working doc keeps a one-line version of each of these rows pointing here.
Rows for PH-1 through PH-6 are in
[`production-hardening-2026-08-29.md`](production-hardening-2026-08-29.md),
along with that doc's settled H1 / notification / deletion narrative.

**Append-only.** If something below turns out to be wrong, correct the working
doc and say so there rather than editing this file.

## Ledger rows, verbatim

- 2026-08-28 — PH-7 (commit-shaped half only) — PR #33 — `GET /health` in
  `src/agent/server.py` now also reports `firestore_reachable`: a
  `_firestore_reachable()` helper does the cheapest possible round trip
  (`db().collection("dogs").limit(1).stream()`, at most one document, against
  a collection that's `allow read: if true` regardless) and returns `False`
  on any exception rather than raising, logging via `logging.exception` the
  same way the two existing failure points already do. `active_sessions` was
  already present (added in `ab86b82`, before this doc described it as
  missing — the doc's "already reports arcade_available" premise undercounted
  what was there). Did **not** do the alerting half: creating a live Cloud
  Logging log-based alert policy and notification channel is a real,
  hard-to-reverse change to shared GCP infrastructure (cost/quota
  implications, sends real email) that an unattended run shouldn't take on
  its own judgment — the task's own escape hatch ("stop and say so in the PR
  rather than half-doing it") is what this is invoking. `gcloud` is
  authenticated against `pawthway-hackathon` in this environment if a human
  wants to run the `logging` alert-policy commands directly; PH-8 stays
  gated until that half lands. Verified: forced the failure path locally
  (no ADC configured here) and confirmed `_firestore_reachable()` returns
  `False` without raising —
  `{'anthropic_key_set': False, 'arcade_available': False,
  'firestore_reachable': False, 'tool_count': 14, 'active_sessions': 0}`;
  `uv run python -c "import agent.server"` and `compileall` both clean. Did
  not curl the deployed `/health` post-merge — left as a spot-check for
  whoever reads this ledger row next, since doing so isn't blocking.
- 2026-08-29 — PH-9 — PR #36 — Backend test harness: `pytest>=8.0` as a
  `[dependency-groups] dev` entry in `pyproject.toml` (regenerated `uv.lock` in
  the same commit so `uv sync --locked` stays clean), a `[tool.pytest.ini_options]
  testpaths = ["tests"]` so discovery doesn't walk `web/`, and a `Test` step
  running `uv run pytest` appended to `ci.yml`'s `backend` job — the import and
  compileall steps kept, not replaced, since they cover `scripts/` and the CLI.
  12 tests, all runnable with no ADC, no `ANTHROPIC_API_KEY` and no network:
  `tests/test_session_store.py` covers the save/load round trip through nested
  `content` blocks, that the transcript is stored as a single `messagesJson`
  **string** field, that the 40-message trim keeps the **newest** 40 (the
  assertion PH-9 called out — keeping the oldest would be silent and very
  confusing), corrupt-JSON tolerance, `clear()`, and overwrite-not-append;
  `tests/test_health.py` covers `GET /health`'s exact key set with
  `_firestore_reachable` patched both ways via `TestClient`, that `/health`
  needs no `Authorization` header, that `tool_count` matches the import-time
  registry, and — one addition beyond the queued list — that `POST /chat`
  without a token is still 401, pinning PR #9's auth check so it can't be
  refactored away quietly. `tests/conftest.py` holds a ~60-line in-memory
  Firestore fake (`document`/`get`/`set`/`delete`) that `session_store.db` is
  monkeypatched onto. **No emulator, no Anthropic mock, no refactor for
  testability**, per the item's own instruction. Verified: `uv run pytest` green
  locally (12 passed) and in CI, `uv sync --locked` clean, and the new step was
  confirmed able to turn the `backend` job **red** by pushing a deliberately
  broken assertion to this branch and reading the failure back off the real
  Actions run before reverting it — the `backend` job went red at the `Test`
  step in run 33240237512, then green again in the run on the revert.
- 2026-08-29 — PH-8 — PR #37 — The approval handoff moved from an in-process
  `queue.Queue[bool]` to a polled Firestore field. New `src/agent/approval_store.py`:
  `request()` writes a `pendingApproval` map (`requestId`, `tool`, `decision`,
  `requestedAt`) onto `fosters/{uid}/agentSession/current` with `merge=True`,
  `wait()` polls it once a second against the same 300s ceiling, `resolve()` writes
  the decision, `clear()` nulls the field. `Session.approvals` is gone;
  `_build_agent` now closes over `_await_approval(foster_id, name)`; `/approve` calls
  `approval_store.resolve()` and **no longer touches `_session()`** — building a
  session just to reach a queue was the old shape, and the thread waiting may be in
  another instance. Went with the poll over a real-time listener exactly as the item
  suggested: a listener is a second concurrency model inside a thread that is already
  blocking, and 300 document reads for the worst case is a rounding error next to the
  model call in the same turn. **Three deliberate changes beyond the literal task.**
  (1) A timeout now returns `False` (declined) instead of letting `queue.Empty`
  escape — the old behaviour aborted the stream leaving an assistant `tool_use`
  block with no matching `tool_result`, which the next request would send back to the
  API; declining keeps the transcript well-formed. (2) `session_store.save()` now uses
  `merge=True`, because a plain `set()` on the shared document would delete a
  `pendingApproval` a turn is parked on. (3) A Firestore failure while *recording* the
  request declines rather than proceeding — an unaskable question is not a yes.
  No rules change: both sides run server-side through the Admin SDK, so
  `agentSession/{doc}` stays owner-read / no-client-write. **The instance pins were not
  touched**, per the item's own instruction; `deploy-backend.yml`'s comment now says the
  pin is removable, why, and that lifting it is its own change.
  Verified — and this line distinguishes what was exercised from what was reasoned
  about, per the item's request. **Exercised**, in 8 new tests in
  `tests/test_approval_store.py` (20 backend tests total, green locally and in CI):
  two approvals in one session both resolving; an unanswered approval waiting the full
  300s and then declining (driven through an injected clock, so the test doesn't sleep);
  a request whose document vanishes underneath it — the `/reset` and restart case —
  declining immediately rather than waiting out the ceiling; a stale request not
  consuming a newer request's answer; a double-tapped `/approve` reporting nothing
  pending; a decision arriving mid-poll being picked up promptly; a transient Firestore
  error not deciding the question in either direction; and the transcript and the
  approval sharing one document without clobbering each other. **Reasoned about only:**
  the actual two-instance case — it cannot be observed while `--max-instances=1`
  stands, which is the deliberate ordering, and the thing to watch when the pin is
  lifted is an approval issued against one instance being answered against another.
  Also not exercised end-to-end: a real dangerous-tool approval through the browser UI,
  which needs a signed-in foster and a live Anthropic key.
- 2026-08-30 — PH-10 — PR #43 — `session_store.trim()` is now the one place the
  40-message bound is applied, and `server._stream`'s `finally` applies it to the
  **live** `session.agent.messages` before saving, not just to the stored copy.
  Before this, `--min-instances=1` kept an instance warm and nothing trimmed the
  in-memory list, so a long conversation was re-sent to the API in full on every
  turn — the cap was a persistence bound wearing a spend bound's clothes. The trim
  is boundary-aware as the item required: it walks **backwards** from the blind cut
  point to the nearest message that starts a clean turn (a `user` message carrying
  no `tool_result` block), and keeps everything if no such message exists —
  over-keeping costs tokens, under-keeping sends the API a `tool_result` whose
  `tool_use` is gone and 400s the next message. Put in `session_store` rather than
  `loop.py` per the item: the CLI shares `loop.py` and has no stored transcript to
  stay consistent with. `MAX_STORED_MESSAGES`' comment now says it is both bounds.
  Verified: **unit cases only** — no real over-length conversation was exercised,
  which needs a live Anthropic key and ~20 turns. Four new tests in
  `tests/test_session_store.py` (24 backend tests total, green locally): a
  transcript under the bound returned unchanged; a 62-message transcript whose
  blind `[-40:]` cut provably lands on a `tool_result` (the test asserts the
  fixture still reproduces that, so it can't rot into passing vacuously) trimmed to
  the clean boundary two messages earlier instead; a pathological transcript with
  no clean boundary keeping everything; and `save()` storing the boundary trim. Ran
  the negative direction as the item asked — restoring the blind slice fails
  exactly those three, passes the other 21.
- 2026-08-30 — PH-11 — PR #44 — Took **option (b)**: `CHAT_REQUESTS_PER_MINUTE` is
  now derived, `max(1, CHAT_REQUESTS_PER_MINUTE_BUDGET // MAX_CLOUD_RUN_INSTANCES)`,
  with the budget (20, what a foster gets across the whole service) separated from
  the instance count it is divided by. The recorded decision — including why (a),
  the Firestore-backed bucket, lost, and the condition under which to revisit it —
  is the section "What the rate limit means with more than one instance" above, and
  is as much the deliverable as the code per the item. Matching `!!` comment blocks
  sit in `src/agent/server.py` and next to `--max-instances` in
  `deploy-backend.yml`, since the flag is where the number actually gets changed.
  **No numeric change today**: `--max-instances` is still 1, so the division is by
  1; PH-13 raises both together. `--min-instances`/`--max-instances` untouched, per
  the item. Verified: 6 new tests in `tests/test_rate_limit.py` (30 backend tests
  total, green locally) — there was previously no test of the rate limiter at all.
  They drive `time.monotonic` by hand rather than sleeping: the full burst is
  admitted and the next request refused; a refused foster is admitted again after
  exactly one token's worth of refill and then refused again; the bucket doesn't
  refill past full after an hour idle; one foster exhausting their bucket doesn't
  throttle another; and an idle bucket is evicted rather than accumulating per
  visitor. Plus an assertion that the division itself exists, so deleting the tie
  between the two constants breaks a test rather than a bill.
- 2026-08-30 — PH-12 — PR #45 — `tests/test_foster_isolation.py`, 4 tests (34
  backend tests total, green locally), pinning the two invariants `CLAUDE.md`
  asserts in prose and nothing enforced. (1) Two concurrent `_stream` generators
  for different foster ids each read their **own** id back from `current_foster()`
  while the other is mid-stream. Driven in two real threads with a
  `threading.Barrier`, deliberately: FastAPI iterates a sync generator in a
  threadpool worker, so it is the per-thread context that keeps two streams apart
  — a plain generator does *not* get its own context, so interleaving two of them
  in one thread would have proved nothing and passed against a global. The barrier
  is what makes it a real test: without it each thread sets and reads before the
  other runs, and a global passes. (2) A companion from the other end: two streams
  persist their transcripts to their own `fosters/{uid}/agentSession/current` and
  neither leaks into the other. (3) `_session("a")` and `_session("b")` return
  distinct `Session`s, distinct `Agent`s and distinct `messages` lists, and the
  same foster keeps theirs. (4) Evicting one session leaves the other's agent and
  transcript untouched, and the evicted one comes back rebuilt and empty rather
  than sharing.
  **Ran the negative direction in both cases, as the item required.** Replacing the
  ContextVar in `current_foster.py` with a module-level variable fails test (1)
  and only test (1). Making `_session()` hand everyone the first existing session —
  the "one shared Agent" simplification — fails (3) and (4). Both restored after.
  No production code was changed: `_build_agent` is monkeypatched in the fixture so
  no Anthropic client is constructed, and PH-9's `fake_db` covers Firestore. Nothing
  in `server.py` was refactored for testability, per the item.
