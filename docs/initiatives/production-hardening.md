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

## The tense test, and the four faces it has been asked in — consolidated 2026-09-13

Four sections stood here, one per shipped item, each a rule plus a preamble plus a pointer to
the archive holding its working. They are one rule asked four times, so they are one section.
The statements below are verbatim; everything that surrounded them is in the archives named at
the end, and **PH-18 and PH-21 both still depend on this**.

**1 — the test itself (PH-17, what a page may print).**

> Could this value be *wrong about a specific animal*? Then it is a record, and it may only
> come from the foster, the shelter's document, or nothing at all.

A tip, a week phase, a task template, an unticked schedule row: all survive — they are advice,
false of no dog in particular. A milestone, a weight, a vaccination line, a journal entry, a
tick, a photograph: all fail. **So does `emergencyContacts`**, which is why PH-18 is the same
defect rather than a neighbour.

**2 — input (PH-19, what a model may be told).**

> A page can render an absence. A prompt, once it enumerates a field, cannot stay silent about
> it — so **"No medical flags." is not the prompt equivalent of "Not recorded."** The prompt
> equivalent is omitting the sentence. Generalised: **any template whose empty branch is prose
> rather than nothing converts a missing record into an assertion.** Grep for the shape, not
> the field.

Shipping it added the half the rule had not anticipated, recorded in PH-19's ledger row:
omitting the sentence is necessary and **not sufficient**, because the same closing instruction
that makes a false claim authoritative makes silence read as "nothing there".

**3 — persistence (PH-20, what a model may assert).**

> This app keeps exactly one thing a model wrote. `send_adoption_profile_to_shelter` stores
> `profile_text` on the dog's own document (`adoption.py:126`), and since RS-12 **that write is
> the notification** — staff read the paragraph at `/shelter/dogs` and decide from it whether a
> real animal gets listed. Every other model output in Pawthway is a chat turn that scrolls
> away. A sentence in it can be wrong about a specific animal, so it is a record.

And the routing rule that found it, which is the reusable half:

> When a fix teaches one reader of a dataset to handle absence, check every other reader of that
> same dataset before calling it shipped. The second reader is cheaper to fix than the first —
> the design work is done — and it is the one nobody notices, because the first reader is the
> one that was visibly broken.

**4 — audience (PH-21, who is shown the assertion).** Shipped 2026-09-13; the measurement
and the design answer are the section directly below, and what the build added to them is
PH-21's ledger row. The answer the measurement gave: the assertion reached only the party
who cannot verify it, never the two who can.

