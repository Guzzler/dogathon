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
not a doc edit. **Two more, 2026-09-22:** "New agent tool modules" still lists `save_intake()`
(removed by PH-26) and `update_dog()` (removed by PH-27).

## Task queue

**The routing that put truthfulness items in the third-ranked doc still holds, and it is worth
restating once rather than re-narrated each run.** The 2026-08-31 re-rank exists to stop this
doc's small, tidy, headlessly-verifiable items consuming every execute run while the shelter
surface waits — and it does not cover PH-17 through PH-27. Those are not scaffolding;
they are the product asserting things about a real animal that nobody observed, which is the
class of defect this doc was founded on (PH-1). They sit here because this doc owns
truthfulness, not because production-hardening has been re-ranked.

- **Every PH item through PH-27 is shipped** (PRs #47, #48, #49, #75, #77, #79, #81, #83, #85,
  #86, #89, #91, #93, #95, #98), each with a Ledger row that is the full account and a spec archived
  verbatim — [PH-26's](archive/production-hardening-ph26-2026-09-20.md),
  [PH-25's](archive/production-hardening-ph25-2026-09-19.md),
  [PH-24's](archive/production-hardening-ph24-2026-09-18.md),
  [PH-22's](archive/production-hardening-ph22-2026-09-14.md),
  [PH-18's](archive/production-hardening-ph18-2026-09-15.md) (read it before adding any local row
  back to `emergencyContacts`), and the rest named in the
  [2026-09-12 ledger archive](archive/production-hardening-ledger-2026-09-12.md). PH-23's
  request/confirm round trip was unbuilt, and is now **RS-14 `[large]`** in `real-data-and-shelters.md`
  (2026-09-22) — with the half PH-23's census missed: the pickup chat speaks *as* the shelter, and
  `MatchChatView.tsx:74` still says "You're confirmed for …". PH-15's live rules check is **PH-15b under "Needs a
  human"**, so don't read PH-15 as verified end to end.

- **PH-27 `[large]` — shipped 2026-09-21; the Ledger row is the full account.** Spec verbatim in
  [`archive/production-hardening-ph27-2026-09-21.md`](archive/production-hardening-ph27-2026-09-21.md).
  The census of dangerous tools is complete. **PH-28 `[large]` below is this queue's one open item**
  (2026-09-23); it sits *after* RS-14 in execute's order because RS-14 is in the top doc.

### PH-28 `[large]` — a fallback may choose a pixel, never a name (queued 2026-09-23)

execute's 2026-09-22 audit filed three findings here for plan to spec. Re-read against `main` at
`b937d3e` this run, all three hold, and PH-28 has a **third symptom the audit could not see from a
guest session**: `createApplication()` takes `shelterId` from the raw `dog.shelter_id`
(`DogDetailView.tsx:61`, `SavedView.tsx:122`), so applying to `d-026` writes an application to
`shelterId: "petsun"` — an id `shelters.ts` removed and no `shelters/{id}` document staffs — while
Saved and Match tell the foster *"Copper's Dream works through the approval checklist with you"*.
The display invents one organisation and the write addresses a second that does not exist. Nobody
can ever answer that application, which is RS-14's rule arriving from the other side.

**The design answer.** The 2026-09-14 section below draws the line at *"a default is a fallback when
it feeds geometry and a claim when it feeds a labelled row or a sentence"*. `shelterFor()`'s hash
feeds **no** geometry-only reader: all ~30 read sites of `dog.shelter` (counted this run with
`grep -rn "\.shelter\b\|\.shelter\." web/src`) render a name, an address, a distance, a map pin or a
sentence attributing a decision — and a pin *is* an address. So there is nothing to keep it for:

> **A fallback may choose a pixel, never a name.** An unknown organisation is absent, not hashed
> onto a real one — and a dog nobody can apply to through a shelter that reads the application is
> not listed.

The second half is what makes the first cheap: a dog with no resolvable shelter leaves Discovery,
so the dozen foster-journey sites need only a *generic* noun ("the shelter"), never a missing-name
layout — and **the live `d-026` disappears on deploy with no Firestore write**, which shrinks the
human half the audit expected to cleanup.

**Spec — one PR:**
1. **`shelterFor()` stops hashing.** `shelters.ts:24` returns `Shelter | null` (known id → entry,
   else `null`); `RichDog.shelter` (`dog.ts:27`) becomes `Shelter | null`, and `dog.ts:88`'s comment
   stops calling the hash a fallback. A `shelterName(dog, "short" | "name")` helper returns the org's
   name or **"the shelter"** — for sentences only, never for a labelled row.
2. **Listing.** `DiscoveryView.tsx:27` lists `status === "available" && dog.shelter` — the one place
   listing is decided. `MapView` groups only dogs with a shelter; `SwipeDeck.tsx:125/148` and
   `DogDetailView.tsx:32/175-176` omit the chip, the distance and the **Find at** card on `null`;
   `DiscoveryView.tsx:36`'s search tolerates `null`.
3. **Every sentence site** (`SavedView` ×5, `MatchView` ×8, `MatchChatView` ×2, `PostFosterView:115`,
   `DogDetailView:235`, `CarePlanView:55`) goes through `shelterName()`; `Emergency.tsx:120` already
   guards. **Coordinate with RS-14**, which rewrites `MatchView.tsx:158/197` and `MatchChatView.tsx:62`
   — whichever lands second rebases onto the other's copy; neither re-introduces `dog.shelter.x`.
   RS-14 was **mid-build in the shared checkout** when this was written (branch
   `feat/rs14-pickup-request-reaches-shelter`, uncommitted), so expect PH-28 to land second. One
   thing RS-14's own spec got wrong, recorded here rather than in its entry to avoid a merge
   conflict with that build: its verify grep for `first-person plural` is **vacuous** — the phrase
   spans a string-concatenation line break (`server.py:77-78`), so it returns nothing on `main`
   too. `foster coordinator` (one line) is the grep that actually proves the prompt changed.
4. **The adoption page.** `AdoptionProfile.tsx:200` titles the section **"The shelter's record"** on
   `null`, and `:236-237`'s contact card is omitted — the public link must not send enquiries to an
   org that has never heard of the dog.
5. **The importer stops listing what it keeps for a foster.** In `_push_to_firestore()`
   (`import_dogs.py:162-172`), a `spoken_for` dog whose status is `available` is written
   `status: "retired"` in the same batch (RS-6's value for "stop listing for a reason the others would
   misstate"), and the plan line says so: `keep N stale but matched to a foster (delisted: …)`.
   `plan_only` still writes nothing.
6. **`dogFromForm()`'s comment** (`shelterDog.ts:157-160`) stops endorsing the fallback: an unknown
   staff shelter's dog now has `shelter: null` and is unlisted, which is **correct until a second
   shelter exists**. Denormalising its name from `shelters/{id}` is named here, not built — there is no
   second shelter, and that document carries no coordinates to pin.

**Riders — both small, both from the same audit, both copy.** **PH-29:** `DemoIntroView.tsx:25-26`
stops dating the roster ("August 23rd, 2025" is a year wrong — `data/dogs.json` landed 2026-08-23 — and
a hardcoded date goes stale on its own while RS-13b keeps the weekly check from looking) and stops
saying "all": e.g. *"The dogs listed come from SF SPCA's public adoption listings; some may have been
adopted since."* "Shelters near you" (`WelcomeView.tsx:32`, `HubView.tsx:21`,
`DiscoveryView.tsx:94/189/205`) becomes "shelters in San Francisco" — nobody was asked where they are.
**PH-30:** `SignInToApply.tsx:62-63` drops *"You'll answer the questionnaire once more on your new
account"*, which PH-5's `migrateGuestData()` (`auth.ts:65`) made false on 2026-08-26.

**Verify:** vitest — `shelterFor` returns `null` for `petsun` and for an unknown id; `normalizeDog` of
a `petsun` dog has `shelter: null`; a Discovery-list helper (extract one if needed) excludes that dog
and keeps an `sfspca-mission` one; the adoption section title on a `null` shelter; `shelterName()` both
ways. pytest in the existing `tests/test_import_dogs.py` — a stale `available` dog matched to a foster
is kept **and** written `retired`, a stale unmatched one is deleted, `plan_only` writes nothing.
`grep -rn "SHELTERS\[h" web/src` empty. `./node_modules/.bin/tsc -b` (the type change finds every
site — trust it over this list), build, lint at `main`'s 8 warnings, `uv run pytest`. **Not in scope:**
deleting `d-026` (a human's — **PH-28b** under "Needs a human"), a second shelter's pin, and
`CLAUDE.md`'s "`shelterFor()` remains only as the fallback for seeded records", which goes stale with
this PR — not this loop's file; say so in the PR body.

Checked and fine by the audit: no console errors; an untouched slider is not recorded (PH-24 holds
live); the guest apply path opens the sign-in sheet. **Not reached:** anything past applying, and the
desktop layout.

### PH-25's write-layer rule and PH-26's agent-tool rule — archived 2026-09-23

Both shipped and both are restated — PH-25's by `patchFoster()`'s `mergeFields`, PH-26's by the
2026-09-21 section directly below, which extends it. Verbatim in
[`archive/production-hardening-ph24-26-2026-09-23.md`](archive/production-hardening-ph24-26-2026-09-23.md).
The one sentence to carry: **every write an agent tool makes must already be a write some screen
makes, or the tool should not exist.**

### The agent acts for one foster, so its dog writes are bounded by that foster's dog (2026-09-21)

PH-26's rule asks *which screen owns this write*. For the four remaining dangerous tools it needs
one more clause, because three of them write **`dogs/{id}`** — a document shared by every foster and
owned by a shelter — and "some screen makes this write" is true of a write *someone else's* screen
makes:

> **A screen twin counts only if it is a screen the person the agent acts for can reach.** The agent
> acts for one signed-in foster; it is never staff. So a dog write is legitimate only where that
> foster's own screen makes it, which in this app means **only their `matchedDogId`**, and only the
> fields Post Foster owns. The approval modal is not the guard: it is approved by the same foster
> the agent acts for, so it is consent, not authorization.

Read against `main` on 2026-09-21, that answers each tool:

- **`update_dog` (`shelter.py:55`) — remove.** It sets any of six statuses and replaces `notes` on
  **any** dog id, checking only that the id exists. Its only twin is `ShelterRosterView`, which is
  staff-only, and `firestore.rules`' dogs `update` branch requires `isStaff(resource.data.shelter_id)`
  — the Admin SDK walks straight around that. One approval click from any foster could mark another
  foster's dog `adopted` or `retired` (it leaves Discovery for everyone) or overwrite the shelter's
  `notes`, which feed the card, matching and the adoption page's "Shelter's record".
- **`send_adoption_profile_to_shelter` (`adoption.py:97`) — bind it to the matched dog.** It takes
  `dog_id` from the model and checks existence only. Its twin, `PostFosterView`, renders only for
  `foster.matchedDogId` (`PostFosterView.tsx:25`, `:37`), so any other dog id is a write no screen
  makes: a status flip to `ready_for_adoption` plus a paragraph on a dog this foster never had.
- **`withdraw_adoption_profile` (`adoption.py:151`) — the same binding, and one more guard.** A
  withdrawal on a dog whose `adoption_profile_source` is not `agent`/`foster_withdrawn` writes "The
  foster withdrew this write-up" over a profile nobody wrote, or over one a human did.
- **`log_care_entry` (`care.py:35`) — has a twin and matches it**, field for field with
  `addCareLogEntry()`, writing only to the resolved foster's own subcollection. The one guard it
  lacks is the type union the UI gets from TypeScript: `entry_type` is unvalidated. A rider.

With this, every dangerous tool in the registry has been checked against a screen its user can
reach, and the audit PH-26 began is complete — PH-27 is its last item, not the first of a series.

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

**PH-28b — PARKED at queue time (2026-09-23).** Once PH-28 ships, `d-026` "Pickle" is unlisted but
still a document. With the Firestore console open on `pawthway-hackathon`: check whether any
`fosters/*.matchedDogId` or `applications` row references `d-026` (and any `applications` row with
`shelterId: "petsun"` — an application nobody can read). If none, delete the dog; if one does, leave
it and write down whose. Either way the next real import run's plan output should list it under
"delisted" rather than "keep". **Write down what happened.**

Per the README's "nobody uses this app yet", the length of that list is not debt. Do not queue
them, and do not add to it without reading the archived preamble first.

## Ledger

- **2026-09-15 → 2026-09-20 — PH-18, PH-24, PH-25, PH-26, all `[large]` — PRs #85, #91, #93, #95.
  Archived 2026-09-23**, verbatim, in
  [`archive/production-hardening-ph24-26-2026-09-23.md`](archive/production-hardening-ph24-26-2026-09-23.md)
  — each row was already a compression of a longer archived one. PH-18 took the invented vet, map
  and phone number off the emergency screen; PH-24 made onboarding omit unanswered questions; PH-25
  made `patchFoster()` replace keys whole (`mergeFields`), so omission deletes; PH-26 cut
  `record_swipe` to Discovery's swipe and removed `save_intake`.

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
  All six claims in the census went, each with a replacement rather than a deletion: the footnote
  renders `Unrecorded` for the shelter's hours and states the booking window in Pawthway's own
  voice, the confirm verb is **Request**, and `server.py` stops enumerating the shelter's procedure
  and is told never to confirm a slot on its behalf. The census was one short (a third
  parenthetical in the same `server.py` sentence), and `SavedView`'s byte-identical `STAGES` copy
  became `APPLICATION_STAGES` + `activeStage()`. 149 tests. Full row verbatim in
  [`archive/production-hardening-ledger-2026-09-20.md`](archive/production-hardening-ledger-2026-09-20.md).
- 2026-09-21 — PH-27 `[large]` — PR #98 — The agent writes only the dog its foster has.
  `update_dog` is gone from `shelter.py`, `DEFAULT_DANGEROUS` and both `toolLabels.ts` entries;
  `adoption.py`'s new `_own_dog()` reads the resolved foster and raises before any write —
  `ValueError` with no `matchedDogId`, `PermissionError` for any other id — and an omitted `dog_id`
  now means the matched dog. **No phase gate**: `/post-foster` (`App.tsx:100`) and `PostFosterView`
  gate on `matchedDogId` alone, so a phase rule would have been a guard no screen has. Withdraw
  refuses unless `adoption_profile_source` is `agent`/`foster_withdrawn`. Riders: `log_care_entry`
  checks `ENTRY_TYPES`; `list_dogs` excludes an unknown weight under a limit and reads `status` and
  `good_with_kids` with `.get()` too (same `KeyError`, same RS-6 form — slightly past the spec).
  Two existing tests changed meaning rather than broke: "refuses an unknown dog" now expects
  `PermissionError` (the ownership check fires before the existence check), and
  `test_approval_store.py`'s opaque name is now `record_swipe`. 71 pytest (10 new cases), 168
  vitest, build green, lint 8 warnings as on `main`. **Not verified live** — the agent needs a
  signed-in token; reasoned from the tests and the route, not observed.
