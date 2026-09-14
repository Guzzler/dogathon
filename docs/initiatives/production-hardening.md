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

**4 — audience (PH-21, who is shown the assertion).** Open; the measurement and the design
answer are the section directly below.

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

### A retraction is a write, not an erasure — and nobody but the shelter can read the paragraph at all (2026-09-13)

PH-20 closed the question of what the model may assert and left one behind, recorded as an
unqueued lead: **`adoption_profile` cannot be retracted.** Measuring it — every reader and every
writer of that field, traced to the surface it renders on — found the lead was the smaller half
of the defect, and the larger half is the reason the smaller one is hard to notice:

- **The foster never sees what was sent.** `PostFosterView.tsx:70-74` renders *"{dog}'s adoption
  profile is with the shelter. Thank you for fostering!"* keyed on `foster.readyForAdoption`,
  and **nothing in that view renders `dog.adoption_profile`**. The text is available to it —
  `dogs` is `allow read: if true` (`firestore.rules:13`), `normalizeDog()` spreads `...d`, and
  `PostFosterView` already holds the matched dog — it is simply not shown. So the one person who
  can tell whether a sentence about this dog is true reads a banner saying a paragraph exists.
- **The adopter never sees it either.** `PublicAdoptionView` — the shared link, the surface the
  paragraph is *written for* — builds its body from `buildAdoptionProfile` and does not read
  `adoption_profile`. Grep confirms the field's only frontend reader anywhere is
  `ShelterRosterView.tsx:236-237`. A profile written for adopters reaches staff and stops.
- **`adoption_profile_source` is written and rendered nowhere.** PH-20 added it for exactly this
  purpose; its three occurrences are `adoption.py`, `types.ts` and a test.
- **Two documents carry one claim and can disagree.** The banner reads
  `fosters/{uid}.readyForAdoption`; the paragraph lives on `dogs/{id}`. One tool writes both, so
  they agree today — but the banner asserts the paragraph's existence without consulting it.

The design answer, which is what makes this a surface rather than a delete button:

> **A retraction is a write.** Clearing the field is the wrong primitive, because RS-12 made the
> write *be* the notification: erasing it leaves the dog in `ready_for_adoption` with a **Back
> from foster** card and nothing in it — the arrival survives and its content vanishes, which is
> a worse state for the person deciding than either the paragraph or no card. So a withdrawn
> profile must carry a sentence saying it was withdrawn by the foster, and
> `adoption_profile_source` must stop saying `"agent"`.

Two consequences worth stating rather than re-deriving:

1. **Replacement is already built; visibility is not.** `send_adoption_profile_to_shelter`
   overwrites unconditionally, so "the agent rewrites it and re-sends" works today. It is
   unreachable in practice because the foster cannot read what would be replaced. That reorders
   PH-21: the expensive half is the read path, not a new write path.
2. **The write goes through the agent, and `firestore.rules` does not move.** A foster cannot
   write `dogs` (RS-6 scoped `update` to `isStaff`), and widening that to let a foster edit a
   dog document would hand every foster their shelter's roster. The Admin SDK made the
   paragraph; the same path un-says it, gated by the existing approval modal like every other
   dangerous tool. This is the README's standing "don't fix it by loosening `firestore.rules`"
   arriving at a third site.
Correcting `CLAUDE.md` is Sharang's, not this loop's.

## Task queue

**The routing that put truthfulness items in the third-ranked doc still holds, and it is worth
restating once rather than re-narrated each run.** The 2026-08-31 re-rank exists to stop this
doc's small, tidy, headlessly-verifiable items consuming every execute run while the shelter
surface waits — and it does not cover PH-17, PH-19, PH-20 or PH-21. Those are not scaffolding;
they are the product asserting things about a real animal that nobody observed, which is the
class of defect this doc was founded on (PH-1). They sit here because this doc owns
truthfulness, not because production-hardening has been re-ranked.

