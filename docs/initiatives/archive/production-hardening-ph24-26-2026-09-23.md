# production-hardening.md — archived 2026-09-23

Verbatim snapshot, cut from the working doc by the 2026-09-23 plan run to make room for PH-28's spec. Two settled design sections (PH-25's write-layer rule, PH-26's agent-tool rule — both restated by shipped code and by the 2026-09-21 section still in the working doc) and four Ledger rows (PH-26, PH-25, PH-24, PH-18), each already a compression of a longer archived row.

---

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
`save_intake` goes around it in another language, and is PH-26.

### An agent tool is a write path, and it answers to the screen that owns the write (2026-09-20)

The question PH-25's parting note left: should `save_intake` be taught the same omission rule, in
Python? Answering it found the wrong question. Three censuses in three runs (PH-23's surfaces,
PH-24's inputs, PH-25's storage) enumerated **the UI's** write sites, and the agent's
`@tool(dangerous=True)` functions are write sites none of them could see — they write the same
document through the Admin SDK, bypassing `firestore.rules` *and* every helper the UI routes
through. So:

> **Every write an agent tool makes must already be a write some screen makes, with the same
> fields, the same guards and the same side effects — or the tool should not exist.** A tool is a
> shortcut to a screen, not a second implementation of one. Where the screen does more than the
> tool (creates an application, checks the one-foster block, writes both halves of an answer),
> the tool is not a shortcut, it is a way around.

That answers each tool without a new rule per tool. `record_swipe`'s like has a screen twin
(Discovery's swipe) and is narrowed to it; its match-and-phase half has no twin that skips
`createApplication()`, so it goes. `save_intake` has no twin at all — no screen writes intake
without the questionnaire's guards, and the agent is mounted only in phases *past* the
questionnaire — so it is removed rather than repaired; teaching it PH-24's omission rule would have
built a correct second questionnaire nobody asked for. The other dangerous tools were audited the
next run — below.


## Ledger rows (verbatim)

- 2026-09-20 — PH-26 `[large]` — PR #95 — **the agent's two foster-writing tools now write only
  what a screen writes.** `record_swipe` is Discovery's swipe and nothing more: the dog joins
  `likedDogIds` or `passedDogIds` and leaves the other (read-modify-write, as the UI does, rather
  than `ArrayUnion`), and a like no longer sets `matchedDogId`/`phase` — so there is no longer an
  application the shelter's inbox can't see. Docstring and approval copy (`toolLabels.ts`) say a
  like saves the dog and does not apply. `save_intake` is **removed**, with its
  `DEFAULT_DANGEROUS` entry and both label entries; `grep -rn save_intake src web/src` is empty.
  Rider shipped as specified: `sizeWord`/`sizeAnswer`/`energyAnswer` in `lib/matching.ts`, used by
  onboarding and the filter sheet, both local `sizeWord` copies deleted. **One addition beyond the
  spec:** `tests/test_foster_tools.py` also asserts `DEFAULT_DANGEROUS` equals the server's
  `dangerous=True` set (parsed from `AgentChatPanel.tsx`), since that list's own comment says
  "keep the two in sync" and nothing enforced it. **One deviation:** the filter-sheet test is on
  the helpers it calls, not the sheet — `web/` has no DOM testing library to drive a slider, and
  adding one for one case wasn't worth it. pytest 61, vitest 168, `tsc -b`, build, lint (8
  warnings = `main`). Not verified live: the agent needs a signed-in token. CLAUDE.md's "New agent
  tool modules" still lists `save_intake()` — not this loop's file; flagged in the PR body.

- 2026-09-19 — PH-25 `[large]` — PR #93 — **a retake of the questionnaire no longer keeps the
  answers the foster took back.** `patchFoster()` writes `{ mergeFields: keys.map(k => new
  FieldPath(k)) }` instead of `{ merge: true }`, so every key in a patch is replaced whole — which
  made `HubView.reset()`'s `patchFoster({ intake: {} })` a real clear rather than the no-op it had
  been. `mergeFields` over `updateDoc` because the foster document may not exist yet; a `FieldPath`
  per key because a bare string is parsed as a dotted path. 13 tests drive one fixture through both
  layers; reverting the line turns 5 red and leaves the 8 guest-side cases green. Not driven against
  real Firestore — that is **PH-25b**. Full row verbatim in
  [`archive/production-hardening-ph25row-2026-09-21.md`](archive/production-hardening-ph25row-2026-09-21.md).

- 2026-09-18 — PH-24 `[large]` — PR #91 — **onboarding stopped recording answers nobody gave.**
  An untouched slider omits `pref_size`/`size_preference` (and the energy pair), and
  `time_availability` is gone because nothing ever asked it. What outlives the row: the five-site
  census was **right**, the first time in nine runs; the fix needed a *third* flag per field,
  because six of `scoreDog`'s eleven rules compare the dog against the home or experience, not the
  slider (**a guard added one layer up is not automatically the same guard**); and **a list omits,
  a labelled row renders the absence**. Backend untouched — which is where PH-26 starts. Full row
  verbatim in [`archive/production-hardening-ledger-2026-09-20.md`](archive/production-hardening-ledger-2026-09-20.md).

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

