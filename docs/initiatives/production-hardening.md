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
removed; **PH-13** under "Needs a human" is what removing it costs.

## Six settled things, and where their reasoning lives — compressed 2026-09-12

All six were already pointers into earlier archives rather than reasoning, so they were cut in
one move to [`archive/production-hardening-settled-2026-09-12.md`](archive/production-hardening-settled-2026-09-12.md),
which holds them verbatim. Read that first if you are about to touch any of them; each line
below is an index entry, not an account.

- **The instance pin** — both blockers shipped, the residual two-device race is accepted, and
  what is left is one PR raising `--max-instances` to 2 plus two things only a human can
  observe. That remainder is **PH-13**, parked.
- **What the rate limit means with more than one instance** (PH-11) — a per-foster budget
  divided by `MAX_CLOUD_RUN_INSTANCES`, which **must equal `--max-instances` in
  `deploy-backend.yml`**. Revisit the Firestore-backed bucket only if the instance count stops
  being a small fixed number.
- **The notification that doesn't notify** (PH-1) — **CLOSED 2026-09-05 by RS-12**: the write
  lands on a surface a staff account demonstrably reads. Two things worth carrying rather than
  archiving: the gap was found by `grep -rn adoption_profile web/` returning **no reader at
  all**, and the section sat parked behind "downstream of M3" for days *after* M3 finished
  because nobody re-read the sentence.
- **Account deletion and export** (PH-2, PH-6) and **what deletion left behind** (PH-14,
  PH-15, PH-16) — deletion reaches the agent transcript and the shelter's inbox; applications
  are **redacted, not deleted**, and `applications`'s update rule stays deliberately loose
  about `fosterName` for exactly that. Read the 2026-08-30 archive before tightening it.
- **No error tracking** — the logging half is correct; the missing half is one alert policy,
  which is **PH-7b**, parked.
- **Two smaller ones** — PH-5 and PH-4, both resolved. One operational note that is cheaper
  here than in an archive: when re-checking strictness use `./node_modules/.bin/tsc`, because
  `npx tsc` resolves to an unrelated `tsc@2.0.4` that prints a banner and exits 1 without
  compiling.

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

### The rule has a second side: what the model is allowed to write *down* (2026-09-12)

PH-19 fixed what the model is **told**. Nothing has yet asked what the model is **permitted to
assert**, and the two are not the same question, because this app keeps exactly one thing a
model wrote:

> `send_adoption_profile_to_shelter` stores `profile_text` on the dog's own document
> (`adoption.py:63`), and since RS-12 **that write is the notification** — shelter staff read
> the paragraph at `/shelter/dogs` (`ShelterRosterView.tsx:236-237`) and decide from it whether
> a real animal gets listed. Every other model output in Pawthway is a chat turn that scrolls
> away.

Asked of that paragraph, the tense test answers immediately: a sentence in it *can* be wrong
about a specific animal, so it is a record, and it may only come from the foster, the shelter's
document, or nothing at all. What makes this a surface rather than a wording change is that
**three separate things currently push the other way**, and they compound:

1. **The prompt asks for the shape, not the evidence.** `PAWTHWAY_SYSTEM`'s adoption paragraph
   (`server.py:94-104`) says *write a warm, **specific**, one-paragraph adoption profile*. Warm
   and specific over sparse, nullable inputs is the precise instruction to fill.
