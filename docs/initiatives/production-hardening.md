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
  The census of dangerous tools is complete. PH-28 `[large]` shipped 2026-09-26 and PH-31
  on 2026-09-27 (both below); nothing here is open.

- [x] **PH-32 `[large]` — the shared adoption link shows what the foster published (specified by
  plan 2026-10-08, shipped 2026-10-09).** Design answer: *a shared page shows what its foster
  published, and the sender sees exactly what the reader sees* — `adoptionProfiles/{dogId}`,
  written only by an explicit **Publish**, admitted by `firestore.rules` only for the holder of a
  live application carrying the shelter's `pickupConfirmedAt`. Spec verbatim in
  [`archive/production-hardening-ph32-2026-10-09.md`](archive/production-hardening-ph32-2026-10-09.md);
  the Ledger row is what shipped. The live rules check is **PH-32b** under "Needs a human".

- [ ] **PH-34 — confirmed by plan 2026-10-08: ages render as decimal years.** Kept here (it
  touches `lib/dog.ts`, which this doc already owns via PH-22/PH-28). `ageLabel`
  (`web/src/lib/dog.ts:105-110`) prints `${d.age_years} yrs` raw, so `11.08` reads *11.08 yrs*.
  Render *11 yrs 1 mo* (months from `Math.round((age % 1) * 12)`, dropped when 0, a 12 rolling into
  the year), keep `age_years` as stored, and while there take PH-22's standing lead — the
  one-month floor duplicated in `DogProfile.ageMonths`. A `dog.test.ts` case per branch. Small; a
  rider on PH-32 or on any run with room.

- [ ] **PH-33 — confirmed by plan 2026-10-08: the demo intro promises controls the hosted app never
  shows.** Re-read: `phases/auth/DemoIntroView.tsx:23` titles *You're in demo mode* before the
  visitor chooses, `:27` promises shelter approval *"overridable with demo controls"*, and
  `MatchView.tsx:349-350` renders `DemoShelterPanel` only without an application — which a signed-in
  foster always has (PH-31). **Design answer: the smallest honest version, not a demo shelter.** A
  visitor signing in as staff of a demo shelter needs a uid in `staffUids`, which is hand-written by
  design (`firestore.rules:114-115`, *no self-serve signup*); the first self-serve staff path does
  not belong behind a demo. So: a neutral title (*Before you start*), and copy that says what this
  build does — real dogs from the SF SPCA, an application a shelter answers, Care Plan's day
  controls once a pickup is confirmed. Verify with a `DemoIntroView` render test asserting neither
  *overridable* nor *demo controls* appears.

### PH-28 `[large]` + PH-29 + PH-30 — shipped 2026-09-26; the Ledger row is the full account

Spec verbatim in
[`archive/production-hardening-ph28-2026-09-26.md`](archive/production-hardening-ph28-2026-09-26.md).
The rule it shipped, kept here because a regression would break it: **a fallback may choose a
pixel, never a name** — `shelterFor()` returns `null` for an id it doesn't know, `isListable()`
(`lib/dog.ts`) is the one place Discovery decides listing, and every sentence names the org through
`shelterName()`. The deletion of `d-026` itself is **PH-28b** under "Needs a human".

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

### A default is honest when it is a fallback for the layout (2026-09-14) — archived 2026-09-26

Shipped as PH-22 and restated by PH-28's design answer above; verbatim in
[`archive/production-hardening-default-fallback-2026-09-26.md`](archive/production-hardening-default-fallback-2026-09-26.md).
The rule to carry: **a default is a fallback when it feeds geometry and a claim when it feeds a
labelled row or a sentence** — and `RichDog` carries provenance (`derived`) rather than going nullable.

### PH-31 — shipped 2026-09-27 (PR #106); spec archived 2026-09-28

Spec verbatim in [`archive/production-hardening-ph31-2026-09-28.md`](archive/production-hardening-ph31-2026-09-28.md);
the Ledger row is the account. The rule to carry: **listed and appliable are one test** —
`isListable()` has three callers (Discovery, `DogDetailView`, `SavedCard`), and an application is
written *before* the foster document. **This queue has no open item as of 2026-09-28**, re-checked
rather than carried: the one truthfulness finding this run made (a whole-document import `set()`
over fields other writers own) is roster ownership, so it is **RS-16** in `real-data-and-shelters.md`.

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
it and write down whose. Either way the next real import run's plan output lists it on the "keep …
matched to a foster" line with a `(delisted: [...])` suffix, and the write sets it `retired`. **Write down what happened.**
**2026-09-28, half-answered by a real run:** the weekly check's plan (run `36403398124`, issue #96)
prints `keep 2 stale but matched to a foster: ['d-026', 'sfspca-61200213'] (delisted: [...])` — so
**some `fosters/*` document still has `matchedDogId: "d-026"`**, and the rule above says leave it.
Whose is the half still needing the console; the plan line never names a foster, by design.

