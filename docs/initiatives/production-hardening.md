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


### The line is tense, not topic (2026-09-10)

PH-17's rule, stated as the test rather than as a pair of lists — the form PH-18 and PH-19 both
depend on:

> Could this value be *wrong about a specific animal*? Then it is a record, and it may only
> come from the foster, the shelter's document, or nothing at all.

A tip, a week phase, a task template, an unticked schedule row: all survive — they are advice,
false of no dog in particular. A milestone, a weight, a vaccination line, a journal entry, a
tick, a photograph: all fail. **So does `emergencyContacts`**, which is why PH-18 is the same
defect rather than a neighbour, and so does what the brief tells the model, which is PH-19.
The full 2026-09-10 section — its working of PH-18 against the test, and the original statement
of the seam between the two items — is verbatim in
[`archive/production-hardening-tensetest-2026-09-11.md`](archive/production-hardening-tensetest-2026-09-11.md);
the seam itself now lives in PH-18's queue entry, restated more precisely after re-verification.

### An enumerated absence is a claim — the tense test, moved from the page to the prompt (2026-09-11)

PH-17 established the test and PH-18 showed it was about tense rather than topic. The open
question this run was whether it survives the move from **what the product prints** to **what
the product tells the model**, since a prompt is not read by the foster and could be argued to
be scaffolding. It does survive, and it gets sharper, because the two surfaces fail differently:

> A page can render an absence. A prompt, once it enumerates a field, cannot stay silent about
> it — so **"No medical flags." is not the prompt equivalent of "Not recorded."** The prompt
> equivalent is omitting the sentence.

`adoption.ts` could answer "we hold no weight for this dog" by not drawing the row, and PR #75
did exactly that. `brief.ts:42` has no such move available to it as written: a ternary over
`dog.medicalFlags.length` has two branches and both of them are sentences, so an empty array is
not an absence — it is routed to the confident negative. That is the whole of PH-19's first and
largest finding, and it generalises past this one line: **any template whose empty branch is
prose rather than nothing will convert a missing record into an assertion.** Grep for the shape,
not the field.

Two consequences worth keeping:

- **The model is a reader with no way to check.** A foster reading "Not recorded" knows to go
  and look; a model reading "No medical flags." has been told, and `brief.ts:107-108` closes by
  instructing it never to go beyond what it was given. The instruction is correct and is what
  makes the input's accuracy load-bearing — it should not be softened as the fix.
- **This is why PH-19 is `[large]` and not a one-line change.** Three of its four findings are
  one expression each; what makes it a surface is that the same question has to be asked of
  every value the three LLM moments carry, and nothing in the repo has asked it before.

**One stale fact found while tracing this, recorded here because `CLAUDE.md` is not this loop's
to edit.** `CLAUDE.md` says of the cheap-model path: *"`web/src/api.ts` doesn't send it yet, so
everything currently runs on the capable model; adding it to the `/chat` body is what turns the
cheap path on."* That is no longer true. `api.ts:98` takes `phase?: ChatSurface` and `:109`
sends it in the body; `AgentChatPanel`'s `phase` prop is **required**, not optional; all three
mount points pass it (`MatchChatView.tsx:70` `"match"`, `PostFosterView.tsx:103` `"postfoster"`,
and the Care Plan panel); and `server.py:432` hands `req.phase` to `model_for_surface`. The
cheap path is on, and Match pickup coordination is being answered by Haiku today. Worth a
sentence to Sharang rather than a doc edit.

## Task queue

**Refilled 2026-09-09 after eight consecutive runs of declining to, and the routing is
deliberate.** The 2026-08-31 re-rank exists to stop this doc's small, tidy, headlessly-
verifiable items consuming every execute run while the shelter surface waits — and **that
reasoning does not cover what is queued below.** PH-17 and PH-19 are not scaffolding; they are
the product asserting things about a real animal that nobody observed, which is the class of
defect this doc was founded on (PH-1). They sit here because this doc owns truthfulness, not
because production-hardening has been re-ranked. See the README's 2026-09-09 note.

