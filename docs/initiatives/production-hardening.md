# Production hardening

The security hole is closed (PR #9) and spend has a ceiling (PR #7). What's
left here is quieter: places the app tells a foster something that isn't
true, or loses something a real person would mind losing. None of it is
visible in a demo. All of it matters the first time a real dog goes home
with a real foster.

## H1 — transcript is durable (PH-3); approval queue still isn't

`src/agent/server.py` keeps one in-memory `Agent` and one approval
`queue.Queue` per foster uid. `deploy-backend.yml` pins
`--min-instances=1 --max-instances=1`, which was a **correctness** fix (a
second instance could swallow an `/approve` that a `/chat` elsewhere was
blocked on — see the comment above the flag in the workflow) not a cost one.

**Resolved 2026-08-25 (PH-3):** `session_store.py` persists `Agent.messages`
to `fosters/{uid}/agentSession/current` (`messagesJson`, a JSON string field
— `content` blocks are lists of dicts, so this sidesteps any question about
how deep Firestore lets map-nested arrays go) after every completed turn in
`_stream`, and `_session()` loads it back when rebuilding a foster's
session. Trimmed to the last 40 stored messages (~20 turns, a starting
guess) on write. A redeploy or restart no longer drops a foster's
conversation.

**Still only mitigated, not fixed:** the *approval* channel.
`Session.approvals` is a `queue.Queue[bool]` that a request thread is
**blocked on** inside `_build_agent`'s `approve=lambda ...: approvals.get(
timeout=300)` (`server.py:211-224`). A blocked thread is not serializable —
it dies with the process, and a second instance has no way to hand a `bool`
to a thread parked in another container. Durable transcripts fix *deploys
losing history*; they do **not** fix the split-brain approval race that
`--max-instances=1` exists to prevent. **The pin stays** until approvals
themselves move to shared state (a Firestore field the blocked thread
polls, or a real queue) — deliberately out of scope for PH-3, and not
queued yet.

## The notification that doesn't notify — fixed (PH-1, PR #19)

**Resolved 2026-08-24, re-verified 2026-08-25.**
`src/agent/builtin/adoption.py:66` now reads
`"notified_shelter": arcade_tools.available()` — confirmed by grep against
`main`, not taken from the ledger's word.

The original problem, kept for context: the tool flipped `dogs/{id}.status`
and returned a hardcoded `notified_shelter: True`, while Arcade isn't
configured in production (`GET /health` reports `"arcade_available": false`),
so there was no Gmail/Slack path and nobody was notified. With SF SPCA's real
dogs in the roster (PR #6) that was no longer a white lie about demo data.

**Still open, deliberately:** nothing actually notifies a shelter. The fix
made the tool honest, not capable. A real notification path is downstream of
M3 in `real-data-and-shelters.md` (a shelter with an account and an
application list is the thing worth notifying), so it is not queued here.

## Account deletion and export — both shipped

**Deletion resolved 2026-08-24 (PH-2, PR #20):** `deleteAccount()` in
`web/src/auth.ts`, surfaced in `AccountSheet.tsx` behind a confirm step for
signed-in users. Verified present on `main` 2026-08-25.

**Export resolved 2026-08-26 (PH-6):** `exportAccountData()` in
`web/src/auth.ts` builds a JSON blob of `fosters/{uid}`, its `careLog`
subcollection, and `applications` rows (queried by `fosterId`), triggered
via a "Download my data" button in `AccountSheet.tsx` beside the delete
button, signed-in users only. Deliberately excludes
`fosters/{uid}/agentSession/current` — the agent's own reasoning, not
foster-given data, and already no-client-write in rules.

## No error tracking

Cloud Run logs only. Combined with the single-instance pin above: one wedged
instance is the whole backend, and the first signal you'd get is a foster
telling you chat is broken.

**Sharpened 2026-08-28, and there is now a second reason to care.** The
codebase already does the *logging* half competently — `server.py` calls
`logging.exception` at each of the failure points that matter (the stream
failure at `:300`, the session-persist failure at `:332`), so the information
exists in Cloud Logging. What is missing is anything that *reads* it. That's
a cheap gap to close relative to its value, and it just got demonstrated in
the adjacent repo surface: the design-token guard in `ci.yml` printed
`fatal: ... no merge base` on four consecutive runs while reporting success,
and nobody noticed for a day, because nothing reads logs that don't fail
anything (see `design-consistency.md`, DC-3). The same shape of blindness
applies to the backend, with a foster on the other end of it. → PH-7.

## Two smaller ones, deliberately low priority

Both are now queued below (PH-4, PH-5) rather than sitting only in prose —
still ranked under PH-3, but no longer invisible to execute.

- **Guest→account migration — resolved 2026-08-26 (PH-5).** A guest who
  completes onboarding, saves dogs, then applies (which requires signing
  in) used to land in a fresh empty account. `web/src/lib/session.ts` never
  had a Firebase anonymous-auth user to `linkWithCredential` onto — a guest
  is pure `localStorage` (`web/src/lib/localMode.ts`), no Firebase Auth
  session at all — so the original bullet's premise was slightly off too:
  `migrateGuestData()` in `web/src/auth.ts` copies the local `Foster` and
  care-log entries into the new `fosters/{uid}` doc on first
  `signInWithGoogle()`, only when that doc doesn't already exist (a
  returning user's real data always wins).
- **`tsconfig.app.json` has no `"strict"` — but strict is on anyway.**
  **Corrected 2026-08-26.** This bullet used to claim `tsc -b` in CI (PR #8)
  "catches far less than it looks like — `string | null` flows into `string`
  unchallenged," and that flipping the flag would surface errors across the
  codebase. That was written from TypeScript ≤5 intuition and is **false for
  this repo**: `package.json` pins `typescript: ~6.0.2`, and TypeScript 6
  defaults `strict` to `true`. Verified by running the repo's own compiler
  (`web/node_modules/.bin/tsc`, v6.0.3, 74 project files): `--strict` and the
  bare project config both report **0 errors**, and an explicit
  `--strict false` on a `const b: string = a` (where `a: string | null`) is
  the only way to make that assignment stop erroring. The omission is a
  latent risk, not an active hole — a TypeScript downgrade or an inherited
  config that sets `strict: false` would silently switch it off with nothing
  in CI to say so. → PH-4, now a one-line explicitness fix rather than a
  codebase-wide cleanup.
  *(Watch for `npx tsc` when re-checking this: `npx` resolves to an unrelated
  `tsc@2.0.4` package from npm, which prints a banner and exits 1 without
  compiling anything. Use `./node_modules/.bin/tsc`.)*

## Task queue

Reordered 2026-08-29. PH-7 is closed as far as this loop can close it: its
commit-shaped half shipped (PR #33) and its alerting half is a GCP console
action that execute correctly declined to take on its own judgment — that half
now lives under "Needs a human" below rather than sitting in the queue getting
skipped every run. PH-8 was gated on it, which made the entire
production-hardening queue depend on something no automated run can do; that
gate is lifted and replaced with a better one.

- **PH-9 — shipped 2026-08-29.** `tests/` plus a `Test` step in `ci.yml`'s
  `backend` job. See Ledger for what it covers and what it deliberately does not.

- **PH-8 (2026-08-28; re-gated 2026-08-29 on PH-9, not on PH-7's alerting
  half) — move the approval channel to shared state.** The old gate made this
  wait on a GCP console click no unattended run can perform, which is not a
  gate, it's a deadlock. What this change actually needs before it is safe is a
  way to assert its own behaviour, and PH-7's shipped half already supplies the
  production signal it wanted (`/health` now reports `active_sessions` and
  `firestore_reachable`, so "did this instance just restart and drop every
  parked approval thread" is answerable without asking a foster). The last thing holding `--max-instances=1` in place. Read H1 above
  in full before starting; the constraint is stated there precisely and this
  item does not restate it.
  - The shape: `Session.approvals` is a `queue.Queue[bool]` that a request
    thread **blocks on** inside `_build_agent`'s
    `approve=lambda name, args: approvals.get(timeout=300)`
    (`server.py:216-228`, `:240-245`), and `/approve` hands it a bool with
    `_session(foster_id).approvals.put(...)` (`:450`). A parked thread is not
    serializable and a second instance cannot reach it. Replace the in-process
    handoff with one a second instance could satisfy: a field on
    `fosters/{uid}/agentSession/current` (the doc PH-3 already created) that
    the blocked thread polls, with the same 300s ceiling. A Firestore
    real-time listener is the tempting alternative — it is also a second
    concurrency model inside a thread that is already blocking, so prefer the
    boring poll unless you find a concrete reason not to, and record the
    reason if you do.
  - **Do not touch `--min-instances` / `--max-instances` in this PR.** The
    pin comes out only after this has been observed working, and that is a
    separate, deliberately separate, change. `deploy-backend.yml:36-56`
    carries a comment explaining the pin — update it to say the pin is now
    removable and why, don't remove it.
  - Rules: `fosters/{uid}/agentSession/current` is owner-read /
    no-client-write today (PH-3). An approval written by the *server* via the
    Admin SDK keeps that true. If your design needs the client to write this
    field, stop — that's a different design, and widening that rule is not in
    scope.
  - Verify: two approvals in one session both resolve; an approval that
    nobody answers still times out at 300s rather than hanging; restarting
    the backend mid-approval leaves the foster with a recoverable state
    rather than a dead stream. State plainly in the ledger row which of these
    you actually exercised and which you only reasoned about.

### Needs a human, not a queue item

- **PH-7b — the alerting half of PH-7.** Nothing in the agent backend's failure
  path reaches a person. The logging side is already correct — `server.py`
  calls `logging.exception` at the stream failure (`:300`) and the
  session-persist failure (`:332`), so the records exist in Cloud Logging at
  `ERROR` severity. What's missing is one alert that reads them.
  Deliberately **not** queued: creating a log-based alert policy and a
  notification channel is a hard-to-reverse change to shared GCP
  infrastructure that sends real email and carries quota implications, and an
  unattended run declined it on exactly those grounds (PR #33). That was the
  right call and re-queueing it would just produce the same refusal.
  What Sharang needs to do, roughly: in the `pawthway-hackathon` project,
  create a notification channel for his own email, then a log-based alerting
  policy on the Cloud Run agent service filtered to `severity>=ERROR`. Console
  or `gcloud logging` / `gcloud alpha monitoring` both work. **If you do it via
  `gcloud`, paste the invocation into a short `docs/` runbook note** so it is
  reproducible rather than living only in one person's console — that was the
  original task's requirement and it still stands.
  Explicitly out of scope even when this happens: uptime checks, a status page,
  Sentry or any paid tier, and touching the instance pins.
- **PH-7c — spot-check the deployed `/health`.** Thirty seconds, never done:
  `curl https://<the Cloud Run agent URL>/health` and confirm
  `firestore_reachable` is `true` in production. PR #33 verified the *failure*
  path locally (no ADC in that environment, so it returned `false` without
  raising, which was the thing being tested) but has never seen the success
  path against real credentials. Until someone looks, "Firestore is reachable
  from the backend" is an untested assertion in a health endpoint, which is a
  slightly worse position than not having the field.

