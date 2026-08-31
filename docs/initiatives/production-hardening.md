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

## What lifting the instance pin actually costs — answered 2026-08-29, discharged 2026-08-30

PH-8 left the `--min-instances=1 --max-instances=1` pin removable and gated its
removal on "once this has been watched working in production", which is not an
exit condition any run of this loop can evaluate. Replacing it meant reading
`server.py` for what is *actually* still per-process. Two things were, and both
have now shipped: the in-memory rate limiter, which silently became a 20N spend
ceiling at N instances (PH-11, and the decision is the next section), and — found
while checking the other one — a live transcript that nothing ever trimmed, so
the 40-message cap only bit across a restart and the warm instance the pin keeps
alive re-sent an unbounded conversation every turn (PH-10). The residual race,
two concurrent turns for the same foster on different instances losing one turn
to a last-write-wins, needs two devices and is accepted.

**The concrete exit condition that replaced it:** PH-10 and PH-11 ship — they
have — then `--max-instances` goes to **2** (not unbounded, `--min-instances=1`
unchanged) in one small PR, and a human confirms the two things that only exist
multi-instance: `/health`'s `active_sessions` differing across two hits, and one
approval issued in one browser answered such that the parked turn resumes. That
second one is PH-8's actual claim and has never been observed. It is PH-13 under
"Needs a human" below, and it is the only thing now standing between here and
lifting the pin.

## What the rate limit means with more than one instance (decided 2026-08-30, PH-11)

**Option (b): keep the bucket in memory and divide the budget by the maximum
instance count.** `server.py` now carries three constants instead of one —
`CHAT_REQUESTS_PER_MINUTE_BUDGET = 20` (what a foster is allowed, in total,
across the whole service), `MAX_CLOUD_RUN_INSTANCES = 1` (which must equal
`--max-instances` in `deploy-backend.yml`), and `CHAT_REQUESTS_PER_MINUTE`
derived from the two. Raising the flag without raising the constant is still
possible, but it is now visibly wrong in a diff and called out by a `!!` comment
block in both files — including next to the flag itself, which is where someone
will actually be editing when they get it wrong.

**Why not (a), the Firestore-backed bucket.** It is the correct answer at any
instance count and it was genuinely close. It lost on scope, not on cost: the
read+write per chat request is small next to the model call in the same turn, but
it makes the spend brake depend on Firestore being up, and `_await_approval`
already establishes that a Firestore failure has to fail *closed*. A rate limiter
that fails closed on a Firestore blip turns a database hiccup into "you can't talk
to the assistant"; one that fails open stops being a spend brake at the exact
moment something is going wrong. Neither is a good answer, and picking between
them is a bigger question than max-instances=2 deserves. Revisit (a) if the
instance count ever stops being a small fixed number — that is the condition, and
it is written down here so it doesn't have to be re-derived.

**What (b) costs, stated plainly:** a foster whose requests all land on one
instance is throttled at the divided number, not the budget. At
`--max-instances=2` that is 10/minute rather than 20 for an unlucky foster.
Over-throttling one person is recoverable; multiplying spend by the instance count
is the failure that has no floor.

