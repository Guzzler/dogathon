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
surface waits — and it does not cover PH-17, PH-19, PH-20, PH-21, PH-22, PH-18 or PH-23. Those are not scaffolding;
they are the product asserting things about a real animal that nobody observed, which is the
class of defect this doc was founded on (PH-1). They sit here because this doc owns
truthfulness, not because production-hardening has been re-ranked.

- **PH-23 `[large]` — the pickup handoff stops speaking for the shelter.** *(Queued 2026-09-17.)*
  Four of the five phases have been measured against the tense test; **Match never had been**.
  Measuring it found the defect in its most direct form yet — the app states a specific real
  organisation's opening days, appointment times, notice period, paperwork duration and what to
  bring, in that organisation's own first-person voice, and nobody recorded any of it.

  **The census — six claims in three files.** Written out rather than summarised, because a wrong
  census is what re-verification has caught on PH-17, PH-18 and PH-22:
  1. `web/src/components/PickupScheduler.tsx:9` — `CLOSED_DAYS = new Set([0, 1])` disables every
     Sunday and Monday, and the comment at `:8` states the source outright: *"Shelters in this
     world are closed Sun/Mon -- gives the calendar real gaps to show off."*
  2. `:114` — printed to the foster as **"Closed Sundays & Mondays"**, under a card headed "Pickup
     happens at {shelter.name}" with that shelter's real street address at `:70`.
  3. `:6` — `TIME_SLOTS`, six specific appointment times (9:00 AM … 4:30 PM) nobody published.
  4. `:10` — `LEAD_DAYS = 2`, printed at `:114` as "earliest pickup is 2 days out", commented
     *"shelters need a couple days' notice after approval"*.
  5. `web/src/lib/calendar.ts:61` — the `.ics` DESCRIPTION: *"Bring a carrier or leash and collar,
     a towel, and proof of address. Allow about 30 minutes for paperwork."* This one **leaves the
     app** — it is downloaded into the foster's real calendar and survives anything corrected later.
  6. `src/agent/server.py:79-83` — the system prompt **instructs the model to assert** the same two:
     "what to bring (carrier or leash and collar, a towel, proof of address), how long the handoff
     takes (about 30 minutes of paperwork and a walkthrough)".

  **What makes this one item rather than six.** The prompt already carries its own correction and
  withholds it from exactly these facts: two sentences later, `server.py:83-85` says *"You don't
  have real parking maps or staff rosters -- speak generally rather than inventing specifics."* The
  rule was known, written down, and applied only to the facts nobody had got around to inventing.
  And `:76-78` tells the model the foster *"sees this chat as talking to their shelter's foster
  coordinator, so answer in that voice"* — so an invented pickup requirement arrives wearing the
  shelter's authority. That is PH-21's audience axis with the borrowing running the other way.

  **The design answer, and the constraint that forces it.** The obvious fix — have the shelter
  publish its hours, since M3 built the shelter side — **is blocked by `firestore.rules` as
  written**, checked rather than assumed: `match /shelters/{shelterId}` (`:86-89`) is `read: if
  request.auth.uid in resource.data.staffUids` and `write: if false`. A foster cannot read that
  document at all, staff cannot write it, and widening the read would hand every foster their
  shelter's `staffUids` list. So:

  > **No shelter has ever had a channel through which to tell this app any of it, so the fix is to
  > stop saying it — and the replacement is the channel that already exists.** The honest form of
  > all four logistics facts is the agent chat at `MatchView.tsx:188-195`, whose subtitle already
  > reads *"Parking, what to bring, how long it takes"* and whose prompt already knows to speak
  > generally. The app's job is to route the question there, not to pre-answer it.

  **Scope.**
  - `PickupScheduler.tsx`: delete `CLOSED_DAYS` and the "Closed Sundays & Mondays" clause. Keep
    `LEAD_DAYS`/`WINDOW_DAYS` as the **app's** booking window and say so in the copy — never
    "shelters need". `TIME_SLOTS` stays as a chooser (a foster must name a time) but the screen
    stops implying availability: the confirm verb becomes **Request**, not **Schedule** — PH-18's
    finding that a delete needs a replacement, not just a guard.
  - `MatchView.tsx`: the confirmed-pickup card at `:147-185` and `STAGES`' fourth stage read as a
    booking; label them requested-not-confirmed. **`activeIdx` at `:65` advances to "Pickup" on the
    foster's own tap** — the timeline is treating the foster's intent as the shelter's answer.
  - `calendar.ts`: cut the bring-list and the "30 minutes" sentence from `:61`. **Keep
    `durationMinutes ?? 45` at `:47`** — the 2026-09-14 rule directly below: an `.ics` needs a
    `DTEND`, so 45 minutes is geometry, while "about 30 minutes for paperwork" is a claim. The two
    disagreeing today is itself the tell.
  - `server.py`: cut the two enumerations from `:79-83`, keep the "speak generally" instruction, and
    leave the `get_dog`/`get_foster` grounding as it is.

  **Verification.** `cd web && npm run build && npm test && ./node_modules/.bin/tsc --noEmit` (not
  `npx tsc` — see "Six settled things"), plus `uv run pytest`. Add rendered cases in
  `MatchView.test.tsx`'s existing `renderToStaticMarkup` style asserting "Closed Sundays" is absent,
  and `pickupIcs` cases asserting the description carries no bring-list and no duration claim while
  `DTEND` still lands 45 minutes after `DTSTART`. A dev server cannot be started from an unattended
  run: say plainly what was rendered versus reasoned about.

  **Out of scope, named so it is not half-done: the request/confirm round trip.** Making the slot
  genuinely confirmed means the shelter answering it, and the shape is proven already by RS-10/RS-11
  (one writer per field, each side composes). Its cost is a **new foster branch on `applications`'s
  `update` rule**: today `firestore.rules:74-81` permits the foster exactly one write — `status:
  "withdrawn"` with `fosterId`/`shelterId`/`dogId`/`createdAt`/`checklist` all pinned — and the
  `!! fosterName` warning at `:68-73` must be read before touching it. That is its own item.
  **PH-23 must not widen a rule.**