**PH-17 shipped 2026-09-10 (PR #75) and PH-18 was what was left.** Both had been re-verified
against `main` that morning — PH-17's file list was missing two write paths and a whole fourth
file, and one of its hedges was wrong — and the re-verification held: nothing else in either
item was invalidated by building it.

**2026-09-11 — PH-19 joins it, and it is the repo's only `[large]` item.** PH-17 emptied the
`[large]` slot everywhere, so the README's fallback chain was run in full: the queue held only
PH-18 (small), every gated note is gated on a *person* and not on code (RS-8, RS-6b, RS-12b,
PH-13, PH-7b, PH-15b — unchanged), and the third link, **measure**, was used. What it measured
was PH-17's own method pointed at a different consumer: not what the adoption page prints, but
**what the model is told**. Every value in `buildAgentBrief`'s output traced back to where it
is written. It found a defect in both branches of one line, for all nineteen dogs in the
roster. PH-19 sits **above PH-18** because execute works top-down and the `[large]` item should
be picked first; the two are independent and either can ship alone.

- **PH-19 `[large]` — the agent is told things about the dog that nobody recorded, and then
  told not to doubt them.** `web/src/phases/careplan/brief.ts` composes the context carried by
  every Care Plan question, and it reaches the model for real — `CarePlanView.tsx:251` builds
  it, passes it to `JournalTips` as `dogContext`, and that component sends it at `:151`
  (a logged note) and `:187` (a typed question). Four things in it fail the tense test, and the
  brief's own closing instruction — *"Never invent anything about the dog that isn't above"*
  (`brief.ts:107-108`) — is what converts each of them from a gap into an authority.
  1. **`brief.ts:42` is wrong in both of its branches, for every dog in the roster.**
     `medicalFlags` comes from `d.needs ?? []` (`CarePlanView.tsx:47`). When `needs` is absent
     the brief asserts **"No medical flags."** — a categorical negative about a real animal that
     nobody tested. **9 of the 19 committed dogs have no `needs` at all** (Howdy, Champ,
     Colocho, Krypto, Jackie, Roxy, Sirius, Toby, Uncle Fester), so that sentence is shipped for
     47% of the roster. For the other 10 it is a **mislabel**: the entire `needs` vocabulary is
     behavioural — "Only dog in the home", "Leash training", "Confidence building", "Patient
     introductions", "Daily fetch", "Jumping practice", "Slow introductions", "Teen-dog
     training", "Only pet in the home" — and **not one of the ten values is medical**. The
     model is told "Medical flags: Leash training, Daily fetch." Both counts were measured
     against `data/dogs.json`; re-measure rather than trusting them.
  2. **`brief.ts:41` tells the model a weight of zero.** `weightLbs` is `d.weight_lbs ?? 0`
     (`CarePlanView.tsx:45`), whose comment claims "0 reads as 'unknown' in the Care Plan
     header" — true of that one header and of nothing else. `weight_lbs` is nullable by design
     (CLAUDE.md, "Unknown is not a claim") and the shelter's own add-a-dog form makes it
     optional (`shelterDog.ts:71`, "Give a weight or pick a size", writing `null` at `:125`).
     All 19 committed dogs happen to have one, so this is unexercised **today** and reachable
     the first time a real shelter adds a dog through RS-6's form — at which point the brief
     reads "0 lbs at intake".
  3. **The same `0` is rendered to the foster on the emergency screen.**
     `Emergency.tsx:137` (`{dog.name} · {dog.weightLbs} lbs`) and `:178` (under the label
     **Weight**). Fix these with the brief, not with PH-18 — PH-18 owns the contacts and the
     map, and this is the same `weightLbs` defect wearing a different surface.
  4. **`JournalTips.askAbout` (`:47-75`) asserts age-specific claims about any dog.**
     *"For a puppy ${dogName}'s age, biting is almost always teething"* is returned for a
     nine-year-old, and the final branch ships prototype copy to a real foster: *"In the real
     app this would call an LLM…"*. It is reached whenever the agent is unreachable, and is
     flagged `offline` in the UI but not in its own text.
  **What "fixed" means here is not "delete".** A prompt cannot render "Not recorded" the way a
  page can — see the design answer below. An absent `needs` should produce **no sentence at
  all**, or one that names the absence as an absence ("no medical needs are recorded; the
  shelter may not have assessed this"). A `needs` list should be labelled what it is — care or
  behaviour notes — not "Medical flags". A null weight should drop the clause rather than
  print a number. **Verify** with `npm run test` plus a unit test over `buildAgentBrief` for
  the three shapes that currently have no coverage: a dog with no `needs`, a dog with
  behavioural `needs`, and a dog with no `weight_lbs` — asserting the output contains no
  "No medical flags.", no "Medical flags:" over behavioural values, and no "0 lbs". There is
  no brief test file today; `adoption.test.ts` (new in PR #75) is the pattern to copy.

- **PH-17 `[large]` — shipped 2026-09-10 (PR #75); the Ledger row is the full account.** The
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
  `summary` is already optional (`Emergency.tsx:10`) and already renders "Not recorded" three
  times when absent (`:166`, `:170`, `:174`), so PH-18 is now strictly the contacts array and
  the map. **Re-verified against `main` 2026-09-11, after PH-17 landed; three corrections.**
  (a) The line citation above was stale — PR #75 moved 163 lines out of `data.ts`, so
  `emergencyContacts` is at **`data.ts:204-228`**, not 339-353. (b) **The defect would survive
  its own fix, the same way PH-17's nearly did.** `Emergency.tsx:130` resolves the headline vet
  as `contacts.find((c) => c.distanceMi != null) ?? contacts[0]` — so dropping the VCA row
  makes the fallback bite and the screen renders **Pet Poison Helpline under the heading
  "Nearest 24-hour vet"**, with `nearest.phone` on a *Call Vet Now* button. The two national
  rows are the ones PH-18 correctly keeps, which is exactly what makes them the fallback. The
  nearest-vet card must become conditional on there being a nearest vet, not merely stripped of
  its claims; `nearest` is dereferenced unguarded at `:150`, `:152` and `:156`. (c) One more
  guessed number rides the map rather than the data: `:113` renders `{nearest.distanceMi} mi ·
  4 min`, and the **4 min** is a hardcoded travel time no one computed. It dies with the map,
  so it costs nothing — but it should be named rather than discovered. *(`dog.weightLbs`
  rendering as `0 lbs` at `:137` and `:178` is **PH-19's**, not PH-18's — same file, different
  defect, and the seam is that PH-18 touches only `contacts` and `VetMap`.)* *(A line
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

**Read this before adding to the list below (2026-08-31).** These accumulate faster than
anyone clears them — PH-15 and PH-16 generated PH-15b on the run that shipped them. Per the
README's "nobody uses this app yet" section they are **parked**: nobody is blocked by the
unverified behaviour, and several will answer themselves once a real shelter exercises the
same rules. Do not queue them, and do not read the length of this list as debt.
**PH-7c — DONE 2026-08-31**, the one cheap enough to just do because it needed no sign-in:
the deployed agent's `/health` returns `firestore_reachable: true`. PH-13 still wants a
`/health` hit for a different reason, so that half is not discharged by it.

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

- 2026-09-10 — PH-17 `[large]` — PR #75 — **A demo dog's past no longer reaches a real
  foster's document, or the adoption page.** `data.ts` splits by the tense test: advice stays,
  `marty`/`seedMilestones`/`seedJournal`/`medicalSummary` move to `data.demo.ts` behind
  `LOCAL_MODE`. **All four write paths are gone, not the two the spec named** — both setters
  now fall back to `LOCAL_MODE ? seed : []`, which is what would have left the defect intact:
  the first note a foster wrote saved the whole invented past underneath it. `adoption.ts`'s
  `lastMilestoneWeight` branch is **deleted rather than guarded**. Two things the spec had
  wrong, both expensive: there were no `adoption` tests to add cases to (`adoption.test.ts` is
  new, 8 cases), and `medical` needed a *source designed* rather than chosen — nothing in this
  app records a dog's vaccines, so it is now built from ticked `vaccine`/`medication` schedule
  rows and `vet_visit` care-log entries, is `null` when all three are empty, and **allergies do
  not render at all** ("None reported" is a clean bill of health nobody gave). Build, test
  (98 → 106) and lint all green. **Not verified live** — `web/.env` is configured here, so the
  app is not in `LOCAL_MODE` and Care Plan needs a sign-in this loop can't do. Full 28-line row
  verbatim in the [2026-09-11 ledger archive](archive/production-hardening-ledger-2026-09-11.md).

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