**Today the division is by 1, so nothing changed numerically.** That is correct
and not a hedge: `--max-instances` is still 1 on `main`, and PH-13 (a human's) is
what raises both numbers together.

## The notification that doesn't notify — honest, still not capable (PH-1)

`src/agent/builtin/adoption.py:66` returns
`"notified_shelter": arcade_tools.available()` instead of a hardcoded `True`
(PR #19), and the system prompt tells the model to say plainly when nobody was
notified. **Still open, deliberately: nothing actually notifies a shelter.** The
fix made the tool honest, not capable. A real notification path is downstream of
M3 in `real-data-and-shelters.md` — a shelter with an account and an application
list is the thing worth notifying — so it is not queued here. Background in the
[archive](archive/production-hardening-2026-08-29.md).

## Account deletion and export — shipped, and deletion is incomplete

`deleteAccount()` (PH-2, PR #20) and `exportAccountData()` (PH-6, PR #28), both
in `web/src/auth.ts` and surfaced in `AccountSheet.tsx` for signed-in users;
guests have "Start fresh on this device". Details in the
[archive](archive/production-hardening-2026-08-29.md).

### What deletion misses, and why nobody noticed (found 2026-08-30)

Read against `main` this run rather than taken from the ledger row.
`deleteAccount()` (`web/src/auth.ts:90-108`) deletes the `careLog` docs, then
`fosters/{uid}`, then the Auth user. Two things it gave the app are still there
afterwards, and in both cases the reason is structural rather than an oversight
someone can just patch in the same function.

**(1) The agent transcript survives, and becomes unreachable.** Deleting a
Firestore document does not delete its subcollections, so
`fosters/{uid}/agentSession/current` — a `messagesJson` dump of the whole
conversation — outlives the account. It is not the agent's private scratchpad:
it contains, verbatim, everything the foster typed, which on the Care Plan
surface is their dog's medical detail and on the Match surface is pickup
logistics. And once the Auth user is gone it can never be reached again from
the client: the read rule is `request.auth.uid == uid`, and that uid will not
exist a second time. It is a permanent orphan holding a deleted person's words.

The export's docstring says agentSession is excluded because it is *"the agent's
own reasoning, not data the foster gave us."* That is a defensible line for
**export** and the wrong line for **deletion**, and the distinction is worth
stating because the same sentence reads as settling both: what someone is
entitled to receive a copy of and what has to be destroyed on request are
different questions, and the second one is wider.

The fix is small and already exists: `agentSession/{doc}` is
`allow write: if false`, so only the Admin SDK can clear it, and `POST /reset`
(`src/agent/server.py:525`) does exactly that — `session_store.clear()` deletes
the whole document, `pendingApproval` included. It is authenticated by the
foster's own ID token and already wired into the frontend as `resetChat()`.
So this is a call-ordering fix, not new machinery. → PH-14.

**(2) The `applications` rows survive, carrying the deleted person's name.**
`exportAccountData()` queries them (`fosterId == uid`); `deleteAccount()` never
touches them, and each row carries `fosterName`, denormalised onto the
application precisely so a shelter can read it without a lookup. There is also
no way to remove them: `match /applications/{applicationId}` has `read`,
`create` and `update` rules and **no `delete` rule at all**, so a client delete
is denied by the default-deny at the bottom of the file.

## What happens to an application when its foster deletes their account (decided 2026-08-30)

**Redact, don't delete.** The row stays; `fosterName` becomes
`"(deleted account)"` and `status` becomes `withdrawn`. → PH-15.

The absent `delete` rule turns out to be right, so the fix is not to add one.
An application is not the foster's private data — it is a record of a
relationship with a shelter, the one document in the schema with two legitimate
owners. Hard-deleting it makes a row vanish out from under a staff member who
may be mid-review, which is the same failure RS-6 already decided against for
retiring a dog ("a status change, **not** a delete — a dog someone is
mid-application on must not vanish out from under them"). The shelter keeps the
fact that an application existed and was withdrawn; it loses the name, which is
the part that belongs to a person who asked to be forgotten.

**The redaction is possible today only because the update rule is loose**, and
that is not a happy accident to build on quietly. `firestore.rules:49-51`'s
foster branch permits an update whenever the *resulting* status is `withdrawn`
and constrains nothing else — so a single write can set the status and rewrite
`fosterName` in the same breath. It can also rewrite `checklist`, `createdAt`
or `shelterId`, and rewriting `shelterId` drops a withdrawn application into
another shelter's inbox, since RS-5's query filters on exactly that field. So
the same read produces a hardening item and the mechanism the redaction rides
on, which is why PH-16 pins the other fields and deliberately leaves
`fosterName` free. Tightening it without that carve-out would close the hole
and break deletion in the same PR.

**Not in scope, and stated so it doesn't get re-derived:** a shelter-side view
of a withdrawn, redacted application is RS-5's problem, not this one's. It
already has to render `withdrawn` as a status; `"(deleted account)"` is just a
name it displays.

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

- **Guest→account migration — 2026-08-26 (PH-5, PR #29).** A guest is pure
  `localStorage` with no Firebase Auth session, so there was never anything to
  `linkWithCredential`; `migrateGuestData()` copies the local `Foster` and care log
  into `fosters/{uid}` on first sign-in, only when that doc doesn't already exist.
  The README's "already decided" list carries the corrected framing.
- **`tsconfig.app.json` strictness — 2026-08-26 (PH-4, PR #27).** `"strict": true`
  made explicit. It was already on (TypeScript 6 defaults it), so this is a pin
  against a silent future regression, not a fix. *(When re-checking, use
  `./node_modules/.bin/tsc` — `npx tsc` resolves to an unrelated `tsc@2.0.4` that
  prints a banner and exits 1 without compiling.)*

## Task queue

**Refilled 2026-08-30.** PH-10, PH-11 and PH-12 all shipped in one execute run
(PRs #43, #44, #45), emptying this queue for the second time. The three items
below come out of the section directly above, which was written by reading
`web/src/auth.ts`, `firestore.rules` and `server.py` against `main` — not by
looking for something to queue. They are one finding split three ways, and the
sequence matters: PH-16 tightens a rule that PH-15 needs to stay loose in one
specific respect, so do not reorder them.

- **PH-14 — shipped 2026-08-30.** `deleteAccount()` clears the agent transcript
  through `POST /reset` before it touches anything else, and refuses to delete the
  rest if it can't. See the Ledger, including which half was only unit-tested.

- **PH-15 (2026-08-30) — redact the foster's name off their applications on
  delete.** Per the decision recorded above: the shelter's copy of an
  application survives, the deleted person's name does not.
  - In `deleteAccount()`, before deleting the Auth user, query
    `applications where fosterId == uid` — the same query
    `exportAccountData()` already runs at `web/src/auth.ts:125` — and for each
    row write `fosterName: "(deleted account)"` and `status: "withdrawn"`.
  - **`status: "withdrawn"` is not optional and not a nicety**: it is what makes
    the write pass `firestore.rules:49-51`'s foster branch, which allows an
    update only when the resulting status is `withdrawn`. A redaction that
    leaves the status alone is `permission-denied`. It is also the honest
    status — nobody is going to review an application from an account that no
    longer exists.
  - Leave `fosterId` in place. It is a uid that now resolves to nothing, and it
    is what makes the row's own history legible; scrubbing it would leave the
    shelter with a record whose provenance can't be established. If a later
    decision disagrees, that is a decision to write into this doc, not a
    judgment call to make inside the deletion path.
  - Do **not** add `allow delete` to `applications` to make this simpler. The
    reasoning is in the section above; hard-deleting a row a shelter may be
    mid-review on is the failure this shape exists to avoid.
  - Verify: with the rules as they stand, a client write that sets `fosterName`
    and `status: "withdrawn"` on one's own application succeeds, and the same
    write without the status change is denied. Run it for real against the
    deployed project as a test account rather than reasoning about it — RS-5's
    section in `real-data-and-shelters.md` is a live example of a rules
    question that could only be settled by running it. Record the answer in
    this doc.

- **PH-16 (2026-08-30, sequenced after PH-15) — the foster branch of
  `applications`'s update rule pins nothing.** `firestore.rules:49-51` allows a
  foster to update their own application whenever the *result* has
  `status == "withdrawn"`, and constrains no other field. So one write can set
  the status and simultaneously rewrite `checklist` (undoing a shelter's ticks),
  `createdAt`, or `shelterId` — the last of which moves the document into a
  different shelter's inbox, since RS-5's query filters on exactly that field.
  Low severity, entirely real, and cheap to close.
  - Pin `fosterId`, `shelterId`, `dogId`, `createdAt` and `checklist` to their
    existing values on the foster branch
    (`request.resource.data.X == resource.data.X`).
  - **Leave `fosterName` free to change.** That is deliberate and it is PH-15's
    redaction path — pinning it would make the previous item impossible. Say so
    in a comment in the rules file, or the next person to tighten this will
    close it and break deletion without knowing.
  - The staff branch is out of scope: staff moving an application forward is
    supposed to write the checklist.
  - Verify: as a test-account foster, a withdraw-plus-name-redaction write still
    succeeds (PH-15's path — this is the regression that matters), and a
    withdraw write that also changes `shelterId` is now denied. Both against the
    deployed project. Do not widen anything else while you are in this file.

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
- 2026-08-28 — PH-7 (commit-shaped half only) — PR #33 — `GET /health` also
  reports `firestore_reachable` via a cheapest-possible round trip that returns
  `False` rather than raising. Did **not** do the alerting half — creating a live
  GCP alert policy is a hard-to-reverse infrastructure change an unattended run
  declined on purpose; that half is PH-7b under "Needs a human". Verified against
  the failure path only. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-29 — PH-9 — PR #36 — The backend test harness: `pytest` as a dev
  dependency group, `testpaths = ["tests"]`, a `Test` step appended to `ci.yml`'s
  `backend` job, and 12 tests over `session_store` and `/health` that need no ADC,
  no API key and no network — plus a ~60-line in-memory Firestore fake in
  `conftest.py`. No emulator and no refactor for testability. Verified the new step
  can turn the job red by pushing a deliberately broken assertion and reading it
  back off a real Actions run. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-29 — PH-8 — PR #37 — The approval handoff moved from an in-process
  `queue.Queue[bool]` to a polled `pendingApproval` field on
  `fosters/{uid}/agentSession/current` (`approval_store.py`), so a decision written
  by any instance reaches a turn parked in any other. Three deliberate changes
  beyond the literal task, each of which is a fail-closed choice: a timeout now
  declines rather than letting `queue.Empty` escape and strand a `tool_use` with no
  `tool_result`; `session_store.save()` became `merge=True` so it can't delete an
  approval a turn is parked on; and a Firestore failure while recording the request
  declines, because an unaskable question is not a yes. 8 tests, clock injected
  rather than slept. The two-instance case is reasoned about, not exercised — it
  can't be, under the pin. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-10 — PR #43 — `session_store.trim()` is the one place the
  40-message bound is applied, and `_stream`'s `finally` now applies it to the
  **live** `agent.messages`, not just the stored copy — before this the cap was a
  persistence bound wearing a spend bound's clothes, and the warm instance re-sent a
  whole growing transcript every turn. The trim walks backwards to a clean turn
  boundary and keeps everything if there isn't one, because under-keeping 400s the
  API. Verified on unit cases only (4 new tests, negative direction run). Full row in
  the [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-11 — PR #44 — Option (b): `CHAT_REQUESTS_PER_MINUTE` is derived
  from a per-foster budget divided by `MAX_CLOUD_RUN_INSTANCES`, with matching `!!`
  comments in `server.py` and next to `--max-instances` in `deploy-backend.yml`. The
  recorded decision is the section "What the rate limit means with more than one
  instance" above and was as much the deliverable as the code. No numeric change
  today — the division is by 1. 6 tests, the first the rate limiter has ever had,
  driving `time.monotonic` by hand. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
- 2026-08-30 — PH-12 — PR #45 — `tests/test_foster_isolation.py` pins the two
  invariants `CLAUDE.md` asserts in prose and nothing enforced: `current_foster` as a
  per-context value, and one `Agent`/session per foster. Driven in two real threads
  with a `threading.Barrier` — deliberately, since a plain generator shares its
  caller's context and interleaving two in one thread would have passed against a
  global and proved nothing. Ran both negative directions: a module-level variable
  fails test (1) and only test (1); a shared `Agent` fails (3) and (4). No production
  code changed. Full row in the
  [ledger archive](archive/production-hardening-ledger-2026-08-30.md).
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
