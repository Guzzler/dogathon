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

### An enumerated absence is a claim — the tense test, moved from the page to the prompt (2026-09-11); shipped the same day as PH-19, compressed

The rule, which is what survives:

> A page can render an absence. A prompt, once it enumerates a field, cannot stay silent about
> it — so **"No medical flags." is not the prompt equivalent of "Not recorded."** The prompt
> equivalent is omitting the sentence. Generalised: **any template whose empty branch is prose
> rather than nothing converts a missing record into an assertion.** Grep for the shape, not
> the field.

The working that produced it — including why the model is a reader with no way to check, and
why softening `brief.ts`'s closing "never invent anything about the dog that isn't above" is
the wrong fix — is verbatim in
[`archive/production-hardening-absence-2026-09-11.md`](archive/production-hardening-absence-2026-09-11.md).
**What shipping it added to the rule is in PH-19's ledger row**: omitting the sentence turned
out to be necessary and not sufficient, because the same closing instruction that makes a false
claim authoritative makes silence read as "nothing there".

**One stale fact, still stale, recorded here because `CLAUDE.md` is not this loop's to edit.**
`CLAUDE.md` says the cheap-model path is off — *"`web/src/api.ts` doesn't send it yet"*. It is
on: `api.ts:98` takes `phase?: ChatSurface` and `:109` sends it, `AgentChatPanel`'s `phase` prop
is required, all three mount points pass it, and `server.py:432` hands it to
`model_for_surface`. Match pickup coordination is answered by Haiku today. A sentence to
Sharang, not a doc edit.

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

**PH-19 shipped the same day it was queued, and the `[large]` slot is empty again across all
three docs.** What is left open in the whole repo is **PH-18**, small. Two leads for whoever
refills, both from building PH-19 rather than invented: the "grep for the shape, not the field"
rule above has only been applied to `brief.ts` — the **Match** and **Post Foster** prompts
(`AgentChatPanel`'s `quickActions`, and `src/agent/builtin/adoption.py`'s
`generate_adoption_profile`) carry values to the model that nothing has asked the tense test
of; and `DogProfile.ageMonths` is `Math.max(1, round(age_years * 12))` on a field the
shelter's own form requires (`shelterDog.ts:62` — name, breed and age are the only three that
are), so it is the one intake value in the brief that cannot currently be absent. The
`Math.max(1, …)` floor is the part to look at: it reports "1-month-old" for a dog entered as
0 years, which is a rounding today and an assertion the moment anything reads it as one.

- **PH-19 `[large]` — shipped 2026-09-11 (PR #77); the Ledger row is the full account.** The
  spec is archived verbatim in
  [`archive/production-hardening-ph19-2026-09-11.md`](archive/production-hardening-ph19-2026-09-11.md).
  Unusually, **re-verifying it against `main` before building found nothing wrong** — all four
  findings stood, and both roster counts (9 of 19 with no `needs`; 0 of the 10 recorded values
  medical) re-measured exactly. That is the first time in three `[large]` items, and the
  standing habit is still worth its cost: it cost ten minutes and the two previous items were
  both materially wrong. One thing the spec asserted in passing *was* false, and it was the
  code's own comment rather than the spec's claim — see the row.

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

### Needs a human — PARKED, not pending; archived 2026-09-11

Three items, all parked, none discharged, each wanting a signed-in human this loop cannot be:
**PH-15b** (run PH-15's redaction write against the deployed project — four writes, one
session), **PH-13** (lift `--max-instances` to 2 and confirm the two things only a person
driving two browsers can see), **PH-7b** (one Cloud Logging alert policy over the agent's
`severity>=ERROR` records; deliberately declined by an unattended run in PR #33, and
re-queueing it would produce the same refusal). Each is stated in full — what to do, what to
expect, and what a denial would mean — in
[`archive/production-hardening-needsahuman-2026-09-11.md`](archive/production-hardening-needsahuman-2026-09-11.md);
read that before acting on any of them, and do not re-derive them from these three lines.
**PH-7c is DONE** (2026-08-31, the one cheap enough to just do: `/health` reports
`firestore_reachable: true`).

Per the README's "nobody uses this app yet", the length of that list is not debt. Do not queue
them, and do not add to it without reading the archived preamble first.

## Ledger

- 2026-09-11 — PH-19 `[large]` — PR #77 — **The Care Plan brief stops asserting things nobody
  recorded, and stops calling training notes medical.** `DogProfile.medicalFlags` → `careNeeds`
  (the name `adoption.ts` already used for the same data) and `weightLbs: number | null`;
  `brief.ts` drops the weight clause when there is no weight and the needs clause when there
  are none. **Omitting the sentence turned out to be necessary and not sufficient**, which is
  the one thing the design answer had not anticipated: the brief closes by telling the model
  never to go beyond what it was given, so a silently-absent field reads as "nothing there"
  just as confidently as "No medical flags." did. So `sayWhatIsMissing()` states each gap as a
  gap — *"The shelter's record for Juniper does not include any care or behaviour needs and a
  weight at intake. That is a gap in the paperwork, not a finding"* — which is the only form
  that is both true and useful to a reader who cannot go and check. The same null weight is
  now guarded on the emergency screen (`:137`, `:178` → "Not recorded"), and `askAbout`'s
  offline fallbacks lose the age claim returned for nine-year-olds ("For a puppy X's age…")
  and the prototype copy shipped to real fosters ("In the real app this would call an LLM…").
  **One false claim found in the code, not in the spec**: `CarePlanView.tsx:45`'s comment
  justified `?? 0` as reading "unknown in the Care Plan header", and no header renders
  `weightLbs` at all — the only two readers were the emergency screen and the brief, and both
  printed the zero as a fact. `brief.test.ts` is new (9 cases; 106 → 115), covering the three
  shapes with no coverage plus the multi-gap sentence. Build, test and lint green, no new
  warnings. **Not verified live** — Care Plan needs a sign-in this loop can't do; the brief is
  a pure function and is covered by tests instead.

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