## Ledger

- 2026-08-24 — PH-1 — PR #19 — `send_adoption_profile_to_shelter` now
  returns `notified_shelter: arcade_tools.available()` instead of a
  hardcoded `True`; `PAWTHWAY_SYSTEM` tells the model to say plainly when
  nobody was notified. Did the smaller return-value + prompt fix, not a
  new notification path (that stays open if Arcade gets configured later).
- 2026-08-24 — PH-2 — PR #20 — Client-side account deletion: `deleteAccount()`
  in `web/src/auth.ts` deletes the `careLog` subcollection docs, then
  `fosters/{uid}`, then the Firebase Auth user (re-prompting Google sign-in
  once on `auth/requires-recent-login`). Wired into `AccountSheet.tsx`
  behind a "Delete account" button + confirm step, signed-in users only —
  guests already have "Start fresh on this device". No rules change needed;
  `firestore.rules` already lets the owner write/delete their own doc and
  subcollection. Went client-side per the task's own fallback (no admin
  panel exists to host a `DELETE /account` endpoint).
- 2026-08-25 — PH-3 — PR #23 — `src/agent/session_store.py` persists
  `Agent.messages` (loop.py now dumps assistant content blocks to plain
  dicts at append time, not raw SDK objects, so the list stays JSON-safe
  throughout) as a `messagesJson` string on
  `fosters/{uid}/agentSession/current`, trimmed to the last 40 messages on
  write. `_session()` loads it on rebuild; `_stream` saves it in a `finally`
  after each turn; `/reset` deletes the doc. Added an owner-read/
  no-client-write rule for the subcollection in `firestore.rules`. Did not
  touch `--max-instances=1` or the approval queue — out of scope per the
  correction above.
