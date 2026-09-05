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
notified. The fix made the tool honest, not capable. Background in the
[archive](archive/production-hardening-2026-08-29.md).

**2026-09-04 — the gate this was parked behind is open, and the work has moved.** This
section has said since 2026-08-24 that a real notification path is downstream of M3 —
"a shelter with an account and an application list is the thing worth notifying." M3's
three surfaces have all shipped (RS-2, RS-5, RS-6) and RS-5b proved on 2026-09-04 that a
real staff account reads the inbox and writes back to it. M3 finished while nobody
re-read this paragraph.

Reading `adoption.py` against the shipped dashboard this run turned up the concrete gap:
the tool writes `status: "ready_for_adoption"` **and** `adoption_profile` onto the dog,
and `grep -rn adoption_profile web/` finds **no reader in the frontend at all** — the
paragraph the app's most expensive turn writes reaches no human but the foster who
watched it stream. The answer is that the notification is the shelter's own roster, not
email: `real-data-and-shelters.md`'s **"notify the shelter" means the dashboard** section
settles it, and **RS-12 `[large]`** builds it, including making `notified_shelter` true
because the write landed somewhere a shelter demonstrably reads.

**PH-1 stays open here and is discharged by RS-12, not by anything queued in this doc.**
That is deliberate: the fix is a shelter surface, it belongs in the doc that owns the
shelter side, and duplicating it here would refill the queue the 2026-08-31 re-rank
exists to keep empty.

## Account deletion and export — shipped, and deletion now reaches everything

`deleteAccount()` (PH-2, PR #20) and `exportAccountData()` (PH-6, PR #28), both
in `web/src/auth.ts` and surfaced in `AccountSheet.tsx` for signed-in users;
guests have "Start fresh on this device". Details in the
[archive](archive/production-hardening-2026-08-29.md).

### What deletion left behind, and what an application does about it — archived 2026-08-30

Reading `deleteAccount()`, `firestore.rules` and `server.py` against `main` on
2026-08-30 turned up two things a deleted account left behind, and both were
structural rather than an oversight to patch in place:

- **The agent transcript** (`fosters/{uid}/agentSession/current`) survived, because
  deleting a document doesn't delete its subcollections — a verbatim dump of
  everything the foster typed, unreachable forever once the uid stopped existing.
  Shipped as PH-14: `POST /reset` clears it through the Admin SDK, and the call goes
  first, while an ID token can still be minted.
- **The `applications` rows** survived carrying `fosterName`, with no `delete` rule to
  remove them. The decision was **redact, don't delete** — the absent delete rule is
  right, because an application is a two-owner record and must not vanish out from
  under a staff member mid-review. Shipped as PH-15 (`"(deleted account)"` +
  `status: "withdrawn"`) and PH-16 (pin the other fields, leave `fosterName` free).

The full reasoning — including why export and deletion are different questions, and
why `applications`'s update rule must stay loose about `fosterName` specifically — is
in the [archive](archive/production-hardening-deletion-2026-08-30.md). Read it before
tightening that rule.

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

- **PH-15 — shipped 2026-08-30.** `deleteAccount()` redacts `fosterName` to
  `"(deleted account)"` and sets `status: "withdrawn"` on every application the
  deleted foster opened, before the Auth user goes. **The live rules check the item
  asked for could not be run and is now PH-15b under "Needs a human"** — read that
  before treating this as verified end to end.

- **PH-16 — shipped 2026-08-30.** The foster branch of `applications`'s update
  rule now pins `fosterId`, `shelterId`, `dogId`, `createdAt` and `checklist`;
  `fosterName` stays free, with a `!!` comment saying why. Its allow/deny check
  needs a signed-in foster and is folded into PH-15b below.

**This queue is empty again as of 2026-08-30** — PH-14, PH-15 and PH-16 all shipped
in one execute run (PRs #47, #48, #49). Two of the three left something for a person
rather than claiming a verification they couldn't run: PH-15b under "Needs a human"
is the single errand that discharges both.

**Still empty on 2026-09-01, and deliberately so.** This doc is now third of three, the
two above it hold four open items including the repo's only `[large]` one (RS-6), and
this is the doc whose refills produced the treadmill the 2026-08-31 re-rank exists to
stop. Nothing here is broken for anyone: the notification gap (PH-1) is honest and
gated on M3, and everything else outstanding is a verification errand parked below.
Refilling this queue would take the next execute run away from the shelter surface
again, which is the one mistake this loop has already made twice. Take from here when
`real-data-and-shelters.md` and `design-consistency.md` have nothing open.

### Needs a human — PARKED, not pending

**Read this before adding to the list below (2026-08-31).** These accumulate faster
than anyone clears them: PH-15 and PH-16 generated PH-15b on the very run that
shipped them. Per the README's "nobody uses this app yet" section, they are
**parked** — there are no users for whom the unverified behaviour is broken, and
several will answer themselves once RS-5 builds a surface that exercises the same
rules. They get cleared in one sitting when there is a real shelter and real data.
Do not queue them, and do not read the length of this list as debt.

**PH-7c — DONE 2026-08-31.** The one that was cheap enough to just do, because it
needed no sign-in: `curl https://pawthway-agent-674869365762.us-central1.run.app/health`
returns `{"anthropic_key_set":true,"arcade_available":false,"firestore_reachable":true,
"tool_count":14,"active_sessions":0}`. **`firestore_reachable` is `true` in
production** — the assertion PR #33 left untested inside its own health endpoint is
now a result. `active_sessions: 0` is consistent with the single pinned instance
having no live conversations.


- **PH-15b (2026-08-30) — run PH-15's redaction write against the deployed
  project.** PH-15 shipped; its verification did not. The item asked for the write
  to be run for real as a test-account foster, and an unattended run has no way to
  do it: the frontend's only sign-in is a Google popup, the Firestore emulator needs
  a JRE that isn't installed on this machine, and the two ways to get an ID token
  without a popup — creating a test account, or minting a custom token off the
  service-account key — are both off-limits to this loop. What was done instead is a
  close read of `firestore.rules:49-51`, which says the write should pass: the foster
  branch needs `resource.data.fosterId == request.auth.uid` (true — it's their own
  row) and `request.resource.data.status == "withdrawn"` (true — the merged
  post-write document carries it). That is a reading, not a result.
  Signed in as a test foster with at least one application, from the browser console
  on `https://pawthway-hackathon.web.app`, confirm both directions: the
  `{ fosterName, status: "withdrawn" }` write succeeds, and the same write without
  the status change comes back `permission-denied`. **Record the answer here.**
  PH-16 then added the other half of the same errand, and it is the regression that
  matters: with the tightened rule live, the redaction write must *still* succeed
  (that is PH-15's path riding on the deliberately-unpinned `fosterName`), and a
  withdraw write that also changes `shelterId` must now be denied. Four writes, one
  console session.

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
- ~~**PH-7c — spot-check the deployed `/health`.**~~ **Done 2026-08-31 — the
  result is recorded at the top of this section.** PR #33 had verified only the
  *failure* path (no ADC in that environment), leaving "Firestore is reachable
  from the backend" as an untested assertion inside a health endpoint. It is now
  a measured `true`. PH-13 still wants a `/health` hit, but for a different
  reason (two instances reporting different `active_sessions`), so that half is
  not discharged by this.

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

*(Full text of these three rows — 55 lines, all of it load-bearing — in the
[2026-09-04 ledger archive](archive/production-hardening-ledger-2026-09-04.md).)*
