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
- 2026-08-25 — PH-3 — PR #__ — `src/agent/session_store.py` persists
  `Agent.messages` (loop.py now dumps assistant content blocks to plain
  dicts at append time, not raw SDK objects, so the list stays JSON-safe
  throughout) as a `messagesJson` string on
  `fosters/{uid}/agentSession/current`, trimmed to the last 40 messages on
  write. `_session()` loads it on rebuild; `_stream` saves it in a `finally`
  after each turn; `/reset` deletes the doc. Added an owner-read/
  no-client-write rule for the subcollection in `firestore.rules`. Did not
  touch `--max-instances=1` or the approval queue — out of scope per the
  correction above.
