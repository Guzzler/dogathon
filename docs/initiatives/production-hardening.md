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

## What lifting the instance pin actually costs — answered 2026-08-29, discharged 2026-08-30; archived 2026-09-10

Both blockers shipped (PH-11's divided rate limit, PH-10's live transcript trim), the residual
two-device race is accepted, and what remains is one small PR raising `--max-instances` to **2**
plus the two things only a human can observe. That remainder is **PH-13** under "Needs a human",
stated there in full — which is why this section is now verbatim in
[`archive/production-hardening-instancepin-2026-09-10.md`](archive/production-hardening-instancepin-2026-09-10.md)
rather than here.

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

### What deletion left behind — archived 2026-08-30, compressed 2026-09-10

Two things a deleted account left behind, both structural: the agent transcript (a
subcollection, so deleting the parent document missed it → PH-14 clears it through
`POST /reset` first, while an ID token can still be minted) and the `applications` rows
carrying `fosterName` (**redact, don't delete** — an application is a two-owner record and
must not vanish mid-review → PH-15 redacts and withdraws, PH-16 pins every other field).
Full reasoning, including why `applications`'s update rule must stay loose about
`fosterName` specifically, in [`archive/production-hardening-deletion-2026-08-30.md`](archive/production-hardening-deletion-2026-08-30.md)
— read it before tightening that rule. Narrative archived in
[`archive/production-hardening-settled-2026-09-10.md`](archive/production-hardening-settled-2026-09-10.md).

## No error tracking — compressed 2026-09-10

Cloud Run logs only, and nothing reads them. The *logging* half is already correct
(`server.py:300`, `:332`), so what is missing is one alert policy — **PH-7b** under "Needs a
human", which states it more operationally than this section did. The reason it matters was
demonstrated next door: DC-3's guard printed `fatal: ... no merge base` on four consecutive
runs while reporting success, unnoticed for a day, because nothing reads logs that don't fail
anything.

## Two smaller ones — both resolved; compressed 2026-09-10

