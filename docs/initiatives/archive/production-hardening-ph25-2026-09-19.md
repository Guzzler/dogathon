# PH-25, verbatim — the queue spec and the design section that argued it

Archived **2026-09-19**, in the same PR that shipped PH-25, per the README's rule that after a
`[large]` item ships its design answer and its Ledger row are two tellings of one story. The
Ledger row in [`../production-hardening.md`](../production-hardening.md) is the account of what
was built; this file is what was asked for and why, unedited.

Read it before touching `patchFoster()` or `writeLocalFoster()`, and before adding a write path
that partially writes a nested map — the three-symptom census and the two-backend argument are
only here.

## The queue spec

- **PH-25 `[large]` — the retake path keeps answers the foster took back (queued 2026-09-19).**
  PH-24 made `finish()` omit a field nobody supplied. Verified this run against `main`: the
  omission does nothing on a **retake**, because the two write layers disagree about what omitting
  a key means, so PH-24's guarantee holds only for a foster's first pass.

  **The three symptoms, each re-read this run rather than carried from the note that found them:**
  1. `patchFoster()` (`web/src/hooks/useFoster.ts:50-54`) is `setDoc(..., { merge: true })`, which
     merges **nested maps key by key**. `OnboardingView.finish()` (`OnboardingView.tsx:78-88`)
     writes `patchFoster({ intake, phase: "discovery" })` with `pref_size`/`size_preference` and
     `pref_energy`/`energy_preference` conditionally spread in. A foster who moved the size slider
     on their first pass and left it alone on the retake keeps the **old** `pref_size` — the Hub's
     "What you're looking for" card prints it as a current answer and `scoreDog()` ranks on it.
     `writeLocalFoster()` (`lib/localMode.ts:44-48`) is `{ ...readLocalFoster(), ...patch }`, a
     shallow spread that replaces `intake` wholly, so LOCAL_MODE gets this right and Firestore does
     not. **The same behaviour under two backends is the acceptance bar.**
  2. `LookingForCard.reset()` (`web/src/phases/hub/HubView.tsx:148-152`) is
     `patchFoster({ intake: {}, ... })`. Under the same merge, an empty map merged into a populated
     one is a **no-op**: "Change answers" clears the phase, the swipes and the match and leaves
     every answer in place. Its own comment — *"Clearing intake sends them back through the front
     door"* — is false against Firestore and true under LOCAL_MODE.
  3. `DiscoveryView.tsx:170`'s **"Retake the questionnaire"** is a bare
     `navigate("/onboarding")` and clears nothing at all. Fixing (1) makes this correct without
     touching the line; **check that before changing it.**

  **Scope, and the two things deliberately outside it.** `intake` is the only nested map written
  partially — the census: `pickup` is written whole or `null`, `adoptionHighlights` writes all
  three keys every time, and `journal`/`careSchedule`/both checklists are arrays, which Firestore
  replaces wholly. `DiscoveryView.tsx:127`'s filter sheet already spreads
  `{ ...foster?.intake, ...patch }`, so it is the one caller that is correct today and should stay
  a full write. Out of scope: `foster.py`'s `save_intake`, which defaults its six strings to `""`
  and is a different shape of the same question; and any backfill of documents already carrying a
  pre-PH-24 `time_availability`, except insofar as a true replacement on the next retake removes it
  for free — say in the row whether it does.

  **Files**: `web/src/hooks/useFoster.ts`, `web/src/lib/localMode.ts`,
  `web/src/phases/onboarding/OnboardingView.tsx`, `web/src/phases/hub/HubView.tsx`, and
  `web/src/phases/discovery/DiscoveryView.tsx` only if (3) survives the fix to (1). The mechanism is
  execute's call; the constraint is below under "What omitting a key means at the write layer".
  **Verify**: new tests in `web/src/hooks/` or `web/src/lib/` covering *the same retake against both
  layers* — a partial `intake` written over a populated one must leave no key the second pass did
  not supply, under `patchFoster` and under `writeLocalFoster` alike — plus a case for
  `reset()`'s empty map. Then `npm test`, `./node_modules/.bin/tsc --noEmit` (**not** `npx tsc`),
  `npm run build`, `npm run lint` (expect the same 8 warnings as `main`; diff against a stash).

## The design section

### What omitting a key means at the write layer (2026-09-19)

PH-24 established that a form may only write a field the person actually supplied. It assumed, as
every face of the tense test before it did, that **not writing a key is the same as the key not
being there**. It is not, and that is a property of the storage layer rather than of the form:

> `setDoc(..., { merge: true })` merges nested maps **key by key**, so an omitted key means *leave
> whatever was there*. A shallow spread means *replace the map*. Pawthway has one of each, behind
> one function, and no caller can tell which it got.

So the rule the next write path needs, stated so it does not have to be re-derived:

> **Omission at the form is only honest if omission at the write layer deletes.** A form that
> carefully declines to answer a question, over a backend that treats declining as "keep the old
> answer", has recorded the old answer as a new one — which is exactly the claim PH-24 removed,
> arriving one layer down and a day later.

Three consequences that bound PH-25 rather than widening it:

1. **A helper is cheaper than a convention.** Twenty-odd call sites use `patchFoster`, and all but
   one write top-level scalars or arrays, where merge and replace agree. Teaching every caller the
   difference is the wrong shape; naming the one key that must be replaced — at the helper, or with
   an explicit full-key write from `finish()` — is the right one. Either satisfies the rule.
2. **Both layers must answer the same way, and LOCAL_MODE is the one that is already right.** The
   guest path is a supported path, not a fallback (`CLAUDE.md`, "Accounts"), so "correct under
   Firestore" is half a fix. Whatever the mechanism, a `deleteField()` sentinel must not reach
   `localStorage` as a literal.
3. **This is a stale claim, not an invented one** — the foster did once supply the value — which is
   why it is its own item and not a bug in PH-24. It also means there is no `Unrecorded` to render
   and nothing new to design: the honest state already has a renderer, and it has simply never been
   reachable on the retake path.