2. **The one anti-invention clause in that paragraph is scoped to channels**, not content —
   *"never describe a channel that didn't run"* covers whether an email was sent and says
   nothing about the dog. The pickup paragraph has a content clause (*"speak generally rather
   than inventing specifics"*); the care paragraph and the adoption paragraph have none. Of the
   three moments this agent exists for, the one whose output is *persisted* is the one with no
   content guardrail.
3. **The tool hands over absence as silence.** `generate_adoption_profile` returns `dog`,
   `foster_intake` and `care_log` raw. A dog with no `needs`, no weight and an empty care log
   arrives as three thin objects, and PH-19 already established what a model does with that: a
   silently-absent field reads as "nothing there" exactly as confidently as a false claim reads
   as a fact.

The answer to (3) is the part worth recording, because **the frontend already solved it and the
backend never got the answer.** `buildAdoptionProfile` computes `missing: string[]`
(`adoption.ts:151-156`) for this exact reason, stated in its own header comment: *"Every field
is either logged by the foster, recorded by the shelter, or absent — and `missing` lists what is
absent so the page can ask for it instead of filling it in."* Two consumers read the same three
data sources; one was taught the rule and one was not. So the generalisation is not a new rule
at all, it is a **routing** one:

> When a fix teaches one reader of a dataset to handle absence, check every other reader of that
> same dataset before calling it shipped. The second reader is cheaper to fix than the first —
> the design work is done — and it is the one nobody notices, because the first reader is the
> one that was visibly broken.

That is 2026-09-11's "ask who else reads the surface you measured last" arriving one layer down:
not a second *surface*, a second *consumer of the same records*. It is also why the
`missing`-list shape is the right answer here rather than a stronger prompt sentence — a prompt
can be argued with, and an enumerated gap in the tool result cannot.

**One claim the measurement contradicts, worth naming precisely rather than loosely.**
`adoption.ts`'s header says "Nothing here is invented", and that is true of `adoption.ts` —
`buildAdoptionProfile` really does source every field. But `CLAUDE.md`'s "The adoption page"
section generalises it to *"Nothing on this page is invented"*, and the agent-written paragraph
is a second, generated artefact about the same dog, read by staff rather than by the page.
The two do not currently contradict each other in code, because **`/adoption/:dogId` does not
render `adoption_profile`** — grep finds its only frontend reader is the shelter roster. So this
is a scope note, not a bug: the sentence is right about the page and silent about the paragraph.
Correcting `CLAUDE.md` is Sharang's, not this loop's.

## Task queue

**The routing that put truthfulness items in the third-ranked doc still holds, and it is worth
restating once rather than re-narrated each run.** The 2026-08-31 re-rank exists to stop this
doc's small, tidy, headlessly-verifiable items consuming every execute run while the shelter
surface waits — and it does not cover PH-17, PH-19 or PH-20. Those are not scaffolding; they
are the product asserting things about a real animal that nobody observed, which is the class
of defect this doc was founded on (PH-1). They sit here because this doc owns truthfulness, not
because production-hardening has been re-ranked. *(The three-run narration of how PH-17 and
PH-19 were found, queued and shipped is now told by their Ledger rows and by "The line is
tense, not topic" above; it was cut on 2026-09-12 under the README's rule that a design answer
stops earning its length once something else restates it.)*

**2026-09-12 — PH-20 joins PH-18, and the `[large]` slot stays in this doc for a fourth
consecutive run.** PH-19 shipped the day it was queued, which emptied the slot everywhere and
left PH-18 — small — as the only open item in the repo. So the README's fallback chain was run
in full again: the queue held nothing big, every gated note is still gated on a *person* and
not on code (RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b — re-read, unchanged), and the third
link, **measure**, was used. It was used the way 2026-09-11 recommended — *point the last
method at another consumer rather than invent a new method* — and that recommendation paid off
twice over, because **the lead PH-19 left was half wrong and the half that was right was bigger
than it looked**:

- **The Match prompts pass the tense test, and that is a result rather than a non-finding.**
  Every value `MatchChatView`'s three `quickActions` interpolate — `dog.name`,
  `foster.pickup.date`, `foster.pickup.time`, `dog.shelter.name` — is a record the foster or
  the shelter actually wrote, and the screen does not render at all without `foster.pickup`
  (`MatchChatView.tsx:23`). Nothing to fix. The lead can be struck.
- **The Post Foster half is not a prompt problem at all**, which is why it is PH-20 and
  `[large]` rather than the one-line edit the lead implied. See the design section directly
  above: the defect is that the app persists one model-written paragraph as a record about a
  real animal, and all three of the things shaping that paragraph — the system prompt's ask,
  its missing content guardrail, and a tool that returns absence as silence — push toward
  filling gaps rather than naming them.

`DogProfile.ageMonths`'s `Math.max(1, …)` floor is the one lead left untouched and it survives
unchanged: it reports "1-month-old" for a dog entered as 0 years, which is a rounding today and
an assertion the moment anything reads it as one.


- **PH-20 `[large]` — shipped 2026-09-12 (PR #__); the Ledger row is the full account.** The
  spec is archived verbatim in
  [`archive/production-hardening-ph20-2026-09-12.md`](archive/production-hardening-ph20-2026-09-12.md).
  Re-verifying it against `main` before building found **nothing wrong** for the second
  consecutive `[large]` item — both traps it named were real, `adoption.ts:151-156` is exactly
  where it says, and the tool returns `snap.to_dict()` as described. The follow-up it asked be
  noted rather than built is below, unqueued.

- **Unqueued lead from PH-20, for `dogathon-plan`: `adoption_profile` cannot be retracted.**
  Nothing in the app clears it, so a paragraph the foster later disagrees with is permanent on
  a real dog's record, read by shelter staff at `/shelter/dogs`. `adoption_profile_source`
  now says the agent wrote it, which is what makes a retraction path buildable — the roster can
  tell the two apart. Labelling it there is the smaller half; the write path is the larger.

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
  **Re-verified against `main` again 2026-09-12, after PH-19 landed in this same file; two
  corrections, one of them material.** (a) Line drift, as expected from a PR that edited
  `Emergency.tsx`: the unguarded `nearest` dereferences are now `:150`, `:153`, `:155` and
  `:159` (the `tel:` href), not `:150`/`:152`/`:156`; `:130` and `:113` are both unmoved, and
  `data.ts:204-228` is exactly right. The `:137`/`:178` weight guards this entry set aside as
  PH-19's **shipped** — `:182` now reads "Not recorded" — so that half of the seam is closed
  and PH-18 is strictly `contacts` and `VetMap`. (b) **The fix as written cannot be built as
  written, and this is the third consecutive item whose spec was wrong in the same direction.**
  It says the coordinator row "comes from the dog's own `shelter`" — but **no shelter record
  anywhere in this app carries a phone number.** `Shelter` is `{id, name, short, address, lat,
  lng}` (`shelters.ts:1-3`) and `Dog.shelter` is the same six fields (`types.ts:104`). An
  `EmergencyContact` row is rendered as a `tel:` link, so sourcing the row from the shelter
  yields a name, a role and **no way to call anyone**. Decide that deliberately: either the
  coordinator row renders without a call action, or it does not render at all. Do not add a
  `phone` to `Shelter` to make the row work — that field would have to be *filled*, and
  inventing it is the defect PH-18 exists to remove. (c) The acute part this entry never
  named: **both local phone numbers are invented**, and one of them belongs to an organisation
  that does not exist — `shelters.ts:13` records Copper's Dream Rescue as *"from the product
  spec"*. A made-up number on the screen a foster opens when something is wrong is a worse
  failure than a made-up distance, and it is the same delete.

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

- 2026-09-12 — PH-20 `[large]` — PR #__ — **The one paragraph this app keeps because a model
  wrote it now has to name what nobody recorded.** `generate_adoption_profile` returns a
  seventh key, `missing` — computed the way `adoption.ts:151-156` computes its own, plus the
  two the page doesn't need and the model does (no weight from either source, no `needs` on the
  dog) — and each entry is a **sentence about what did not happen** rather than a field name,
  for PH-19's reason: a bare token reads as "nothing there". `PAWTHWAY_SYSTEM`'s adoption
  paragraph loses the word **"specific"** (the word doing the damage over sparse, nullable
  inputs), keeps "warm", and gains the content guardrail the pickup paragraph already had —
  every detail from the tool result, gaps stated plainly, *"a short paragraph that is true of
  this dog is correct when the care log is thin; a fuller one that is true of some dog is
  not"*. `send_adoption_profile_to_shelter` writes `adoption_profile_source: "agent"` beside
  the text, with an optional field on `Dog` and nothing rendering it yet. **The harness needed
  building before the tests could be written**, which the spec had not costed: `tests/conftest.py`
  had no `update()` and no `order_by().stream()`, so neither of this module's two tools could be
  driven at all — that is why `adoption` had no tests, not oversight. The fake's `update()`
  **raises on a missing document** rather than creating one, or a test would pass against a dog
  nobody seeded. `tests/test_adoption.py` is new (12 cases; 34 → 46), covering all seven gaps,
  none, the exact subset, the two joins most likely to be got wrong (a shelter weight is not a
  weigh-in; a vet visit is not a weight), and the `notified_shelter`/`arcade_messaging_available`
  split. Backend import, `compileall` and `pytest` green; frontend build, test and lint green
  with no new warnings. **Not verifiable live by an unattended run** — reaching Post Foster
  needs a completed foster journey on a signed-in account, so the tests are the verification.
  The retraction path the spec asked be noted rather than built is left as an unqueued lead in
  the Task queue.

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

*(Sixteen rows for **PH-1 … PH-16** stood here, each already a one-line compression of a
longer row archived elsewhere. On 2026-09-12 they moved to
[`archive/production-hardening-ledger-2026-09-12.md`](archive/production-hardening-ledger-2026-09-12.md),
which names for each of them where the uncompressed text lives. A compression of a compression
is the cheapest thing in a doc at its ceiling to cut, because nothing is lost that was not
already two hops away — this is the README's "the Ledger is the first place to look" rule
reaching the end of what it can give on this doc.)*