- 2026-08-26 — PH-4 — PR #27 — Added `"strict": true` explicitly to
  `web/tsconfig.app.json`'s `compilerOptions`, per the doc's own corrected
  premise: TypeScript 6 (`~6.0.2` in `package.json`) already defaults
  `strict` on, so this was a one-line pin against a silent future
  regression, not a codebase-wide cleanup. Verified `0 errors` from
  `./node_modules/.bin/tsc -p tsconfig.app.json --noEmit` both before and
  after the change, `npm run build`, `npm run lint` (no new warnings beyond
  the pre-existing ones), and `npm run test` (28/28) all green.
- 2026-08-26 — PH-6 — PR #28 — `exportAccountData()` in `web/src/auth.ts`
  builds a JSON blob of `fosters/{uid}`, its `careLog` subcollection, and
  `applications` rows (queried `where("fosterId", "==", uid)` — no
  composite index needed, single equality filter). Delivered via a
  `Blob` + object-URL `<a download>` click, no new dependency. Wired into
  `AccountSheet.tsx` as a "Download my data" button beside "Delete
  account", signed-in users only. Excludes
  `fosters/{uid}/agentSession/current` per the task's own instruction.
- 2026-08-26 — PH-5 — PR #29 — `migrateGuestData()` in `web/src/auth.ts`,
  called from `signInWithGoogle()` when `wasGuest()` was true before the
  guest flag is cleared. Copies the localStorage `Foster` and care-log
  entries into the new `fosters/{uid}` doc, then `clearGuestData()`.
  **Shipped smaller than queued, and for a real reason:** the task said to
  "use `linkWithCredential`/`linkWithPopup` on the existing anonymous local
  session where possible" — there is no such session. A Pawthway guest has
  no Firebase Auth user at all (anonymous auth is never called; see
  `localMode.ts` and the README's "browsing doesn't require an account"
  decision), so credential linking has nothing to link and the task's own
  fallback — "where the guest state is purely client-side, copy it into the
  new `fosters/{uid}` doc" — is the whole job. Guarded two ways: skips if
  `fosters/{uid}` already exists (returning user's real data wins over a
  stale local guest doc on a shared device) and skips if the local foster
  still equals `BLANK_FOSTER` (nothing worth migrating). Care-log entries
  are re-written sequentially with a fresh `serverTimestamp()` rather than
  the local `created_at`, preserving order. **Not verified live** — needs a
  real Google sign-in against the deployed app; build/lint/test green only.
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
- 2026-08-29 — PH-9 — PR #__ — Backend test harness: `pytest>=8.0` as a
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
