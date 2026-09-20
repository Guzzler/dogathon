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

## The tense test, and the five faces it has been asked in — archived 2026-09-19

One rule, asked five times, all five shipped. What stood here was five statements wrapped in five
preambles and five pointers into other archives — the README's "cut the layer that points at a
layer" applied to a section rather than to the Ledger. The statements are kept verbatim below
because PH-25 depends on the fifth and reuses the method behind the fourth; everything that
surrounded them, including *"a retraction is a write"* and the fifth face's two generalisations, is in
[`archive/production-hardening-tensetest-faces-2026-09-19.md`](archive/production-hardening-tensetest-faces-2026-09-19.md).
Read that before reusing any of them.

1. **The test itself (PH-17, what a page may print).** *Could this value be wrong about a specific
   animal? Then it is a record, and it may only come from the foster, the shelter's document, or
   nothing at all.* Advice survives; a milestone, a weight, a tick, a photograph, `emergencyContacts`
   do not.
2. **Input (PH-19, what a model may be told).** *A page can render an absence; a prompt that
   enumerates a field cannot stay silent about it.* **"No medical flags." is not the prompt
   equivalent of "Not recorded."** — the equivalent is omitting the sentence, which is necessary and
   not sufficient, because a closing instruction makes silence read as "nothing there".
3. **Persistence (PH-20, what a model may assert).** This app keeps exactly one thing a model wrote,
   and since RS-12 that write *is* the notification. With it the routing rule that found it: **when a
   fix teaches one reader of a dataset to handle absence, check every other reader of the same
   dataset before calling it shipped.**
4. **Audience (PH-21, who is shown the assertion).** The assertion reached only the party who cannot
   verify it, never the two who can. Method: **measure every reader and every writer of a field,
   traced to the surface it renders on.**
5. **Input controls (PH-24, what a form may record).** *A default a control renders is a fallback;
   the same default persisted is an answer. A form may only write a field the person actually
   supplied; where it cannot tell, it must omit — not annotate.* Two riders: **prefer absence to
   annotation wherever the schema already carries it**, and **a defensive default that cannot
   execute is evidence the value it defends against is being manufactured upstream**.

**One stale fact in `CLAUDE.md`, still stale, recorded here because that file is not this loop's to
edit.** It says the cheap-model path is off — *"`web/src/api.ts` doesn't send it yet"*. It is on
(`api.ts:98`/`:109`, `server.py:432`), and Match pickup coordination is answered by Haiku today. A
second joins it: "The adoption page" says *"Nothing on this page is invented"*, which is true of
`buildAdoptionProfile` and silent about the agent-written paragraph. Both are a sentence to Sharang,
not a doc edit.

## Task queue

**The routing that put truthfulness items in the third-ranked doc still holds, and it is worth
restating once rather than re-narrated each run.** The 2026-08-31 re-rank exists to stop this
doc's small, tidy, headlessly-verifiable items consuming every execute run while the shelter
surface waits — and it does not cover PH-17 through PH-25. Those are not scaffolding;
they are the product asserting things about a real animal that nobody observed, which is the
class of defect this doc was founded on (PH-1). They sit here because this doc owns
truthfulness, not because production-hardening has been re-ranked.

