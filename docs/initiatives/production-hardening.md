# Production hardening

The security hole is closed (PR #9) and spend has a ceiling (PR #7). What's
left here is quieter: places the app tells a foster something that isn't
true, or loses something a real person would mind losing. None of it is
visible in a demo. All of it matters the first time a real dog goes home
with a real foster.

## H1 — session state survives a restart (PH-3, PH-8) — settled

Both halves of a foster's agent session live in Firestore on
`fosters/{uid}/agentSession/current`: the transcript as a `messagesJson` string
(`session_store.py`, PH-3, PR #23) and the approval handoff as a polled `pendingApproval`
map (`approval_store.py`, PH-8, PR #37). A redeploy no longer drops a conversation, and a
decision written by any instance reaches a thread parked in any other. Full reasoning —
why the transcript is a JSON string rather than a native array, and PH-8's three deliberate
behaviour changes — in the [archive](archive/production-hardening-2026-08-29.md). What it
leaves open is the `--min-instances=1 --max-instances=1` pin, now *removable* and not
removed; the next section is what removing it costs.

## What lifting the instance pin actually costs — answered 2026-08-29, discharged 2026-08-30

PH-8 left `--min-instances=1 --max-instances=1` removable and gated its removal on "once
this has been watched working in production", which no run of this loop can evaluate.
Reading `server.py` for what was still genuinely per-process replaced that with a concrete
exit condition. Both blockers shipped: the in-memory rate limiter, which silently became a
20N spend ceiling at N instances (PH-11, next section), and a live transcript nothing ever
trimmed, so the 40-message cap only bit across a restart (PH-10). The residual race — two
concurrent turns for one foster on different instances, last-write-wins — needs two devices
and is accepted. **What remains:** `--max-instances` goes to **2** in one small PR, and a
human confirms the two things that only exist multi-instance — `/health`'s `active_sessions`
differing across two hits, and an approval issued in one browser resuming a turn parked in
another. That second one is PH-8's actual claim and has never been observed. It is PH-13
under "Needs a human", and it is the only thing between here and lifting the pin.

## What the rate limit means with more than one instance (decided 2026-08-30, PH-11); compressed 2026-09-09

**Option (b): keep the bucket in memory and divide the budget by the maximum instance
count.** `server.py` carries `CHAT_REQUESTS_PER_MINUTE_BUDGET = 20` (what a foster gets
across the whole service), `MAX_CLOUD_RUN_INSTANCES = 1` (**which must equal
`--max-instances` in `deploy-backend.yml`** — a `!!` comment sits next to the flag, where
someone will actually be editing when they get it wrong), and the per-instance limit
derived from the two. The cost, stated plainly: an unlucky foster whose requests all land
on one instance is throttled at the divided number. Over-throttling one person is
recoverable; multiplying spend by the instance count has no floor. The Firestore-backed
bucket (a) is the correct answer at any instance count and lost on scope, not cost — it
would make the spend brake depend on Firestore, and a limiter that fails closed on a blip
turns a database hiccup into "you can't talk to the assistant". **Revisit (a) if the
instance count stops being a small fixed number**; that is the condition. Today the
division is by 1, so nothing changed numerically, and PH-13 raises both numbers together.
Full reasoning verbatim in
[`archive/production-hardening-ratelimit-2026-09-09.md`](archive/production-hardening-ratelimit-2026-09-09.md).

## The notification that doesn't notify — CLOSED 2026-09-05 by RS-12 (PH-1); compressed 2026-09-09

The arc, in one line: a hardcoded `notified_shelter: True` (2026-08-24) → an honest
capability probe, `arcade_tools.available()` (PH-1, PR #19) → **true because a write
landed on a surface a staff account demonstrably reads** (RS-12, PR #63), with
`notified_via: "shelter_roster"` naming which surface and Arcade demoted to its own
`arcade_messaging_available` field so no one field conflates a capability with a
delivery. The fix was a shelter surface, so it was built and is recorded in
`real-data-and-shelters.md`, not here. Full section verbatim in
[`archive/production-hardening-ph1-2026-09-09.md`](archive/production-hardening-ph1-2026-09-09.md).

**Two things worth carrying forward rather than archiving.** The gap was found by
`grep -rn adoption_profile web/` returning **no reader at all** — the app's most
expensive turn wrote a paragraph no human but the foster ever saw; and the section sat
parked behind "downstream of M3" for days *after* M3 finished, because nobody re-read the
sentence. Nothing signed-in was verified: that half is RS-12b in `real-data-and-shelters.md`.

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

## Settled — advice may be templated; a history may not be seeded (2026-09-09)

**The finding.** `web/src/phases/careplan/data.ts` is 438 lines written for a demo dog
called Marty, and most of it is not a template — it is a **past**. Thirteen
`seedMilestones` with dates and outcomes ("Intake with Copper's Dream · Cleared for foster.
Deworming complete.", "DHPP booster", "Vet check-in (Dr. Alvarez)"), **seven carrying a
weight** from 20 lb to 29 lb; three `seedJournal` entries in a foster's voice ("Wouldn't eat
kibble. Tried a spoon of wet food on top"), one a photograph of a different animal
(`web/public/journal/day4-couch.jpeg`); a `medicalSummary` asserting `DHPP (booster
complete)`, `Allergies: None reported`, `Deworming — in progress`; and `scheduleBlocks`
shipping **pre-ticked** (`s-flea`, `s-dhpp-1` are `done: true`).

None of it is confined to a demo. `useJournal.ts:25` and `:59` write `seedJournal` and
`scheduleBlocks` **into the real foster's Firestore document** on first render, for every
foster, gated on nothing — `useJournalEntries` carefully gates *its* fallback on
`LOCAL_MODE`, and the seeding write defeats that gate by making the data real. From there
it reaches exactly where this project has already decided invented content must not go:
`adoption.ts:144` sets `medical: medicalSummary` **unconditionally**, so every dog's
adoption page prints Marty's vaccines and allergies; `:51`'s `milestones` parameter
**defaults to `seedMilestones`**, which `CarePlanView` re-labels with the real dog's name;
`:98-103` returns a seeded weight as `{ value, source: "care plan" }`, so the page's own
provenance line says a foster observed a number nobody measured; and `careDone` counts the
pre-ticked items. `adoption.ts`'s own comments name the standard without noticing it
applies to its other inputs — *"a stand-in photograph of a different animal on the page a
stranger reads to decide about this one is exactly what 'nothing on this page is invented'
rules out"*. The compatibility tri-state got that treatment; the health record and the
journal did not.

**The rule that resolves it is a line, not a purge:**

> **Forward-looking advice may be templated. A record of what has already happened may
> never be seeded.**

A tip, a week phase, a task template and an *unticked* care schedule are guidance — generic
by construction, true of any dog, honest with `{dog}` substituted. A milestone with a date,
a weight, a vaccination record, a journal entry, a ticked checkbox and a photograph are
assertions that a specific thing happened to a specific animal. The first set stays; the
second must come from the foster, from the shelter's record, or render as absent — the same
three sources `buildAdoptionProfile` already names, and the same standard "Unknown is not a
claim" applies to the dog document.

**`LOCAL_MODE` is the deliberate exception and the only one.** A fresh clone shows a banner
saying the data is local, so showing demo content behind it is honest. **Writing it to a
foster document is not**, in any mode — that is what PH-17 removes outright rather than gates.

## Task queue

**Refilled 2026-09-09, for the first time since 2026-08-30, and the routing is deliberate.**
PH-14/15/16 (PRs #47/#48/#49, the last bullet below) emptied this queue, and eight
consecutive runs then declined to refill it — correctly, because the 2026-08-31 re-rank
exists to stop PH's small, tidy, headlessly-verifiable items consuming every execute run
while the shelter surface waited. **That reasoning does not cover what is queued below.**
PH-17 is not scaffolding: it is a whole phase of the product asserting things about a real
animal that nobody observed, on the page a stranger reads to decide whether to adopt it. It
is the same class of defect as PH-1 ("a tool that lies about notifying a shelter"), which is
this doc's founding item, and it is the only `[large]` item in the repo. It sits here because
this doc owns truthfulness, not because production-hardening has been re-ranked — the
ranking in the README is unchanged, and the top doc goes back to the top the moment a
shelter says yes. See the README's 2026-09-09 note.

- **PH-17 `[large]` — stop seeding a history the foster never lived.** The design section
  above is the specification; this is the file list and the exit condition. Do not
  redistribute it into small PRs — the halves are only honest together.
  - **`web/src/hooks/useJournal.ts` — delete both seeding effects** (`patchFoster({ journal:
    seedJournal })` at :25, `patchFoster({ careSchedule: seedSchedule })` at :59) and the
    `seeded` refs with them. This is the load-bearing change: nothing else matters while an
    invented past is being written into a real document. `useJournal` returns `stored ?? []`
    outside `LOCAL_MODE`; inside it, the seed may still be *shown*, never written.
  - **`web/src/lib/adoption.ts` — three fixes, all provenance.** `medical: medicalSummary`
    (:144) must render from data the app actually holds and otherwise be absent, with
    `"medical record"` added to `missing`; the `milestones` parameter (:51) must **not**
    default to `seedMilestones` — default it to `[]`; and the `lastMilestoneWeight` branch
    (:98-103) must not be reachable from template data, so a weight is either a real
    `careLog` weigh-in (`source: "care plan"`), the shelter's intake figure
    (`source: "shelter"`), or the size bucket — never a seeded figure wearing the foster's
    label.
  - **`web/src/phases/careplan/data.ts` — split the file by the rule, don't gut it.** Keep
    `taskTemplates`, `weekPhases`, `tips`, `daysSincePickup` and the `scheduleBlocks`
    *shape*; set every `done: true` to `false` (`s-flea`, `s-dhpp-1`, and re-check the rest
    — the count is not the two this doc names, verify it). Move `seedJournal`,
    `medicalSummary`, `marty` and every past-dated `seedMilestones` entry into a clearly
    named demo-only module (e.g. `data.demo.ts`) that **only `LOCAL_MODE` code paths may
    import**; the one milestone that can survive is a pickup marker derived from
    `foster.pickup.date`, which is real.
  - **Empty states are part of the item, not follow-up.** `CarePlanView`, `Hub` and the
    adoption page must each read well with an empty journal, no milestones and no medical
    record — the adoption page already has `missing` and the "still to add" prompt for
    exactly this, so use it rather than inventing new copy.
  - **Verify, and make the verification a test rather than a screenshot.** Add cases to the
    existing `adoption` tests: `buildAdoptionProfile` given an empty journal, empty schedule
    and a dog with no medical fields returns no medical assertions, no milestones, a weight
    whose `source` is `"shelter"`, and `missing` naming each absent section. Then
    `grep -rn "seedJournal\|medicalSummary\|seedMilestones\|marty" web/src --include=*.ts
    --include=*.tsx` must return only the demo module and `LOCAL_MODE`-guarded call sites —
    paste that output in the ledger row. Finish with `npm run build` and a local run where a
    foster document that has never opened Care Plan gains **no** `journal` or `careSchedule`
    field (check the Firestore document, or `localStorage` in local mode).

- **PH-18 — the emergency screen makes two claims it cannot support.**
  `web/src/phases/careplan/Emergency.tsx` renders a hand-drawn SVG street map labelled
  "Presidio Park" and "Bay" with a pin for the nearest vet — a picture of nowhere, on the
  screen someone opens when something is wrong — and `emergencyContacts` offers "VCA SF
  Veterinary Specialists · Nearest 24h emergency · 1.2 mi · Open now" and "Copper's Dream
  Rescue · Foster coordinator · On-call today" regardless of where the foster is or which
  shelter the dog came from. **The two national lines stay** — Pet Poison Helpline and ASPCA
  Animal Poison Control are published, correct for any US caller, and claim nothing local.
  The coordinator row comes from the dog's own `shelter` (`normalizeDog()` already supplies
  it) or does not render; the "nearest" row loses `distanceMi` and "Open now" unless
  something computed them, and says plainly that no 24h vet is recorded for this area.
  Delete the decorative map rather than labelling it. Verify by rendering with a dog whose
  shelter is not Copper's Dream and reading the screen for anything still guessed. *(A line
  for the ledger, not a code change: `CLAUDE.md` lists "Emergency Mode (24h vet map)" as
  explicitly out of scope, and it shipped anyway. The scope note is stale.)*

- **PH-14, PH-15 and PH-16 — all shipped 2026-08-30** (PRs #47, #48, #49); the Ledger
  rows are the full account. Between them: `deleteAccount()` clears the agent transcript
  through `POST /reset` before touching anything else and refuses to proceed if it can't,
  redacts `fosterName` and marks every application `withdrawn`, and `applications`'s foster
  update branch pins every field but `fosterName`. **The live rules check two of them asked
  for could not be run and is PH-15b under "Needs a human"** — read it before treating
  those as verified end to end.

### Needs a human — PARKED, not pending

**Read this before adding to the list below (2026-08-31).** These accumulate faster
than anyone clears them: PH-15 and PH-16 generated PH-15b on the very run that
shipped them. Per the README's "nobody uses this app yet" section, they are
**parked** — there are no users for whom the unverified behaviour is broken, and
several will answer themselves once a real shelter and real data exercise the same
rules. They get cleared in one sitting then. Do not queue them, and do not read the
length of this list as debt.

**PH-7c — DONE 2026-08-31**, the one cheap enough to just do because it needed no
sign-in: `curl .../health` on the deployed agent returns `firestore_reachable: true`
(with `anthropic_key_set: true`, `arcade_available: false`, `tool_count: 14`,
`active_sessions: 0`) — the assertion PR #33 left untested inside its own health
endpoint is now a result. PH-13 still wants a `/health` hit, for the different reason
below, so that half is not discharged by this.

- **PH-15b (2026-08-30) — run PH-15's redaction write against the deployed project.**
  PH-15 shipped; its verification did not, and an unattended run has no way to do it:
  the only sign-in is a Google popup, the Firestore emulator needs a JRE that isn't
  installed here, and both popup-free routes to an ID token (creating a test account,
  minting a custom token off the service-account key) are off-limits to this loop.
  What was done instead is a close read of `firestore.rules:49-51`, which says the
  write *should* pass — a reading, not a result. Signed in as a test foster with at
  least one application, from the browser console on `https://pawthway-hackathon.web.app`:
  four writes, one session. The `{ fosterName, status: "withdrawn" }` write succeeds;
  the same write without the status change comes back `permission-denied`; with PH-16's
  tightened rule live the redaction must **still** succeed (PH-15's path riding on the
  deliberately-unpinned `fosterName`); and a withdraw that also changes `shelterId` must
  now be denied. **Record the answer here.**

- **PH-13 (2026-08-29) — lift the instance pin, now that PH-10 and PH-11 have landed.**
  Raise `--max-instances` from 1 to **2** in `deploy-backend.yml` (leave
  `--min-instances=1`), in its own small PR, and rewrite the long comment above the flag
  to say what was confirmed rather than what was expected. Not queued for execute:
  merging deploys to production immediately (`deploy-backend.yml` is path-triggered),
  and what makes it safe can only be confirmed by a person driving two browsers. Confirm
  and record both — `/health`'s `active_sessions` differing across two hits (proof there
  really are two instances), and one dangerous-tool approval issued in one session and
  answered such that the parked turn resumes. That second one is PH-8's actual claim and
  has never been observed.

- **PH-7b — the alerting half of PH-7.** Nothing in the agent backend's failure path
  reaches a person. The logging side is already correct — `server.py` calls
  `logging.exception` at the stream failure (`:300`) and the session-persist failure
  (`:332`), so the records exist in Cloud Logging at `ERROR` severity. What's missing is
  one alert that reads them. Deliberately **not** queued: creating an alert policy and
  notification channel is a hard-to-reverse change to shared GCP infrastructure that
  sends real email and carries quota implications, and an unattended run declined it on
  exactly those grounds (PR #33). That was the right call; re-queueing it would produce
  the same refusal. Roughly: in `pawthway-hackathon`, a notification channel for
  Sharang's email, then a log-based alerting policy on the Cloud Run agent service
  filtered to `severity>=ERROR`. **If you do it via `gcloud`, add the invocation to
  [`docs/runbook-gcp.md`](../runbook-gcp.md)** — that file exists (RS-9 wrote the first
  entry), so this needs a section, not a new doc. Out of scope even then: uptime checks,
  a status page, Sentry, instance pins.

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