PH-5 (guest→account migration, PR #29) and PH-4 (`"strict": true` pinned in
`web/tsconfig.app.json`, PR #27) — the Ledger rows are the full account. One operational note
worth keeping out of the archive: when re-checking strictness use `./node_modules/.bin/tsc`,
because `npx tsc` resolves to an unrelated `tsc@2.0.4` that prints a banner and exits 1
without compiling.

## Advice may be templated; a history may not be seeded — shipped 2026-09-10 (PH-17); archived

The finding that produced this rule — 438 lines written for a demo dog called Marty, reaching
a real foster's Firestore document and from there the adoption page — is verbatim in
[`archive/production-hardening-ph17-2026-09-10.md`](archive/production-hardening-ph17-2026-09-10.md)
together with PH-17's queue entry. The rule itself survives below in its more useful form,
because **PH-18 still depends on it**.


### The line is tense, not topic — and it cuts one file further than PH-17 was scoped (2026-09-10)

PH-17's rule was written against `data.ts` and stated as a pair of lists. Applying it to a
second file turns it into a **test**, which is the more useful form:

> Could this value be *wrong about a specific animal*? Then it is a record, and it may only
> come from the foster, the shelter's document, or nothing at all.

A tip, a week phase, a task template, an unticked schedule row: all survive the test — they
are advice, false of no dog in particular. A milestone, a weight, a vaccination line, a
journal entry, a tick, a photograph: all fail it.

**So does `emergencyContacts`, and that makes PH-18 the same defect rather than a neighbour.**
`data.ts:339-353` ships "VCA SF Veterinary Specialists · Nearest 24h emergency · 1.2 mi ·
Open now" and "Copper's Dream Rescue · Foster coordinator · On-call today" to every foster.
`1.2 mi` and `Open now` are measurements of a distance and an opening time nobody computed;
"Copper's Dream" is a named shelter that is simply not this dog's, and `normalizeDog()`
already supplies the one that is. The two national rows pass the test unchanged — Pet Poison
Helpline and ASPCA Animal Poison Control are published numbers, correct for any US caller,
and assert nothing local. The hand-drawn SVG labelled "Presidio Park" fails it hardest: it is
a map of nowhere on the screen someone opens when something is wrong.

**The seam between the two items, so neither blocks the other.** Both touch
`Emergency.tsx`, which renders `medicalSummary` as its `summary` prop (`CarePlanView.tsx:260`).
**PH-17 owns the prop** — when the medical record moves into the demo-only module, `summary`
becomes optional and Emergency renders the section as absent, using the same "not recorded"
language the adoption page already uses. **PH-18 owns the rows and the map** and touches
neither the prop nor `data.ts`'s journal/milestone exports. PH-18 may ride PH-17 as a single
PR if execute gets there, per the rider convention, but it is correct alone in either order.

## Task queue

**Refilled 2026-09-09, for the first time since 2026-08-30, and the routing is deliberate.**
Eight consecutive runs declined to refill this queue — correctly, because the 2026-08-31
re-rank exists to stop PH's small, tidy, headlessly-verifiable items consuming every execute
run while the shelter surface waited. **That reasoning does not cover what is queued below.**
PH-17 is not scaffolding: it is a whole phase of the product asserting things about a real
animal that nobody observed, on the page a stranger reads to decide whether to adopt it —
the same class of defect as PH-1, this doc's founding item, and the only `[large]` item in
the repo. It sits here because this doc owns truthfulness, not because production-hardening
has been re-ranked. See the README's 2026-09-09 note.

**PH-17 shipped 2026-09-10 and PH-18 is what is left.** Both had been re-verified against
`main` that morning — PH-17's file list was missing two write paths and a whole fourth file,
and one of its hedges was wrong — and the re-verification held: nothing else in either item
was invalidated by building it.

- **PH-17 `[large]` — shipped 2026-09-10 (PR #__); the Ledger row is the full account.** The
  spec and the finding behind it are archived verbatim (link in the section above), since the
  shipped code and the ledger row are now two tellings of the same story. Two things the spec
  did not know, both recorded in the row: there were no `adoption` tests to add cases to, and
  the medical record needed a *source* invented for it, not just a deletion.

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
  shelter is not Copper's Dream and reading the screen for anything still guessed.
  **Grounded 2026-09-10 in PH-17's rule rather than stated on its own** — see "The line is
  tense, not topic" above: `1.2 mi` and `Open now` fail the same test a seeded weight fails,
  which is why this is the same defect and not a neighbouring one. The seam is written there
  too: PH-18 touches the contacts and the map only, never the `summary` prop or `data.ts`'s
  journal and milestone exports. **PH-17 shipped first and discharged its half of the seam** —
  `summary` is already optional and already renders "Not recorded" when absent, so PH-18 is
  now strictly the contacts array and the map. *(A line
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

- 2026-09-10 — PH-17 — PR #__ — **A demo dog's past no longer reaches a real foster's
  document, or the adoption page.** `data.ts` splits by the tense test: advice
  (`taskTemplates`, `weekPhases`, `tips`, `scheduleBlocks` with both `done: true` rows flipped
  to `false`) stays; `marty`, `seedMilestones`, `seedJournal` and `medicalSummary` move to
  `data.demo.ts`, reachable only through `LOCAL_MODE`. **All four write paths are gone, not
  the two the spec named** — both seeding effects deleted outright, and both setters now fall
  back to `LOCAL_MODE ? seed : []` rather than the seed, which is what would have left the
  defect intact: the first note a foster wrote saved the whole invented past underneath it.
  `adoption.ts` no longer defaults `milestones` to a seed, and the `lastMilestoneWeight`
  branch is **deleted rather than guarded** — a weight is a `careLog` weigh-in, the shelter's
  intake figure, or the size bucket, full stop. `CarePlanView` builds the one milestone the
  app can prove (the pickup it scheduled) and passes `summary` to `Emergency` only in
  `LOCAL_MODE`, where it now renders "Not recorded" three times instead of a template.
  **Two things the spec had wrong, both in the expensive direction.** It said "add cases to
  the existing `adoption` tests" — there were none, so `web/src/lib/adoption.test.ts` is new
  (8 cases, two describes: nothing logged, and things the foster actually did). And it asked
  for `medical` to "render from data the app actually holds", which turned out to need a
  source designed rather than chosen: nothing in this app records a dog's vaccines. It is now
  built from ticked `vaccine`/`medication` schedule rows and `vet_visit` care-log entries, is
  `null` when all three are empty, and **allergies do not render at all** — "None reported" on
  the page a stranger reads is a clean bill of health nobody gave. Exit grep is clean: every
  hit for `seedJournal|medicalSummary|seedMilestones|marty` is the demo module or a
  `LOCAL_MODE`-guarded call site. `npm run build`, `npm run test` (98 → 106 passing, 10 → 11 files) and
  `npm run lint` (9 warnings → 8) all green. **Not verified live**: `web/.env` is configured
  here, so the app is not in `LOCAL_MODE` and reaching Care Plan needs a Google sign-in this
  loop can't do. That a foster document gains no `journal` or `careSchedule` field is
  structural — `patchFoster` is now reachable only from the two setters — but it is a reading
  of the code, not an observation of a document.
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

*(Full text of these three rows — 55 lines, all of it load-bearing — in the
[2026-09-04 ledger archive](archive/production-hardening-ledger-2026-09-04.md).)*
