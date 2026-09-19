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

*(A **fifth** — what an input *control* may record — was added 2026-09-18 and sits below the
queue, because it is a design answer PH-24 still depends on. All four here watch a value leaving
the app; it watches one arriving, and is the first about the **foster** rather than a dog.)*

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

- **PH-24 `[large]` — the questionnaire records two answers the foster may never have given, and
  a third to a question it never asked.** Queued 2026-09-18. Measured this run by asking which of
  the five phases had never been put through the tense test: Discovery (PH-22), Care Plan (PH-18,
  PH-19), Post Foster (PH-20, PH-21) and Match (PH-23) all had. **Onboarding had not**, and it is
  the one surface that *writes* rather than renders.

  **The root, and it is three lines.** `OnboardingView.tsx:45-46` opens the size slider at `50`
  and the energy slider at `2`. `:53`'s `canNext = [!!experience, true, true, !!home, true, true]`
  makes steps 1 and 2 — the two sliders — advanceable **without being touched**, while the two
  pill questions (experience, home) are correctly required and the tag step is honestly optional
  (`[]` really is "none selected"). `finish()` at `:73-74` then writes `pref_size: sizePref` and
  `pref_energy: energyPref` **unconditionally**. A foster who tapped Continue twice has "Medium"
  and "A daily walk, then settle" in Firestore as answers.

  **And `:69` is worse, because the question does not exist.** `time_availability` is derived
  from the energy slider — `energyPref >= 3 ? "A lot (home most of the day)" : "A little (WFH some
  days)"`. Onboarding never asks about time. `get_foster()` (`foster.py:65-77`) returns the whole
  document, so **the agent is told how much of the day a foster is home** on the strength of a
  slider they may not have moved, answering a question nobody put to them. `size_preference` and
  `energy_preference` at `:70-71` are the same defaults in a second shape.

  **The five read sites, enumerated — this is the census, and per eight runs of precedent, verify
  it against `main` before building:**
  1. `HubView.tsx:137-138` — the "What you're looking for" card prints the size bucket and
     `${ENERGY_WORD[p.energy]} energy` as chips under a heading that says these are the foster's
     answers. A **labelled row**, so the 2026-09-14 rule applies at full strength.
  2. `matching.ts:93` — `"exactly the pace you picked"`, and `:91` `"right in your size range"`.
     PH-22 guarded both on `knownSize`/`knownEnergy`, which are properties of the **dog**; the
     `p.size`/`p.energy` half was never guarded. This is the "second reader" rule from PH-20
     arriving from the other side of the same comparison.
  3. `matching.ts:39-40` — `scoreDog`'s two largest terms. Ranking, not an answer, so per the
     2026-09-14 rule the number needs no absent state — but `UNKNOWN_SIZE`/`UNKNOWN_ENERGY`
     (`:30-31`) exist for exactly this and currently only fire on the dog side.
  4. `DiscoveryView.tsx:142-146` — the filter sheet's sliders, under the sentence **"Straight from
     your questionnaire."** The sliders themselves are controls and stay where they are (geometry);
     the sentence is the claim.
  5. `OnboardingView.tsx:199-201` — the summary screen's own chips, which show "Medium" back to a
     foster as something they said, one tap before it is written.

  **What to build.** Track whether each slider was moved (two booleans in `OnboardingView`'s
  existing `useState` block is enough — the sliders keep their resting positions and nothing about
  how the step looks or feels changes), and **omit** `pref_size` / `pref_energy` / `size_preference`
  / `energy_preference` from the written `intake` when they were not. **Omit `time_availability`
  entirely, always** — it answers an unasked question and no amount of touch-tracking makes it
  true; adding a sixth step to ask it is out of scope and its own item. Then branch the five sites
  on the field's presence: `Unrecorded` for (1), the existing idiom and now four-for-four per
  `design-consistency.md`; **silence** for (2), per `matchReasons()`' own comment that a sentence
  never owed gets no `Unrecorded`; the existing `UNKNOWN_*` constants for (3); and for (4) a
  sentence that does not claim the questionnaire supplied an untouched slider. (5) is a judgment
  call for execute — showing the resting value back before writing it is arguably the moment it
  stops being untouched, and either answer is defensible if the row is written down.

  **Do not** make `FosterIntake`'s fields non-optional, do not add a `derived` bag (see the design
  section above for why this case is the opposite of PH-22's), and do not touch `firestore.rules` —
  nothing here changes who may write what.

  **Verification.** `npm test` (149 today; `matching.test.ts` has 12 cases and is where the
  `prefs()` half belongs), `npm run build`, `./node_modules/.bin/tsc --noEmit` — **not** `npx tsc`,
  which resolves to an unrelated `tsc@2.0.4` — and `npm run lint` diffed against `main` for the
  same 8 warnings. `uv run pytest` should be unchanged; if `foster.py` moves at all, say why. The
  case that proves it: an intake written by tapping Continue through both sliders has neither
  `pref_size` nor `time_availability` as keys, the Hub renders `Unrecorded` rather than "Medium",
  and `matchReasons()` returns no size or pace sentence.

