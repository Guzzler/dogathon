# Production hardening

The security hole is closed (PR #9) and spend has a ceiling (PR #7). What's
left here is quieter: places the app tells a foster something that isn't
true, or loses something a real person would mind losing. None of it is
visible in a demo. All of it matters the first time a real dog goes home
with a real foster.

## H1 — Agent sessions are mitigated, not fixed

`src/agent/server.py` keeps one in-memory `Agent` and one approval
`queue.Queue` per foster uid. `deploy-backend.yml` pins
`--min-instances=1 --max-instances=1`, which was a **correctness** fix (a
second instance could swallow an `/approve` that a `/chat` elsewhere was
blocked on — see the comment above the flag in the workflow) not a cost one.
It removes the acute failure. It does not mean sessions survive:

- A redeploy (every merge to `main` that touches `src/**` triggers one)
  drops every in-flight conversation.
- The backend is now a documented single point of failure.

**Real fix:** move `Session.agent`'s message history into Firestore, keyed by
uid. That also gives fosters conversation history that survives a deploy,
which they don't have today.

**Correction (2026-08-25):** an earlier version of this section said "once
state is durable, the instance pin can be lifted." That is wrong, and the
distinction matters enough to design around. Persisting the transcript and
sharing the *approval* channel are two different problems:
`Session.approvals` is a `queue.Queue[bool]` that a request thread is
**blocked on** inside `_build_agent`'s `approve=lambda ...: approvals.get(
timeout=300)` (`server.py:211-224`). A blocked thread is not serializable —
it dies with the process, and a second instance has no way to hand a `bool`
to a thread parked in another container. So durable transcripts fix
*deploys losing history*; they do **not** fix the split-brain approval race
that `--max-instances=1` exists to prevent. **The pin stays** until
approvals themselves move to shared state (a Firestore field the blocked
thread polls, or a real queue) — which is deliberately not part of PH-3.

### PH-3's shape, decided 2026-08-25

Verified against `src/agent/loop.py:106-182` and `src/agent/server.py:115-243`:

- **What gets stored.** `Agent.messages` is a `list[dict[str, Any]]` of
  Anthropic message blocks. Firestore **cannot** hold this natively —
  `content` is a list of block dicts, and Firestore forbids nested arrays.
  Store it as a single JSON **string** field (`messagesJson`), not an array.
  This is the trap to design around, not an implementation detail to
  discover mid-PR.
- **Where.** *Not* a field on `fosters/{uid}` itself, which the web client
  reads in full on every load — a transcript growing on that document would
  inflate every client read of unrelated fields. Two placements satisfy
  that: a subcollection doc (`fosters/{uid}/agentSession/current`) or a
  separate top-level `agentSessions/{fosterId}`. **An implementation
  in flight as of 2026-08-25 chose the top-level collection**, on the
  reasoning that this is agent-internal state (tool-call payloads, thinking
  blocks) rather than part of the foster's journey record that other tools
  and the web UI read. That reasoning is sound and this doc defers to
  whichever ships; the load-bearing constraint is only "off the foster
  document." Whichever wins, the rules entry below must match it.
- **When.** Persist once per completed turn, at the end of `_stream`
  (`server.py:295-318`) — not per SSE event. A turn that dies mid-approval
  is simply not persisted; on reload the foster resumes from the last
  completed turn, which is the honest behavior given the point above.
- **Size.** Firestore's 1MB document limit is a real ceiling for a long
  tool-heavy transcript. Trim to the last N turns on write (N=20 is a
  starting guess, not a measured one) and drop the oldest first, mirroring
  `_sessions`' existing `MAX_SESSIONS` eviction.
- **Rules.** The agent writes through the Admin SDK, which bypasses
  `firestore.rules` entirely, so no rule is *needed* for the write path —
  but add an explicit owner-read / no-client-write `match` anyway, so the
  default-deny at the bottom of the file isn't the only thing standing
  between a transcript and a client.
- **`/reset`** (`server.py:439-444`) must delete the stored doc too, or it
  will silently un-reset on the next cold start.

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

## Account deletion — shipped; export — still absent

**Deletion resolved 2026-08-24 (PH-2, PR #20):** `deleteAccount()` in
`web/src/auth.ts`, surfaced in `AccountSheet.tsx` behind a confirm step for
signed-in users. Verified present on `main` 2026-08-25.

**Export is not built.** The app stores real names, addresses, and pickup
locations behind Google sign-in, and a data-subject request can ask for a
copy as well as a deletion. Not queued yet because deletion is the half with
teeth and it now exists; a JSON dump of `fosters/{uid}` plus its
`careLog` and the foster's `applications` rows is the obvious shape when it
is queued.

## No error tracking

Cloud Run logs only. Combined with the single-instance pin above: one wedged
instance is the whole backend, and the first signal you'd get is a foster
telling you chat is broken.

## Two smaller ones, deliberately low priority

Both are now queued below (PH-4, PH-5) rather than sitting only in prose —
still ranked under PH-3, but no longer invisible to execute.

- **Guest→account migration.** A guest who completes onboarding, saves
  dogs, then applies (which requires signing in) lands in a fresh empty
  account — `web/src/lib/session.ts` has no `linkWithCredential` path.
  Deprioritized by Sharang (2026-08-23) rather than silently dropped; still
  worth a small fix. → PH-5.
- **`tsconfig.app.json` has no `"strict"`.** `tsc -b` in CI (PR #8) catches
  far less than it looks like — `string | null` flows into `string`
  unchallenged. Flipping it will surface real errors across the codebase, so
  it's its own PR, not a drive-by. → PH-4.

## Task queue

- **PH-3 (2026-08-25 — gate cleared, now open).** Firestore-backed agent
  sessions, built to the shape decided in "PH-3's shape" above. The gate
  was M2 of `real-data-and-shelters.md`, which landed in PR #21; the gate's
  stated *rationale* (shelter-side auth rebasing the same `server.py`) also
  turns out not to bite — PR #21 changed only `firestore.rules` and
  `web/src/**`, and RS-2 as queued is likewise a web-side route plus rules,
  with nothing under `src/agent/`. Scope: add load-on-miss and
  save-per-turn around `_session()`/`_stream()` in `src/agent/server.py`,
  a `messagesJson` string field on whichever off-foster document the
  "Where" bullet settles on, via the existing
  `src/agent/firestore_client.py` Admin SDK handle, a matching
  owner-read/no-client-write rule in `firestore.rules`, and deletion of that
  doc from `/reset`. **Status: an implementation was in flight in the
  working tree when this was queued (2026-08-25) — check
  `gh pr list --state open` and `git status` before starting, this may
  already be done.**
  **Do not touch `--max-instances=1` in `deploy-backend.yml`** — see the
  correction above; the pin is about approvals, not transcripts.
  Verify: start a chat, say something memorable, `gcloud run services
  update pawthway-agent --region ... --update-labels redeploy=$(date +%s)`
  (or merge any `src/**` change) to force a new revision, then send a
  follow-up that depends on the earlier message and confirm the agent still
  has it; confirm `fosters/{uid}/agentSession/current` exists in the
  Firestore console and that `POST /reset` removes it.
- **PH-4 (2026-08-25).** Turn on `"strict": true` in
  `web/tsconfig.app.json`. This is the pre-existing "its own PR, not a
  drive-by" item above, now queued explicitly so it stops living only in
  prose. Expect real errors — `string | null` into `string` is the shape
  called out. Fix them in the same PR rather than sprinkling `!` or `any`;
  if the count turns out to be large (say >40), flip the individual flags
  that pay off most first (`strictNullChecks` alone) and say so in the
  ledger row rather than half-finishing. Verify: `npm run build` in `web/`
  passes, and CI's `frontend` job is green.
- **PH-5 (2026-08-25, low priority — do this last of the three).**
  Guest→account migration. A guest who onboards, saves dogs, then applies
  lands in a fresh empty account because `web/src/lib/session.ts` has no
  `linkWithCredential` path. Deprioritized by Sharang on 2026-08-23 but
  real: use `linkWithCredential`/`linkWithPopup` on the existing anonymous
  local session where possible, and where the guest state is purely
  client-side, copy it into the new `fosters/{uid}` doc on first sign-in.
  Verify: as a guest, complete onboarding and save two dogs, then sign in
  with Google — the onboarding answers and both saved dogs are still there.

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