*Archives, in order: [PH-17's finding and the original tense-test working](archive/production-hardening-ph17-2026-09-10.md)
and [the 2026-09-10 section in full](archive/production-hardening-tensetest-2026-09-11.md);
[PH-19's working](archive/production-hardening-absence-2026-09-11.md);
[PH-20's design section and the queue narration that found it](archive/production-hardening-secondside-2026-09-13.md).*

**One stale fact, still stale, recorded here because `CLAUDE.md` is not this loop's to edit.**
`CLAUDE.md` says the cheap-model path is off — *"`web/src/api.ts` doesn't send it yet"*. It is
on: `api.ts:98` takes `phase?: ChatSurface` and `:109` sends it, `AgentChatPanel`'s `phase` prop
is required, all three mount points pass it, and `server.py:432` hands it to
`model_for_surface`. Match pickup coordination is answered by Haiku today. A sentence to
Sharang, not a doc edit. *(A second one joins it this run, from PH-21's measurement:
`CLAUDE.md`'s "The adoption page" section says "Nothing on this page is invented", which is true
of `buildAdoptionProfile` and silent about the agent-written paragraph. Correcting it is
Sharang's, not this loop's.)*

### A retraction is a write — archived 2026-09-14

PH-21 shipped (PR #81) and its ledger row is the fuller telling, so the design section that
produced it moved verbatim to
[`archive/production-hardening-ph21design-2026-09-14.md`](archive/production-hardening-ph21design-2026-09-14.md).
Three things from it are still load-bearing and are stated here rather than one hop away:
**a retraction is a write, not an erasure** (since RS-12 the write *is* the notification, so a
cleared field leaves a **Back from foster** card with nothing in it); **the write goes through
the agent and `firestore.rules` does not move** (a foster cannot write `dogs`, and widening
that would hand every foster their shelter's roster); and the method — *measure every reader
and every writer of a field, traced to the surface it renders on* — which is what PH-22 below
reuses against a different field.

## Task queue

**The routing that put truthfulness items in the third-ranked doc still holds, and it is worth
restating once rather than re-narrated each run.** The 2026-08-31 re-rank exists to stop this
doc's small, tidy, headlessly-verifiable items consuming every execute run while the shelter
surface waits — and it does not cover PH-17, PH-19, PH-20 or PH-21. Those are not scaffolding;
they are the product asserting things about a real animal that nobody observed, which is the
class of defect this doc was founded on (PH-1). They sit here because this doc owns
truthfulness, not because production-hardening has been re-ranked.

**2026-09-14 — PH-22 replaces PH-21, and the `[large]` slot stays in this doc for a sixth
consecutive run.** PH-21 shipped the day it was queued (PR #81) — the third run running that a
`[large]` item has been queued and built inside 24 hours — which again emptied the slot
everywhere and again left PH-18, small, as the only open item in the repo. The README's fallback
chain was re-run rather than carried over: the queue held nothing big; every gated note is still
gated on a *person* and not on code (RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b — re-read,
unchanged, and `git log --all --since=2026-09-11` is this loop's own commits only); so the third
link, **measure**, was used for the sixth time.

**What was measured, and why it is not a sixth restatement of the same thing.** PH-19, PH-20 and
PH-21 each pointed the previous run's method at the next consumer of one dataset — the adoption
profile — and that vein is worked out. This run pointed the *method* (every writer and every
reader of a field, traced to the surface it renders on) at a different target: not a field, but
**the convention the writers share**. Both of this app's two dog-writing paths deliberately omit
a field they have no value for, and `shelterDog.ts:120-122` states the contract out loud —
*"an absent key is 'not recorded', which `normalizeDog()` already knows how to render."* It
does not. That produced **PH-22**, and the thing that generalises is the target selection:

- **A convention is measurable, and a stated contract is the cheapest kind to check** — it names
  its own callee, so the measurement is "open that file and see". This one had been wrong since
  RS-6 shipped it, in a comment written *by* the careful path, *about* the careless one.
- **The honesty affordance and the erasure can sit in different files, and the affordance is the
  one everybody reads.** `compat()`'s deliberate three-way is documented in `CLAUDE.md`, was
  reasoned about in a code comment, and is the first thing anyone finds when asking whether this
  app handles unknowns. It is also downstream of a normaliser that has already removed the
  unknown from two of the three biggest scoring terms. **Where a codebase is visibly careful is
  where it is least worth measuring; measure the layer that runs before it.**

`DogProfile.ageMonths`'s `Math.max(1, ...)` floor survives unchanged as the one untouched lead:
it reports "1-month-old" for a dog entered as 0 years, a rounding today and an assertion the
moment anything reads it as one. **`normalizeDog`'s `ageLabel` has the same floor** (`dog.ts:66`)
— noted here rather than folded into PH-22, whose seam is deliberately narrow.

### A default is honest when it is a fallback for the layout, and dishonest when it is an answer (2026-09-14)

The tense test asks whether a value could be *wrong about a specific animal*. A derived default
can be both at once, which is why this one needed a line drawn rather than a deletion: `size:
"medium"` stops a card's layout from breaking, and the very same value printed on a row labelled
**Size** answers a question the shelter never answered. So:

> **A default is a fallback when it feeds geometry and a claim when it feeds a labelled row or a
> sentence.** Keep it for the first; the second must render the absence. The test is not what the
> value *is*, it is whether a reader could mistake it for something someone recorded.

Two consequences, both of which keep this from becoming a thirty-site refactor:

1. **`RichDog` does not become nullable everywhere.** The non-null fields stay, because layout
   genuinely needs them; what is missing is the *provenance* beside them, and the codebase
   already has the idiom for it twice over — `adoption_profile_source` (PH-21) and
   `dogPhotoOrNull()`'s branch on `source` (RS-6). A `derived` set on `RichDog`, or nullable
   siblings beside the non-null ones, is one decision for execute to make; either satisfies the
   rule, and neither requires every render site to learn about absence.
2. **A score is a ranking, not an answer, so the number itself needs no "not recorded" state** —
   but it does need to stop pretending its input was known, which is exactly what `compat()`'s
   −4 already does for the four fields the normaliser passes through. Extending that to size and
   energy is the same decision applied one layer earlier, not a new one.

- **PH-22 `[large]` — the absence both writers carefully record is erased by the layer that
  renders it.** *(Queued 2026-09-14. This doc owns it for the same reason it owns PH-17/19/20/21
  — truthfulness — and not because production-hardening has been re-ranked; see the routing note
  at the top of this queue. It lands on Discovery, which is Eesha's phase: `gh pr list --state
  open` was empty when it was queued, but check again before building.)*

  **The measurement, so nobody rebuilds it.** Both dog-writing paths omit rather than null a
  field they have no value for — `dogFromForm()` (`web/src/lib/shelterDog.ts:124-157`, asserted
  by `shelterDog.test.ts:87`) and the importer's `to_dog()`. `normalizeDog()`
  (`web/src/lib/dog.ts:48-70`) then fills five of those absences with confident values:
  `foster_weeks` -> **6** and `"6 weeks"` (`:49`, `:62-63`); `size` with no weight ->
  **`"medium"`** (`:53`); `energy_level` -> `guessEnergy()` (`:31-38`), a **breed regex** —
  `collie|husky|terrier|shepherd|russell|cattle` scores 4 — plus age thresholds; `photo` -> a
  hash of the dog's **id** into a placedog stand-in; `shelter` -> `shelterFor()`.

  **Coverage against the committed roster** (`data/dogs.json`, 19 dogs): `foster_weeks` **0/19**
  and `foster_length` **0/19**, so *every dog in the real roster* renders "6 weeks" — and once
  `pickup.date` exists, `fosterWindow()` (`lib/foster.ts:73`) turns that 6 into a **countdown, a
  progress bar and an end date**: "12 days left", "Last day", "3 days over". A date a real foster
  plans around, arithmetic all the way down from a constant. By contrast `size` and
  `energy_level` are **19/19**, supplied by `enrichment.json` from the shelter's own write-up —
  so those two derivations never fire on the scraped roster and *do* fire on a dog a shelter
  types in through RS-6, which is the inverse of where you would want them.

  **Read sites** (the "answer" half, every one of them a labelled row or prose):
  `SwipeDeck.tsx:163` (`{fosterLength} foster`), `DogDetailView.tsx:98` and **`:153`** (a
  `Row k="Foster length"`), `SavedView.tsx:140` and `:166`, `HubView.tsx:88`,
  `PostFosterView.tsx:48`. Plus `matchReasons()` (`matching.ts:68-84`), which renders the derived
  values as sentences to the foster — *"Zoomies energy, exactly the pace you picked"*,
  *"Medium — right in your size range"*, *"An easy first foster"*.

  **The sharp half: the honesty is downstream of the erasure.** `compat()` (`matching.ts:17`)
  scores an unknown **−4 rather than −26**, deliberately, and `:40-42` do the same for grooming
  and coat. But `scoreDog` takes a `RichDog`, so `d.size` and `d.energyLevel` **cannot be unknown
  by the time it runs** — and those two feed the largest terms in the score
  (`22 - |pref - size|*0.4` and `22 - |pref - energy|*11`, against a base of 52). The documented
  care applies only to the four fields the normaliser leaves alone.

  **One stale claim to correct inside this diff.** `matching.ts:50` justifies the −4 by *"the
  score >= 45 cutoff in DiscoveryView"*. **There is no cutoff.** `DiscoveryView.tsx:34-35`
  carries the opposite comment — *"No match-score cutoff: the real roster is small, so a weak
  match still beats no dog at all"* — and `:36-38` filter on the search string only, then sort.
  The −4 is still correct; its reason is **ranking**, not admission, and the comment should say
  so. *(`CLAUDE.md` repeats the same dead cutoff under "Unknown is not a claim". A sentence to
  Sharang, not a doc edit — this loop does not edit that file.)*

  **The seam, deliberately narrow.** PH-22 touches `foster_weeks`/`foster_length`, `size` and
  `energy_level` only. It does **not** touch the photo fallback (RS-6 solved that half with
  `source`, and `dogPhotoOrNull()` is the precedent this item follows rather than a problem to
  fix); it does **not** touch `shelterFor()`, documented as the seeded-demo fallback and already
  declined by `dogFromForm()` rather than invented; it does **not** touch `parseLegacyLength()`,
  which reads a value someone actually wrote; it does **not** widen `compat()`'s existing
  three-way; and it does **not** touch `ageLabel`'s one-month floor, the lead left standing above.

  **Verify** by rendering Discovery, a dog profile, Saved and the Hub against the committed
  roster — where `foster_weeks` is absent on all 19 — and reading every surface for a duration, a
  size or an energy word still claiming to be recorded, including after setting a `pickup.date`
  so the countdown branch runs. Unit tests are the real verification, since every affected
  function is pure: `fosterWindow` with no total, `scoreDog` and `matchReasons` with an unknown
  size and an unknown energy, and `normalizeDog` over a record carrying none of the three. Say
  plainly in the ledger row what was and was not observed live.

- **PH-21 `[large]` — shipped 2026-09-13 (PR #81); the Ledger row is the full account.** The
  four-part queue entry is archived verbatim in
  [`archive/production-hardening-ph21-2026-09-13.md`](archive/production-hardening-ph21-2026-09-13.md);
  the design section above stays, because it holds the measurement rather than the build
  instructions. Its re-verification found nothing wrong, for the second consecutive run —
  `PostFosterView` did still hold the raw dog document and the banner was still at `:70-74`.

- **PH-17, PH-19 and PH-20 `[large]` — all shipped** (PRs #75, #77, #79). Ledger rows below are
  the full accounts; specs archived verbatim. The habit of re-verifying a spec against `main`
  before building is six runs old and still worth its cost — nothing wrong on PH-19 and PH-20,
  something materially wrong on PH-17 and on PH-18 three times.

- **PH-18 — the emergency screen makes claims it cannot support.** *(Entry rewritten
  2026-09-13: six rounds of re-verification had accreted as six layers of line-drift
  narration on top of a spec that changed three times. What follows is the spec as it now
  stands, with only the corrections that are still live. The superseded rounds are in the git
  history of this file and are not worth a reader's time.)*

  `web/src/phases/careplan/Emergency.tsx` renders a hand-drawn SVG street map labelled
  "Presidio Park" and "Bay" with a pin for the nearest vet — a picture of nowhere, on the screen
  someone opens when something is wrong — and `emergencyContacts` (`data.ts:204-228`) offers
  "VCA SF Veterinary Specialists · Nearest 24h emergency · 1.2 mi · Open now" and "Copper's
  Dream Rescue · Foster coordinator · On-call today" regardless of where the foster is or which
  shelter the dog came from. `:113` renders `{nearest.distanceMi} mi · 4 min`, and the **4 min**
  is a hardcoded travel time nobody computed; it dies with the map. **The two national lines
  stay** — Pet Poison Helpline and ASPCA Animal Poison Control are published, correct for any US
  caller, and claim nothing local. Delete the decorative map rather than labelling it.
  Grounded in the tense test above: `1.2 mi` and `Open now` fail it exactly as a seeded weight
  does. **The seam:** PH-18 touches `contacts` and `VetMap` only — never `summary` (already
  optional and already rendering "Not recorded"), never `data.ts`'s journal and milestone
  exports, never `weightLbs` (PH-19 shipped that half; `:182` now reads "Not recorded").

  Three corrections that are still live, each found by re-verifying rather than by building:

  - **The defect would survive its own fix.** `:130` resolves the headline vet as
    `contacts.find((c) => c.distanceMi != null) ?? contacts[0]`, so dropping the VCA row makes
    the fallback bite and the screen renders **Pet Poison Helpline under the heading "Nearest
    24-hour vet"**, with `nearest.phone` on a *Call Vet Now* button. The two national rows are
    the ones PH-18 correctly keeps, which is exactly what makes them the fallback. The
    nearest-vet card must become **conditional on there being a nearest vet**, not merely
    stripped of its claims; `nearest` is dereferenced unguarded at `:150`, `:153`, `:155` and
    `:159` (the `tel:` href).
  - **The coordinator row cannot be sourced as written.** This entry used to say it "comes from
    the dog's own `shelter`" — but **no shelter record anywhere in this app carries a phone
    number.** `Shelter` is `{id, name, short, address, lat, lng}` (`shelters.ts:1-3`) and
    `Dog.shelter` is the same six fields (`types.ts:104`), while an `EmergencyContact` renders
    as a `tel:` link. Decide deliberately: either the row renders without a call action, or it
    does not render at all. **Do not add a `phone` to `Shelter` to make the row work** — that
    field would have to be *filled*, and inventing it is the defect PH-18 exists to remove.
  - **Both local phone numbers are invented, and one belongs to an organisation that does not
    exist** — `shelters.ts:13` records Copper's Dream Rescue as *"from the product spec"*. A
    made-up number on the screen a foster opens in an emergency is worse than a made-up
    distance, and it is the same delete.

  Verify by rendering with a dog whose shelter is not Copper's Dream and reading the screen for
  anything still guessed. *(A line for the ledger, not a code change: `CLAUDE.md` lists
  "Emergency Mode (24h vet map)" as explicitly out of scope, and it shipped anyway. The scope
  note is stale.)* **Re-verified against `main` 2026-09-13 — a seventh consecutive run, and the
  first with no corrections at all**: PR #79 touched only `adoption.py`, `server.py`, `types.ts`
  and tests, so every citation above re-reads exactly. The habit is not free and has now paid
  three times; a run that finds nothing is the evidence that it is converging, not that it
  should stop.

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

- 2026-09-13 — PH-21 `[large]` — PR #81 — **The one paragraph a model wrote is now readable by
  the two people who could correct it, attributed everywhere it appears, and retractable.**
  Four parts, all shipped. `ProfileAttribution` + `lib/adoptionSource.ts` is **one line and one
  class** for all three surfaces (`.profile-attrib`, withdrawn as a data attribute) — the shape
  `design-consistency.md` asked for when it saw three views each about to write their own.
  `AdoptionProfileBody` gains a **"The assistant's write-up"** section above the foster's note,
  which lands parts 1 and 2 in one place: both the foster's page and the shared adoption link
  render that body, so the paragraph is not printed twice on the same screen. **That is the one
  deliberate departure from the spec**, which asked for a card in `PostFosterView` as well; what
  the banner at `:70-74` became instead is the disagreement the spec correctly insisted the
  screen must be able to render — `readyForAdoption` lives on `fosters/{uid}` and the text on
  `dogs/{id}`, so with a profile the banner points down the page at the words themselves, and
  without one it says the shelter sees the same blank. `withdraw_adoption_profile` **writes
  rather than clears** and leaves `status` untouched: since RS-12 the write *is* the
  notification, so a blank field would leave a **Back from foster** card with nothing in it —
  the arrival surviving while its content vanished. `Dog.adoption_profile_source` widens to
  `"agent" | "foster_withdrawn"`, and the third state — **absent** — needed a line the spec had
  not named: "Source not recorded", because guessing "the foster" for a pre-field record is the
  same invention the tense test rules out. `server.py`'s prompt gains the correct-or-withdraw
  branch and the instruction never to tell a foster it was taken down. Tests: 4 backend cases
  (`test_adoption.py` 12 → 16), 3 for `attributionFor`, 2 rendered roster cases (115 → 120).
  Build, test, lint (8 warnings, all pre-existing — the pure half moved to `lib/` rather than
  trip `only-export-components`) and pytest all green. **Not verified live**, as the spec said
  to say plainly: producing a `ready_for_adoption` dog at all needs a completed journey on a
  signed-in account.

- 2026-09-12 — PH-20 `[large]` — PR #79 — **The one paragraph this app keeps because a model
  wrote it now has to name what nobody recorded.** `generate_adoption_profile` returns a seventh
  key, `missing`, each entry a *sentence about what did not happen* rather than a field name;
  `PAWTHWAY_SYSTEM` loses the word **"specific"** and gains the pickup paragraph's content
  guardrail; `send_adoption_profile_to_shelter` writes `adoption_profile_source: "agent"`. **The
  harness needed building before the tests could be written**, which the spec had not costed —
  `conftest.py` had no `update()` and no `order_by().stream()`, which is why this module had no
  tests at all. The fake's `update()` **raises on a missing document**, or a test would pass
  against a dog nobody seeded. Not verifiable live by an unattended run.

- 2026-09-11 — PH-19 `[large]` — PR #77 — **The Care Plan brief stops asserting things nobody
  recorded, and stops calling training notes medical.** `medicalFlags` → `careNeeds`,
  `weightLbs: number | null`, and the clauses drop when the values are absent. **Omitting the
  sentence was necessary and not sufficient** — the brief's closing instruction makes silence
  read as "nothing there" — so `sayWhatIsMissing()` states each gap *as* a gap, the only form
  both true and useful to a reader who cannot go and check. **One false claim found in the code
  rather than the spec**: `CarePlanView.tsx:45`'s comment justified `?? 0` as rendering in a
  header that does not exist; both real readers printed the zero as a fact. 9 new tests.

*(Both rows above are one-paragraph compressions. The full text — PH-20's account of the
harness and PH-19's of the offline-fallback copy it also removed — is verbatim in
[`archive/production-hardening-ledger-2026-09-14.md`](archive/production-hardening-ledger-2026-09-14.md).)*

- 2026-09-10 — PH-17 `[large]` — PR #75 — **A demo dog's past no longer reaches a real
  foster's document, or the adoption page.** `data.ts` splits by the tense test; the seed moves
  to `data.demo.ts` behind `LOCAL_MODE`. **All four write paths were gone, not the two the spec
  named** — the first note a foster wrote had been saving the whole invented past underneath it.
  Two things the spec had wrong, both expensive: `adoption` had no tests to add cases to, and
  `medical` needed a *source designed* rather than chosen, so it is now built from ticked
  schedule rows and `vet_visit` entries, `null` when empty, with **allergies not rendering at
  all** ("None reported" is a clean bill of health nobody gave). Full 28-line row verbatim in
  the [2026-09-11 ledger archive](archive/production-hardening-ledger-2026-09-11.md).

*(Sixteen rows for **PH-1 … PH-16** stood here, each already a one-line compression of a
longer row archived elsewhere. On 2026-09-12 they moved to
[`archive/production-hardening-ledger-2026-09-12.md`](archive/production-hardening-ledger-2026-09-12.md),
which names for each of them where the uncompressed text lives. A compression of a compression
is the cheapest thing in a doc at its ceiling to cut, because nothing is lost that was not
already two hops away — this is the README's "the Ledger is the first place to look" rule
reaching the end of what it can give on this doc.)*