**PH-32b — PARKED at queue time (2026-10-08); the signed-in half of PH-32 (shipped 2026-10-09).** Its
spec's last sentence is the whole check: publish as the confirmed test foster, attempt the same
write from a second account (expect `permission-denied` — a success is a finding to queue, never
licence to widen the rule), then open the link signed out and see the published notes.

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

- **2026-09-10 → 2026-09-12 — PH-17 `[large]` (PR #75), PH-19 `[large]` (PR #77), PH-20 `[large]`
  (PR #79). Archived 2026-10-08**, verbatim, in
  [`archive/production-hardening-ledger-2026-10-08.md`](archive/production-hardening-ledger-2026-10-08.md).
  PH-17 moved the demo journal behind `LOCAL_MODE` and built `medical` from what was logged; PH-19
  made the Care Plan brief state gaps as gaps; PH-20 made `generate_adoption_profile` return `missing`.

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
- **2026-09-21 — PH-27 `[large]` (PR #98); 2026-09-26 — PH-28 `[large]` + PH-29 + PH-30 (PR #104).
  Archived 2026-10-08**, verbatim, in the same
  [`archive/production-hardening-ledger-2026-10-08.md`](archive/production-hardening-ledger-2026-10-08.md).
  PH-27: the agent writes only its foster's dog (`_own_dog()`, `update_dog` removed). PH-28: an org
  we can't name is absent — `shelterFor()` returns `null`, `isListable()` gates Discovery,
  `shelterName()` for sentences; PH-29/PH-30 were copy riders on the demo intro and `SignInToApply`.
- 2026-09-27 — PH-31 — PR #106 — **a dog that isn't listed can't be applied to, and a failed
  application no longer strands the foster on Match.** Both apply sites' `canApply` is now
  `isListable()` — the same test Discovery uses — so a saved or deep-linked dog that is `retired`,
  `adopted`, `ready_for_adoption`, `foster` or `medical_hold` shows *Not taking applications*
  (PH-28 had already put the status half into `isListable()`; the sites weren't calling it). Both
  `apply()`s write `createApplication()` **before** `patchFoster()`, RS-14's order; a throw shows
  "That didn't reach {shelter}, so you haven't applied yet" (MatchView's `pickupFailed` wording and
  style) and writes nothing else. `createApplication()`'s silent return on a missing `shelterId`
  is a throw. `LOCAL_MODE` (no uid) still commits the foster record alone. Verified: 198 vitest (8
  new — every non-`available` status and a null-shelter dog in `isListable`, and a new
  `SavedView.test.tsx` rendering a liked dog in each status plus `petsun`), `tsc -b`, build, lint
  at `main`'s 8. **Not verified in a browser:** the committed roster is all `available`, so no
  local walk reaches the disabled state, and the failure branch needs a Firestore write to fail.
- 2026-10-09 — PH-32 `[large]` — PR #__ — **the shared adoption link shows what the foster
  published, to everyone, the sender included.** New `adoptionProfiles/{dogId}` (rules: public
  read; create/update only by the foster named in `fosterId` whose `applicationId` is live on this
  dog with a non-null `pickupConfirmedAt`; update/delete only by the stored author).
  `lib/adoption.ts` gains `publishedPart` / `withPublished` / `samePublished`; new
  `lib/adoptionProfiles.ts`; `PublicAdoptionView` renders the shelter-only profile with the
  snapshot laid over it and no longer reads the viewer's foster document; `AdoptionProfileBody`
  takes `audience` with the three reader empty states, and the foster copy no longer says *starred*
  notes are summarised; Post Foster has a **Publish** / **Publish changes** card and the share
  sheet says *Until you publish, this link shows only {shelter}'s record*; deletion takes published
  pages down first and export includes them; Saved's withdraw unpublishes. **Departures from the
  spec:** `publishAdoptionProfile` takes the `fosterId` explicitly; `unpublishAdoptionProfile` reads
  before deleting (a delete of a missing doc or another foster's page is refused by the rule, so
  neither is attempted — no rule loosened for it); the Publish control is replaced by a line saying
  why when there is no confirmed application, rather than rendering disabled; `LOCAL_MODE` keeps
  today's own-data page as its own component, and now passes the careLog entries the spec noted
  the old view dropped. **Noted, not fixed:** a page stays published if staff later *undo* the
  confirmation — its author can still delete it but can no longer update it; whether undo should
  take it down is a question for plan. Verified: 276 vitest (10 new — 5 for the helpers, 2 for
  `PublicAdoptionView.test.tsx` incl. a mock that throws if the page reads `useFoster`, 3 for
  `PostFosterView.test.tsx`), `tsc -b`, build, lint at `main`'s 8, and `firestore.rules` compiled by
  `firebase deploy --only firestore:rules --dry-run` (nothing released). **Not verified in a
  browser** — the unattended run's dev-server start was declined — **nor against live rules**:
  that is PH-32b.