**2026-09-13 — PH-21 replaces PH-20, and the `[large]` slot stays in this doc for a fifth
consecutive run.** PH-20 shipped the day it was queued (PR #79), which again emptied the slot
everywhere and again left PH-18 — small — as the only open item in the repo. The README's
fallback chain was run in full: the queue held nothing big; every gated note is still gated on a
*person* and not on code (RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b — re-read, unchanged, and
`git log --all --since=2026-09-10` is this loop's own commits only); so the third link,
**measure**, was used. What was measured is PH-20's own parting lead, which is the third
consecutive run of *pointing the last method at another consumer rather than inventing a new
method*. Two things generalise from it:

- **A lead that names a missing write path can be hiding a missing read path, and the read path
  is why nobody noticed.** The lead said the paragraph cannot be retracted. True — and the
  reason it has never mattered is that **no foster has ever seen one**, so nobody has been in a
  position to disagree with it. Measuring the readers before the writers is what turned a button
  into a surface. Generalised: when a lead describes something a user *cannot do*, check first
  whether they can *see* the thing they cannot do it to.
- **The tense test has now been asked of output, of input, and of persistence, and the fourth
  question is audience.** PH-17 asked what the page may print, PH-19 what the model may be told,
  PH-20 what the model may assert. PH-21 asks *who is shown the assertion* — and the answer
  measured out as "only the party who cannot verify it, never the two who can". That is not a
  new rule so much as the same one reaching the last of its four faces.

`DogProfile.ageMonths`'s `Math.max(1, …)` floor is the one lead left untouched and it survives
unchanged: it reports "1-month-old" for a dog entered as 0 years, which is a rounding today and
an assertion the moment anything reads it as one.

- **PH-21 `[large]` — the paragraph a model wrote about a real dog is invisible to the two
  people who could correct it, and permanent.** The measurement and the design answer are in
  "A retraction is a write, not an erasure" above; build from there, not from this summary.
  Four parts, all of them required for the item to be coherent — a read path with no way to act
  on it is the state the app is in today:

  1. **Show the foster what was sent.** In `web/src/phases/postfoster/PostFosterView.tsx`,
     replace the `foster.readyForAdoption` banner at `:70-74` with a card that renders
     `dog.adoption_profile` in full when it exists, labelled from `adoption_profile_source` —
     *"Drafted by the Pawthway assistant from your journal"* for `"agent"`. Read it off the dog
     document the view already has; do **not** re-derive it from the chat transcript, which is a
     different record and may not be the text that landed. When `readyForAdoption` is true and
     `adoption_profile` is absent, say that plainly rather than keeping the old sentence — the
     two documents disagreeing is a state the screen must be able to render.
  2. **Show the adopter.** `PublicAdoptionView` / `AdoptionProfileBody` render the paragraph as
     its own attributed section. It must be **visibly attributed and visibly separate** from the
     foster's own words (`Foster.adoptionNote`, which `AdoptionProfile.tsx` already renders as
     "A note from the foster") — the whole point of `adoption_profile_source` is that a reader
     can tell a drafted paragraph from a written one. Unattributed, this makes the page worse,
     not better.
  3. **A withdrawal path.** A new `@tool(dangerous=True)` in `src/agent/builtin/adoption.py` —
     `withdraw_adoption_profile(foster_id, dog_id, reason)` — which **writes rather than
     clears**: `adoption_profile` becomes a sentence naming the withdrawal and the foster's
     stated reason, and `adoption_profile_source` becomes `"foster_withdrawn"` (widen the union
     on `Dog` in `web/src/types.ts`). It must **not** touch `status`: a dog that came back from
     foster is still back from foster, and `ready_for_adoption` is RS-12's arrival state, not a
     claim about the paragraph. Add a quick action to `PostFosterView`'s `AgentChatPanel` and a
     `toolLabels.ts` entry, matching the two already there.
  4. **Tell the shelter which it is reading.** `ShelterRosterView.tsx:236-237` renders the
     paragraph bare. It gains the same attribution line, and a withdrawn profile reads as a
     withdrawal rather than as a description — staff are deciding whether a real animal gets
     listed, and PH-20 wrote `adoption_profile_source` for precisely this reader.

  **Tests.** `tests/test_adoption.py` (12 cases today) gains the withdrawal tool: it writes the
  sentence and the source, it leaves `status` alone, and it fails cleanly on a dog id that
  doesn't exist — `conftest.py`'s fake `update()` raises on a missing document, which is the
  behaviour that makes the last case meaningful. `ShelterRosterView.test.tsx` gains an
  attributed-render case and a withdrawn-render case. **Verification is the tests plus
  `npm run build`/`test`/`lint` and `pytest`** — reaching Post Foster live needs a completed
  journey on a signed-in account, which an unattended run cannot do; say so in the ledger row
  rather than implying otherwise.

  **One thing to re-verify before building, because three consecutive specs were wrong in the
  same direction:** confirm `PostFosterView` still holds the raw dog document (it calls
  `normalizeDog(raw)`, which spreads `...d`, so `adoption_profile` should pass through
  `RichDog` — check `web/src/lib/dog.ts` rather than assuming), and confirm the banner is still
  at `:70-74`.

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

- 2026-09-12 — PH-20 `[large]` — PR #79 — **The one paragraph this app keeps because a model
  wrote it now has to name what nobody recorded.** `generate_adoption_profile` returns a
  seventh key, `missing` — computed the way `adoption.ts:151-156` computes its own, plus the
  two the page doesn't need and the model does — and each entry is a **sentence about what did
  not happen** rather than a field name, for PH-19's reason. `PAWTHWAY_SYSTEM`'s adoption
  paragraph loses the word **"specific"** (the word doing the damage over sparse, nullable
  inputs), keeps "warm", and gains the content guardrail the pickup paragraph already had:
  *"a short paragraph that is true of this dog is correct when the care log is thin; a fuller
  one that is true of some dog is not"*. `send_adoption_profile_to_shelter` writes
  `adoption_profile_source: "agent"` beside the text — **nothing renders it yet, which is half
  of what PH-21 is for**. **The harness needed building before the tests could be written**,
  which the spec had not costed: `tests/conftest.py` had no `update()` and no
  `order_by().stream()`, so neither of this module's two tools could be driven at all — that is
  why `adoption` had no tests, not oversight. The fake's `update()` **raises on a missing
  document** rather than creating one, or a test would pass against a dog nobody seeded.
  `tests/test_adoption.py` is new (12 cases; 34 → 46). Backend and frontend checks green.
  **Not verifiable live by an unattended run** — reaching Post Foster needs a completed journey
  on a signed-in account, so the tests are the verification.

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
