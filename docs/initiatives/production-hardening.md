# Production hardening

The security hole is closed (PR #9) and spend has a ceiling (PR #7). What's
left here is quieter: places the app tells a foster something that isn't
true, or loses something a real person would mind losing. None of it is
visible in a demo. All of it matters the first time a real dog goes home
with a real foster.

## H1 — session state survives a restart (PH-3, PH-8) — settled

Both halves of a foster's agent session now live in Firestore on
`fosters/{uid}/agentSession/current`: the transcript as a `messagesJson` string
(`session_store.py`, PH-3, PR #23) and the approval handoff as a polled
`pendingApproval` map (`approval_store.py`, PH-8, PR #37). A redeploy no longer
drops a conversation, and a decision written by any instance reaches a thread
parked in any other. Full reasoning — including why the transcript is a JSON
string rather than a native array, and the three deliberate behaviour changes
PH-8 made beyond its literal task — is in the [archive](archive/production-hardening-2026-08-29.md).

What that deliberately leaves open is the `--min-instances=1 --max-instances=1`
pin, which is now *removable* and has not been removed. The next section is this
run's answer to what removing it actually costs.

## What lifting the instance pin actually costs (answered 2026-08-29)

PH-8 left the pin removable and said it comes out "once this has been watched
working in production." That is not an exit condition — nothing in this loop can
watch, and a gate no run can evaluate stalls forever while looking like a plan.
So: what is *actually* still per-process, read out of `server.py` on 2026-08-29
rather than reasoned from PH-8's summary. Two things, and only one of them is a
real objection.

**(1) The chat rate limit is per-process, and it is the spend guard.**
`_buckets` / `_take_chat_token` (`src/agent/server.py:182-215`) is an in-memory
token bucket, `CHAT_REQUESTS_PER_MINUTE = 20` per foster. With N instances the
effective ceiling is 20N, because Cloud Run routes a foster's requests to
whichever instance is free. This initiative's opening line is *"spend has a
ceiling"*; raising `--max-instances` to 4 quietly multiplies that ceiling by four
with nothing in the repo saying so. This is the thing to settle **before** the
pin moves, not after. → PH-11.

**(2) The in-memory `Agent` is fine multi-instance — but checking it exposed a
different bug.** `_session()` rebuilds a missing session from
`session_store.load()`, and `save()` is `merge=True`, so a second instance picks
the conversation up correctly. The residual race — two concurrent turns for the
*same* foster on different instances, last write winning and losing one turn —
needs two tabs or two devices, and is acceptable. What is **not** acceptable, and
is a bug today under the pin rather than a consequence of lifting it:
`session_store.save()` trims to `MAX_STORED_MESSAGES = 40`, and **nothing ever
trims `Agent.messages` in memory.** Confirmed by grep — `messages[` appears
exactly once in `src/agent/`, in `session_store.save`. So the 40-message cap only
bites across a restart. On the warm instance `--min-instances=1` deliberately
keeps alive, a foster's transcript grows without bound and the whole of it is
re-sent to the API on every turn, which is the one cost that scales with
conversation length. The cap is a persistence bound masquerading as a spend
bound. → PH-10.

**The concrete exit condition, replacing "watched working in production":**
PH-10 and PH-11 ship; then `--max-instances` goes to **2** (not unbounded) in one
small PR, `--min-instances=1` stays; then a human confirms the two things that
only exist multi-instance — `/health`'s `active_sessions` differing between two
hits, and one dangerous-tool approval issued in one browser and answered such
that the parked turn resumes. That last one is the actual claim PH-8 made and the
only thing that proves it. Written up as PH-13 under "Needs a human" below.

## The notification that doesn't notify — honest, still not capable (PH-1)

`src/agent/builtin/adoption.py:66` returns
`"notified_shelter": arcade_tools.available()` instead of a hardcoded `True`
(PR #19), and the system prompt tells the model to say plainly when nobody was
notified. **Still open, deliberately: nothing actually notifies a shelter.** The
fix made the tool honest, not capable. A real notification path is downstream of
M3 in `real-data-and-shelters.md` — a shelter with an account and an application
list is the thing worth notifying — so it is not queued here. Background in the
[archive](archive/production-hardening-2026-08-29.md).

## Account deletion and export — both shipped

`deleteAccount()` (PH-2, PR #20) and `exportAccountData()` (PH-6, PR #28), both
in `web/src/auth.ts` and surfaced in `AccountSheet.tsx` for signed-in users;
guests have "Start fresh on this device". The export deliberately excludes
`fosters/{uid}/agentSession/current` — the agent's own reasoning, not
foster-given data. Details in the [archive](archive/production-hardening-2026-08-29.md).

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

## Two smaller ones — both resolved

- **Guest→account migration — resolved 2026-08-26 (PH-5, PR #29).** A guest is
  pure `localStorage` with no Firebase Auth session, so there was never anything
  to `linkWithCredential`; `migrateGuestData()` in `web/src/auth.ts` copies the
  local `Foster` and care log into `fosters/{uid}` on first sign-in, only when
  that doc doesn't already exist. The README's "already decided" list keeps the
  corrected framing so it isn't re-derived.
- **`tsconfig.app.json` strictness — resolved 2026-08-26 (PH-4, PR #27).**
  `"strict": true` is now explicit. It was already on: `package.json` pins
  `typescript: ~6.0.2` and TypeScript 6 defaults it true, verified by running the
  repo's own compiler (0 errors both ways). The one-liner is a pin against a
  silent future regression, not a fix.
  *(When re-checking, use `./node_modules/.bin/tsc` — `npx tsc` resolves to an
  unrelated `tsc@2.0.4` that prints a banner and exits 1 without compiling.)*

## Task queue

**Refilled 2026-08-29.** PH-8 and PH-9 both shipped in the same execute run,
which emptied this queue entirely — the first time that has happened here. The
three items below all come out of the section above, which was written by reading
`server.py` and `session_store.py` against `main` rather than by hunting for
something to queue. PH-10 and PH-11 are prerequisites for PH-13; PH-12 is
independent and cheap.

- **PH-10 — shipped 2026-08-30.** See the Ledger. (Original item kept below
  for the reasoning it carries.)
- ~~**PH-10 (2026-08-29) — the transcript cap only bites across a restart.**~~
  `session_store.save()` trims to `MAX_STORED_MESSAGES = 40`; nothing trims
  `Agent.messages` in memory, so on the warm instance `--min-instances=1` keeps
  alive, a long conversation is re-sent to the API in full every turn. Make the
  live list obey the same bound as the stored one.
  - The trim belongs where the turn ends (`server._stream`'s existing `finally`,
    which already calls `session_store.save`), **not** inside `loop.py`'s request
    path — the CLI (`src/agent/cli.py`) shares that code and has no stored
    transcript to be consistent with.
  - **A blind `messages[-40:]` is wrong and will 400 the API.** A trim that cuts
    between an assistant `tool_use` block and its matching `tool_result` sends a
    transcript Anthropic rejects, and it will do so intermittently rather than
    always. Trim to a boundary: walk back from the cut point to the nearest
    message that starts a clean turn (a `user` message carrying no
    `tool_result`) and keep from there. If that scan finds nothing, keep **more**
    than 40 rather than fewer — over-keeping costs money, under-keeping breaks
    the conversation.
  - Fix the comment on `MAX_STORED_MESSAGES` in the same PR: it currently
    describes a persistence bound and will now be both.
  - Verify: add tests to `tests/test_session_store.py` (PH-9's harness — no
    emulator, no network) covering a trim that would otherwise split a
    `tool_use`/`tool_result` pair, a transcript already under the bound being
    left alone, and the boundary-scan-finds-nothing case keeping more rather than
    fewer. `uv run pytest` green. Say in the ledger row whether you exercised a
    real over-length conversation or only the unit cases.

- **PH-11 (2026-08-29) — decide what the rate limit means with more than one
  instance.** `_take_chat_token` (`server.py:182-215`) is per-process, so
  `CHAT_REQUESTS_PER_MINUTE = 20` becomes 20N once the pin lifts. Two honest
  options; pick one, implement it, and **write the choice and the reason into
  this doc**, because the recorded decision is as much the deliverable as the
  code.
  - *(a) Move the bucket to Firestore*, alongside the approval field, in the
    shape `approval_store.py` already established. Correct at any instance count.
    Costs a read+write per chat request, real but small next to the model call in
    the same turn.
  - *(b) Keep it in memory and divide the constant* by the maximum instance
    count, with a comment tying the two numbers together so raising one without
    the other is visibly wrong. Cheaper, and defensible while max-instances is a
    small fixed number — but it over-throttles a foster whose requests all land
    on one instance.
  - Do **not** pick a third option that removes the limit. A recommendation, if
    you want one: (b) is the right size for max-instances=2, but only if the
    comment lives in `deploy-backend.yml` next to the flag as well as in
    `server.py`, since that is where someone will change the number.
  - Do not touch `--min-instances` / `--max-instances` in this PR. That is PH-13
    and it is a human's.
  - Verify: a test in `tests/` that the bucket refuses the 21st request in a
    minute and admits one after refill (drive the clock, don't sleep) — there is
    currently no test of the rate limiter at all. Plus, for (a) only, that two
    independent bucket holders share one Firestore counter.

- **PH-12 (2026-08-29) — pin the foster-isolation invariant with a test.**
  `CLAUDE.md` says outright that `current_foster` must stay a ContextVar set
  inside the streaming generator and *"don't simplify it back to a global"*, and
  that the per-foster `Agent`/session split exists so one foster's questions
  can't surface in another's transcript. Both are correctness properties with a
  privacy consequence, and **neither has a test** — now cheap to add, since PH-9
  built the harness.
  - Two tests, using PH-9's `tests/conftest.py` fake and no network: (1) two
    concurrent `_stream` generators for different foster ids each read back their
    *own* id from `current_foster` while the other is mid-stream — this is the
    one that fails if someone converts it to a module global, which is the entire
    point; (2) `_session("a")` and `_session("b")` return distinct `Agent`
    objects with distinct `messages` lists, and evicting one doesn't disturb the
    other.
  - Stub the model call — this tests the plumbing around it. Do **not** refactor
    `server.py` to make it testable; if a test can only be written by changing
    production code, write down what blocked you and stop, the way PH-9 did.
  - Verify: both tests fail if you temporarily replace the ContextVar with a
    module-level variable, and pass on `main`'s shape. Say in the ledger row that
    you actually ran the negative direction — a test that has never been seen
    failing is DC-1's lesson repeating.

### Needs a human, not a queue item

- **PH-13 (2026-08-29) — lift the instance pin, once PH-10 and PH-11 land.**
  Raise `--max-instances` from 1 to **2** in `deploy-backend.yml` (leave
  `--min-instances=1`), in its own small PR, and rewrite the long comment above
  the flag to say what was confirmed rather than what was expected. Not queued
  for execute: merging it deploys to production immediately
  (`deploy-backend.yml` is path-triggered), and the thing that makes it safe can
  only be confirmed by a person driving two browsers. Confirm both and record
  them here — `/health`'s `active_sessions` differing across two hits (proof
  there really are two instances), and one dangerous-tool approval issued in one
  session and answered such that the parked turn resumes. That second one is
  PH-8's actual claim and has never been observed.
- **PH-7b — the alerting half of PH-7.** Nothing in the agent backend's failure
  path reaches a person. The logging side is already correct — `server.py` calls
  `logging.exception` at the stream failure (`:300`) and the session-persist
  failure (`:332`), so the records exist in Cloud Logging at `ERROR` severity.
  What's missing is one alert that reads them. Deliberately **not** queued:
  creating a log-based alert policy and notification channel is a hard-to-reverse
  change to shared GCP infrastructure that sends real email and carries quota
  implications, and an unattended run declined it on exactly those grounds
  (PR #33). That was the right call, and re-queueing it would produce the same
  refusal. Roughly: in `pawthway-hackathon`, a notification channel for Sharang's
  email, then a log-based alerting policy on the Cloud Run agent service filtered
  to `severity>=ERROR`. **If you do it via `gcloud`, add the invocation to
  [`docs/runbook-gcp.md`](../runbook-gcp.md)** — that file now exists (RS-9 wrote
  the first entry into it), so this needs a section, not a new doc.
  Out of scope even then: uptime checks, a status page, Sentry, instance pins.
- **PH-7c — spot-check the deployed `/health`.** Thirty seconds, still never
  done: `curl https://<the Cloud Run agent URL>/health` and confirm
  `firestore_reachable` is `true` in production. PR #33 verified only the
  *failure* path (no ADC in that environment). Until someone looks, "Firestore is
  reachable from the backend" is an untested assertion inside a health endpoint,
  which is slightly worse than not having the field. PH-13 wants a `/health` hit
  too — doing them together is one errand, not two.

## Ledger

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
- 2026-08-30 — PH-10 — PR #__ — `session_store.trim()` is now the one place the
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