**2026-09-15 / 09-16 — PH-22 then PH-18 shipped the day each was queued, emptying this queue
entirely, and PH-18's two parting leads are both closed** (the "Triage guide" `<button>` was
already gone in PR #85's own diff, so that row's "neither taken" is wrong about its own PR — left
as written per the ledger convention; the dead `@keyframes cp-pulse-dot` went in PR #86). The
run-by-run narration of how the `[large]` slot was found and emptied over those two runs is
verbatim in
[`archive/production-hardening-queuenarration-2026-09-17.md`](archive/production-hardening-queuenarration-2026-09-17.md);
the README's fallback chain tells the same story once, which is why it is not told twice here.

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

- **Every PH item through PH-22 is shipped** (PRs #47, #48, #49, #75, #77, #79, #81, #83), and
  **PH-18 `[large]` shipped 2026-09-15** (PR #85, with #86 as its follow-up). Each Ledger row below
  is the full account and each spec is archived verbatim —
  [PH-22's](archive/production-hardening-ph22-2026-09-14.md),
  [PH-18's](archive/production-hardening-ph18-2026-09-15.md) (nine runs of re-verification on it;
  read it before adding any local row back to `emergencyContacts`), and the rest named in the
  [2026-09-12 ledger archive](archive/production-hardening-ledger-2026-09-12.md). Three things they
  carried that the rows do not: PH-15's live rules check is **PH-15b under "Needs a human"**, so
  don't read PH-15 as verified end to end; the habit of re-verifying a spec against `main` before
  building is now **nine runs old**, and it found nothing wrong on PH-19, PH-20 or PH-21 and
  something materially wrong on PH-17, on PH-22's read-site census, and on PH-18 three times; and
  the design section directly above stays in this doc because it holds the rule rather than the
  build instructions.

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

- 2026-09-15 — PH-18 `[large]` — PR #85 — **The emergency screen no longer tells a foster
  anything nobody recorded, and the two rows it was meant to keep now render where they were
  always meant to.** Deleted: a 120-line hand-drawn SVG of Presidio Park, the Bay, a blue route
  and a "1.2 mi · 4 min" chip whose travel time nobody computed; the "VCA SF Veterinary
  Specialists · 1.2 mi · Open now" row; and "Copper's Dream Rescue · Foster coordinator ·
  (415) 554-3030" — an invented number for an organisation that does not exist, on the screen
  someone opens in an emergency. `emergencyContacts` is now the two published national poison
  lines and nothing else.

  **Three things the build turned up that the spec had only half of.** (1) The spec's central
  correction held exactly: stripping the vet row alone would have promoted Pet Poison Helpline
  into a card headed "Nearest 24-hour vet" under a *Call Vet Now* button, because `nearest` was
  `find(c => c.distanceMi != null) ?? contacts[0]`. The card is now conditional on
  `kind === "vet"` and there is no such row, so it renders an honest "No 24-hour vet on file"
  instead — which means **the delete needed a replacement, not just a guard**: a screen with a
  hole where the vet was is its own kind of wrong answer. (2) `EmergencyContact` gains
  `kind: "vet" | "poison" | "shelter"`, per the spec's "fix the field, not the regex". Both
  poison lines now render as quick actions rather than one, because a category is a filter and a
  substring test was a `find`. (3) The coordinator row resolves the way the spec's second
  correction demanded and no other way: **no call action at all.** `DogProfile` gains
  `shelter?: {name, address}` from the dog's own record, so "Who else to tell" names the real
  shelter with its real address and offers no `tel:`. No `phone` was added to `Shelter`; that
  field would have had to be filled.

  Verified by `Emergency.test.tsx` (13 assertions, `renderToStaticMarkup` like
  `ShelterRosterView.test.tsx`), which locks both invisible halves: that no contact is promoted
  into the vet card, and that both poison lines reach the quick-action row rather than "Other
  contacts". A dev server could not be started from this unattended run, so the screen was
  verified as rendered markup rather than in a browser — the tests assert the exact strings a
  foster reads, including the absence of "Presidio Park", "<svg" and "4 min".

  **Two leads, neither taken.** `@keyframes cp-pulse-dot` in `carePlan.css:780` is referenced by
  nothing in `web/src` — dead when the map went, possibly dead before. And the "What to do now ·
  Triage guide" button at the bottom of the quick-action row is a `<button>` with no `onClick`:
  it has never done anything, which is a different defect from claiming something false, and
  outside this seam. *(Also, for Sharang rather than a doc edit: `CLAUDE.md` still lists
  "Emergency Mode (24h vet map)" as explicitly out of scope, and the map shipped anyway —
  though as of this PR the out-of-scope line is true again.)*

- 2026-09-14 — PH-22 `[large]` — PR #83 — **`normalizeDog()` still fills the three holes a card's
  layout needs, but it now writes down that it had to, and nine surfaces stopped printing the
  filling as the shelter's answer.** `RichDog` gains `derived: {fosterWeeks, size, energyLevel}`,
  resolved to `null` first and defaulted second, so "did anyone record this?" survives the
  defaulting. Rendering goes through **one** component (`components/Unrecorded.tsx` + one class) —
  the shape `design-consistency.md` asked for — while `matchReasons()` says *nothing* rather than
  "Not recorded": a slot promised a value gets the component, a sentence never owed gets silence.
  The sharp half: `foster_weeks` is absent on **all 19** roster dogs, so every countdown this app
  has ever shown a foster was arithmetic from a constant. In scoring, `compat()`'s three-way moved
  one layer earlier (unknown size `0`, unknown energy `-4`), and the case that makes it concrete is
  a dog named "Border collie" with no `energy_level` that `guessEnergy()` scored 4 and which then
  paid both the apartment and the first-timer penalty on the strength of its name.
  **Re-verifying the spec against `main` paid for an eighth consecutive run, this time on the
  census**: it named seven read sites and there were nine — the miss being `AdoptionProfile.tsx:48`,
  the shared adoption link, the one surface a stranger reads when deciding about a real animal.
  Two **stated contracts that were false** are corrected in place (`shelterDog.ts`'s and
  `types.ts`'s claim that `normalizeDog()` "already knows how to render" an absent key), as is
  `matching.ts:50`'s citation of a `score >= 45` cutoff in `DiscoveryView` that **has never
  existed**. Tests 120 → **132**, all green, plus build and lint. **Not verified live, and this one
  could have been** — every affected function is pure and covered, but that `.unrecorded` reads
  correctly on Discovery's dark photo overlay is reasoned about, not observed. One standing lead:
  `ageLabel`'s one-month floor, in two places (`dog.ts:66`, `DogProfile.ageMonths`).

- 2026-09-13 — PH-21 `[large]` — PR #81 — **The one paragraph a model wrote is now readable by the
  two people who could correct it, attributed everywhere it appears, and retractable.**
  `ProfileAttribution` + `lib/adoptionSource.ts` is **one line and one class** across all three
  surfaces. The **one deliberate departure from the spec**: instead of a second card in
  `PostFosterView`, the paragraph lands once in `AdoptionProfileBody` — both the foster's page and
  the shared link render that body, so it is not printed twice on one screen, and the banner became
  the disagreement the spec insisted the screen must be able to render (`readyForAdoption` lives on
  `fosters/{uid}`, the text on `dogs/{id}`). `withdraw_adoption_profile` **writes rather than
  clears** and leaves `status` untouched: since RS-12 the write *is* the notification, so a blank
  field would leave a **Back from foster** card with nothing in it. The third state — the field
  simply **absent** — needed a line the spec had not named: "Source not recorded", because guessing
  "the foster" for a pre-field record is the same invention the tense test rules out. Tests 115 →
  120 plus 4 backend cases; all green. **Not verified live**: producing a `ready_for_adoption` dog
  needs a completed journey on a signed-in account.

*(Both rows are compressions. Full text verbatim in
[`archive/production-hardening-ledger-2026-09-17.md`](archive/production-hardening-ledger-2026-09-17.md).)*

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