- **PH-24 `[large]` — shipped 2026-09-18 (PR #91); the Ledger row is the full account.** The
  queue spec and the design section that argued it are archived verbatim in
  [`archive/production-hardening-ph24-2026-09-18.md`](archive/production-hardening-ph24-2026-09-18.md).
  The spec's five-site census survived re-verification against `main` intact — the first run in
  nine that re-verified and found nothing wrong, which is itself worth recording — and the one
  judgment call it left to execute (the onboarding summary screen) is answered in the row.

- **PH-25 `[large]` — shipped 2026-09-19 (PR #__); the Ledger row is the full account.** The
  queue spec (its three-symptom census and the `intake`-is-the-only-partial-map scope) and the
  design section that argued it are archived verbatim in
  [`archive/production-hardening-ph25-2026-09-19.md`](archive/production-hardening-ph25-2026-09-19.md).
  All three symptoms were re-read against `main` before the fix and all three were as described;
  two of them needed no code at all once the third was fixed, which the row explains.

- **PH-23 `[large]` — shipped 2026-09-17 (PR #89); the Ledger row is the full account**, including
  both things the spec had not named. The request/confirm round trip is still unbuilt.

**2026-09-15 / 09-16 — PH-22 then PH-18 shipped the day each was queued, emptying this queue
entirely, and PH-18's two parting leads are both closed** (PR #85's own diff, and PR #86). The
run-by-run narration is verbatim in
[`archive/production-hardening-queuenarration-2026-09-17.md`](archive/production-hardening-queuenarration-2026-09-17.md);
the README's fallback chain tells the same story once, which is why it is not told twice here.

### What omitting a key means at the write layer (2026-09-19, shipped the same day)

One rule, and it is the only part of PH-25's design section that is not now restated by the code
it produced — the census, the three symptoms and the two-backend argument are in
[`archive/production-hardening-ph25-2026-09-19.md`](archive/production-hardening-ph25-2026-09-19.md):

> **Omission at the form is only honest if omission at the write layer deletes.** A form that
> carefully declines to answer a question, over a backend that treats declining as "keep the old
> answer", has recorded the old answer as a new one — which is exactly the claim PH-24 removed,
> arriving one layer down and a day later.

`patchFoster()` now satisfies it for every key (`mergeFields`, not `{ merge: true }`), so a new
write path gets this for free; what it does **not** cover is a write that goes around that helper.
`auth.ts:73`'s guest→account copy is a whole-document `setDoc` and unaffected; the agent's
`save_intake` is Python, still defaults its six strings to `""`, and is the same question in a
different language.

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

- **A lead this run found and declined to take, per the atomic-PR rule.**
  `DiscoveryView`'s filter sheet writes `pref_size` alone (`DiscoveryView.tsx:127`), never the
  `size_preference` *word* beside it, so moving the filter slider leaves the two halves of one
  answer disagreeing — the Hub card prints "Large" from the questionnaire while `scoreDog()` ranks
  on the 20 the sheet wrote. This predates PH-25 and is untouched by it (the sheet already spread
  the whole map, so replace and merge agree there). It is a *pair of fields for one answer*, which
  is a different defect from either PH-24 or PH-25, and the cheapest reading is that the word
  should be derived at render rather than stored twice.

### Needs a human — PARKED, not pending; archived 2026-09-11

Three items, all parked, none discharged, each wanting a signed-in human this loop cannot be:
**PH-25b** (2026-09-19 — sign in on the deployed app, answer the questionnaire with both
sliders moved, then "Change answers" and answer it with neither: expect **Unrecorded** chips for
Size and Energy on the Hub card, not the first pass's words. Two minutes, and it is the only way to
see the `mergeFields` branch against real Firestore), **PH-15b** (run PH-15's redaction write
against the deployed project — four writes, one session), **PH-13** (lift `--max-instances` to 2 and confirm the two things only a person
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

- 2026-09-19 — PH-25 `[large]` — PR #__ — **a retake of the questionnaire no longer keeps the
  answers the foster took back.** `patchFoster()` writes
  `setDoc(..., { mergeFields: keys.map(k => new FieldPath(k)) })` instead of `{ merge: true }`:
  every key in the patch is now replaced whole, and keys the patch never mentions are untouched.
  That is one line of behaviour and it fixes all three symptoms the spec listed, two of them
  without being touched:
  - **The fix is at the helper, and the two call sites are now correct as already written.**
    `HubView.reset()`'s `patchFoster({ intake: {} })` was a **no-op** under nested merge — "Change
    answers" cleared the phase, the swipes and the match and left every answer in place, with a
    comment saying the opposite. It is now a real clear, so only the comment changed.
    `DiscoveryView`'s "Retake the questionnaire" clears nothing and did not need to: `finish()`
    writes a full `intake` over the old one. The spec said to check that before changing the line;
    checked, and the line stands.
  - **`mergeFields` over `updateDoc`, and a `FieldPath` per key.** `updateDoc` would also replace a
    map, but it fails on a document that does not exist — and `fosters/{uid}` does not exist for a
    foster whose first write is onboarding. `mergeFields` still creates it. The keys are wrapped in
    `new FieldPath(k)` because `mergeFields` parses a bare string as a **dotted path**; the test's
    fake throws on a string rather than accepting one, so that stays true.
  - **Replacing every key, not just `intake`, and why that is not wider than the item.** The spec's
    census held: `intake` is the only nested map written partially, `pickup` is written whole or
    `null`, `adoptionHighlights` writes all three keys every time, everything else is a scalar or
    an array, and arrays were already replaced. So "replace the listed keys" and "merge the listed
    keys" differ on exactly one key today — and the uniform rule is the one that makes
    `writeLocalFoster()`'s shallow spread and Firestore the *same function*, which is the
    acceptance bar the design section set. A no-key patch now returns before either branch, so the
    two layers agree on the empty patch too.
  - **The tests are an outcome, not a call shape, and the guest half is real.** 13 new tests in
    `web/src/hooks/useFoster.test.ts` drive **one fixture** — a first pass with both sliders moved,
    then PH-24's retake with neither — through **both layers** and assert the stored `intake` equals
    the second pass exactly. The Firestore half is a fake that models both `SetOptions` (deep merge
    vs. replace-listed); the guest half is the real `localMode` code over a `localStorage` shim.
    The first test asserts the **old** semantics directly, so the suite is known to be able to see
    the defect — and it can: reverting the one line turns **5 of the 13 red and leaves 8 green**,
    and the 8 are precisely the guest cases plus that model, which is the spec's claim that
    LOCAL_MODE was already right, observed rather than reasoned about.
  - **The `time_availability` backfill question, answered as the spec asked.** There is no
    migration and none is needed: a true replacement takes a pre-PH-24 `time_availability` with it
    on the foster's next retake, and a test asserts exactly that on both layers. A foster who never
    retakes keeps it, and `get_foster()` will keep reading it — which is a **stale** claim rather
    than an invented one, so it is left rather than rewritten.
  - **What is *not* verified**: nothing was driven against real Firestore. The changed branch is the
    signed-in one, so observing it needs a Google sign-in and two passes through onboarding on the
    deployed app — parked under "Needs a human" as **PH-25b** rather than queued. The merge
    semantics are modelled from Firestore's documented behaviour; per the README's rule, what this
    was measured against is part of the claim.

- 2026-09-18 — PH-24 `[large]` — PR #91 — **onboarding stopped recording answers nobody gave.**
  `OnboardingView` tracks whether each slider was moved and omits `pref_size`/`size_preference`
  and `pref_energy`/`energy_preference` when it was not; `time_availability` is gone entirely,
  because it was derived from the energy slider and the questionnaire has never asked how much
  of the day anyone is home. A foster who taps Continue twice no longer has "Medium", "A daily
  walk, then settle" and "A little (WFH some days)" in Firestore as things they said — and the
  third of those was reaching the agent through `get_foster()`. Four things the build
  established that the spec did not name:
  - **The spec's five-site census was right, and that is the first time in nine runs of
    re-verification that it was.** Eight consecutive runs had paid for the habit by finding a
    census short. This one did not, which is the argument for keeping the habit rather than
    against it: the cost of checking is one read per site.
  - **The fix needed a *third* flag per field, not a second.** `scoreDog` and `matchReasons`
    each had one `knownSize`/`knownEnergy` meaning "the dog's half was recorded" (PH-22), and
    the obvious move — AND the foster's half into it — was wrong for six of the eleven rules
    that read it. "Too big for an apartment" and "an easy first foster" compare the dog against
    the **home** or the **experience level**; an untouched size slider says nothing about either,
    and folding it in would have silenced sentences the foster had genuinely earned. So the two
    comparison terms and the two size/pace sentences take both halves, and everything else keeps
    `dogSize`/`dogEnergy`. **A guard added one layer up is not automatically the same guard.**
  - **The summary screen's judgment call went to omission, not `Unrecorded`.** It is headed
    "Based on your answers" and renders a chip *list*, not labelled rows — there is no slot to
    leave empty, and showing "Medium" back one tap before writing it is precisely how a resting
    position becomes a decision. `Unrecorded` is four-for-four elsewhere and is what the Hub's
    labelled card uses, which is the distinction: **a list omits, a labelled row renders the
    absence.**
  - **Discovery's filter sheet needed new copy, not a deleted sentence.** "Straight from your
    questionnaire" is false over an untouched slider, but the sliders there *write on change*, so
    the honest alternative can say what the control does: "Anything you didn't answer starts in
    the middle — moving it here records it."

  Verified: 153 tests (149 + 4 new in `matching.test.ts`), `tsc --noEmit` clean, `npm run build`
  green, `npm run lint` at the same 8 warnings as `main`. Backend untouched — `foster.py`'s
  `save_intake` still defaults its six strings to `""`, which is a different shape of the same
  question and is **not** fixed here. The retake path is the note left above for `dogathon-plan`.

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