- **PH-23 `[large]` — shipped 2026-09-17 (PR #89); the Ledger row is the full account**, including
  both things the spec had not named. The request/confirm round trip is still unbuilt.

**2026-09-15 / 09-16 — PH-22 then PH-18 shipped the day each was queued, emptying this queue
entirely, and PH-18's two parting leads are both closed** (PR #85's own diff, and PR #86). The
run-by-run narration is verbatim in
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

- **Every PH item through PH-23 is shipped** (PRs #47, #48, #49, #75, #77, #79, #81, #83, #85,
  #86, #89), each with a Ledger row that is the full account and a spec archived verbatim —
  [PH-22's](archive/production-hardening-ph22-2026-09-14.md),
  [PH-18's](archive/production-hardening-ph18-2026-09-15.md) (nine runs of re-verification; read
  it before adding any local row back to `emergencyContacts`), and the rest named in the
  [2026-09-12 ledger archive](archive/production-hardening-ledger-2026-09-12.md). One thing the
  rows do not carry: PH-15's live rules check is **PH-15b under "Needs a human"**, so don't read
  PH-15 as verified end to end.

### The fifth face: what an input *control* may record (2026-09-18)

The four faces above ask what a page may print, what a model may be told, what a model may
assert, and who is shown the assertion. All four watch a value **leaving** the app. This one
watches a value **arriving**, and it is the first that does not involve a dog at all — the
claim is about the **foster**.

> A control has to render somewhere. A slider has a thumb, a stepper has a number, a range
> input at rest sits where its `useState` put it. That resting position is geometry, exactly as
> `size: "medium"` is. **It becomes a claim at the moment it is written down** — because a
> stored `pref_size: 50` is indistinguishable from a foster who dragged the slider to the
> middle on purpose, and every reader downstream is entitled to read it as an answer.

So the rule, stated to be reusable against the next form somebody builds:

> **A default a control renders is a fallback; the same default persisted is an answer.** A form
> may only write a field the person actually supplied. Where it cannot tell, it must omit — not
> annotate.

**Why omit rather than annotate, when PH-22 annotated.** PH-22 could not omit: `RichDog.size`
and `RichDog.energyLevel` are non-null because layout genuinely needs them, so the only place
the provenance could live was a sibling `derived` set. `FosterIntake` has the opposite shape —
`pref_size`, `pref_energy` and all four siblings are **already optional** (`types.ts:149-153`),
`prefs()` **already** supplies `?? 50` / `?? 2` for ordering, and the agent's `save_intake`
already defaults each of the six strings to `""`. Absence is representable at every layer;
nothing is asking to be annotated. The generalisation worth keeping:

> **Prefer absence to annotation wherever the schema can already carry absence.** A `derived`
> bag is what you build when it cannot. Reaching for one first adds a parallel vocabulary to a
> field that was nullable all along.

**The consequence that makes this worth a run rather than a two-line patch.** `prefs()`'s
`?? 50` / `?? 2` has a comment calling it an intake default "so a foster who skipped onboarding
still gets sensible ordering" — and it can never fire for a foster who *finished* onboarding,
because `finish()` writes both fields unconditionally. The fallback the codebase believes it
has is dead code, and the defaults reach the render sites as recorded values instead. Fixing
the write is what turns the existing fallback back on; the render sites are then branching on a
field that is genuinely sometimes absent, for the first time.

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

- 2026-09-15 — PH-18 `[large]` — PR #85 — **the emergency screen stopped telling a foster things
  nobody recorded.** Gone: a hand-drawn SVG map of Presidio Park with a "1.2 mi · 4 min" chip
  nobody computed, a "nearest 24-hour vet" row, and an invented phone number for an organisation
  that does not exist — on the screen someone opens in an emergency. Three things the build
  established that outlive the row: **a delete needs a replacement, not just a guard** (stripping
  the vet row alone would have promoted a poison line into the card headed "Nearest 24-hour
  vet", because `nearest` was a `find` on `distanceMi != null`); **fix the field, not the regex**
  (`EmergencyContact` gained `kind`, because a category is a filter and a substring test was a
  `find`); and the honest resolution of a contact nobody can verify is **no call action at all**,
  not a plausible number. Full row verbatim in
  [`archive/production-hardening-ph18row-2026-09-18.md`](archive/production-hardening-ph18row-2026-09-18.md).

- **2026-09-13 — PH-21 — PR #81; 2026-09-14 — PH-22 `[large]` — PR #83. Compressed 2026-09-18;
  verbatim in [`archive/production-hardening-ledger-2026-09-18.md`](archive/production-hardening-ledger-2026-09-18.md).**
  PH-21 made the one paragraph a model wrote readable, attributed and retractable by the two
  people who could correct it — `ProfileAttribution` + `lib/adoptionSource.ts`, one line and one
  class across three surfaces, with `withdraw_adoption_profile` **writing rather than clearing**
  because since RS-12 the write *is* the notification. PH-22 made `normalizeDog()` write down
  that it had filled a hole: `RichDog.derived`, nine surfaces stopped printing the filling as the
  shelter's answer, and `foster_weeks` turned out absent on **all 19** roster dogs, so every
  countdown this app has shown a foster was arithmetic from a constant. Three things from those
  rows outlive them and are needed by PH-24 below: re-verifying a spec against `main` paid for an
  eighth consecutive run by finding PH-22's read-site census **two short**; two *stated contracts*
  were false in the same direction (`shelterDog.ts` and `types.ts` both claimed `normalizeDog()`
  "already knows how to render" an absent key); and one standing lead is still untaken —
  `ageLabel`'s one-month floor, in two places (`dog.ts:66`, `DogProfile.ageMonths`).

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
- 2026-09-17 — PH-23 `[large]` — PR #89 — **the pickup handoff stops speaking for the shelter.**
  All six claims in the census went, each with a replacement rather than a deletion (PH-18's rule):
  `CLOSED_DAYS` and "Closed Sundays & Mondays" are gone and the footnote says
  `Unrecorded`'s one phrasing — *"SF SPCA's opening days and times not recorded"* — followed by the
  booking window **in Pawthway's own voice** ("Pawthway takes requests from 2 days out to 28 days
  ahead"), never "shelters need"; `TIME_SLOTS` stays a chooser and the confirm verb is **Request**;
  `MatchView`'s card says *"You asked for this time. SF SPCA hasn't confirmed it"* with **Change
  request** replacing **Reschedule**; `calendar.ts`'s DESCRIPTION drops the bring-list and the
  "about 30 minutes" and says the slot is still a request, while `durationMinutes ?? 45` **stays**
  because a `DTEND` is geometry; `server.py` loses the two enumerations, keeps "speak generally",
  and gains an instruction never to confirm the slot on the shelter's behalf — the model was being
  told to answer in the shelter's first-person plural about a time no shelter had seen.
  **Two things the spec had not named.** The census was one short: the same sentence in `server.py`
  carried a *third* parenthetical, and leaving it while cutting its two neighbours would have
  reproduced the exact failure the item diagnosed. And `SavedView` drew the same timeline from a
  byte-identical duplicate of `STAGES`/`activeIdx`, so relabelling one screen would have made the
  two disagree — both now read `APPLICATION_STAGES` and `activeStage()` from `applicationView.ts`,
  which is the DC note about one class for one claim applied to a literal. Saved's badge and
  copy ("Approved — request a pickup", "ask them for a pickup time") and the Hub and Care Plan
  pointers into Match moved with it, because a screen that says "schedule pickup" and a screen that
  says "request" are the same disagreement one level out.
  **Verified**: `npm run build`, `npm test` (**149 passed**, 7 new — 4 rendered `MatchView` cases
  in the existing `renderToStaticMarkup` style, 3 `pickupIcs` cases), `./node_modules/.bin/tsc
  --noEmit`, `npm run lint` (8 warnings, the same 8 as `main` — diffed against a stash), and
  `uv run pytest` 55 passed. A dev server cannot be started from an unattended run: what is proven
  is the **markup and the strings**, not how the calendar feels to tap. **No rule was widened**, and
  the request/confirm round trip is still unbuilt and still its own item.
